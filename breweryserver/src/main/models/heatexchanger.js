const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const mq = require('brewerynode-common').mq;
const lockutils = require('brewerynode-common').lockutils;
const each = require('async-each');
const Manifold = require('./manifold');

let extraModels = [
  commonmodels.base,
  commonmodels.sensor,
  commonmodels.mutator,
  commonmodels.enabled,
  commonmodels.exact
];

const WARM_VALVES_REQUESTED = 1;
const WARM_VALVES_OPEN = 2;
const WARM_PUMP_REQUESTED = 4;
const WARM_PUMP_ON = 8;

const COLD_VALVES_REQUESTED = 16;
const COLD_VALVES_OPEN = 32;
const COLD_PUMP_REQUESTED = 64;
const COLD_PUMP_ON = 128;

const MAINS_VALVES_REQUESTED = 256;
const MAINS_VALVES_OPEN = 512;

const WARM_FLOW_ERROR = 1;
const COLD_FLOW_ERROR = 2;
const SEQUENCE_ERROR = 4;
const MANIFOLD_ERROR = 8;
const PUMP_ERROR = 16;

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'HeatExchanger',
    valueType: DataTypes.STRING,
    defaultValue: 'off',
    fields: {
      manifold: { type: DataTypes.STRING, allowNull: false, unique: false },
      warmPump: { type: DataTypes.STRING, allowNull: false, unique: false },
      warmFlow: { type: DataTypes.STRING, allowNull: false, unique: false },
      coldPump: { type: DataTypes.STRING, allowNull: false, unique: false },
      coldFlow: { type: DataTypes.STRING, allowNull: false, unique: false },
      errorFlags: {
        type: DataTypes.INTEGER,
        defaultValue: WARM_FLOW_ERROR | COLD_FLOW_ERROR
      },
      stateFlags: { type: DataTypes.INTEGER, defaultValue: 0 }
    }
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let HeatExchanger = defineTable(sequelize, DataTypes);
  functions.defineDTO(HeatExchanger, extraModels);
  functions.defineVersions(HeatExchanger, extraModels);
  functions.addMessageHandlers(HeatExchanger, extraModels);
  functions.addUpdateProcessor(HeatExchanger);

  HeatExchanger.doCompare = functions.stringCompare;

  HeatExchanger.handleMessage = function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    HeatExchanger.messageHandlers[key](dto);
  };

  HeatExchanger.checkFlowChange = async function(dto, field, bitmask) {
    let heatexchangers = await HeatExchanger.findAll({
      where: {
        [field]: dto.name
      },
      attributes: ['id']
    });
    if (heatexchangers !== null) {
      each(heatexchangers, async function(heatexchanger) {
        heatexchanger = await HeatExchanger.lockByModel(heatexchanger);
        let current = heatexchanger.errorFlags;
        if (dto.value) {
          current &= ~bitmask;
        } else {
          current |= bitmask;
        }
        await heatexchanger.update({ errorFlags: current });
        HeatExchanger.unlock(heatexchanger);
      });
    }
  };

  HeatExchanger.handleFlowChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    HeatExchanger.checkFlowChange(dto, 'warmFlow', WARM_FLOW_ERROR);
    HeatExchanger.checkFlowChange(dto, 'coldFlow', COLD_FLOW_ERROR);
  };

  HeatExchanger.handleManifoldChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let heatexchangers = await HeatExchanger.findAll({
      where: {
        manifold: dto.name
      },
      attributes: ['id']
    });
    if (heatexchangers !== null) {
      each(heatexchangers, async function(heatexchanger) {
        heatexchanger = await HeatExchanger.lockByModel(heatexchanger);
        let current = heatexchanger.stateFlags;
        if (dto.value === Manifold.WARM_WATER) {
          current |= WARM_VALVES_OPEN;
        } else {
          current &= ~WARM_VALVES_OPEN;
        }
        if (dto.value === Manifold.COLD_WATER) {
          current |= COLD_VALVES_OPEN;
        } else {
          current &= ~COLD_VALVES_OPEN;
        }
        if (dto.value === Manifold.MAINS_WATER) {
          current |= MAINS_VALVES_OPEN;
        } else {
          current &= ~MAINS_VALVES_OPEN;
        }
        await heatexchanger.update({ stateFlags: current });
        HeatExchanger.unlock(heatexchanger);
      });
    }
  };

  HeatExchanger.prototype.handleError = async function() {
    if ((this.stateFlags & WARM_PUMP_ON) === WARM_PUMP_ON) {
      winston.info(this.name + ' is in error - disabling warm pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.warmPump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~WARM_PUMP_ON)
      });
    }
    if ((this.stateFlags & COLD_PUMP_ON) === COLD_PUMP_ON) {
      winston.info(this.name + ' is in error - disabling cold pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.coldPump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~COLD_PUMP_ON)
      });
    }
    if (
      (this.stateFlags & WARM_VALVES_OPEN) === WARM_VALVES_OPEN ||
      (this.stateFlags & COLD_VALVES_OPEN) === COLD_VALVES_OPEN ||
      (this.stateFlags & MAINS_VALVES_OPEN) === MAINS_VALVES_OPEN
    ) {
      winston.info(this.name + ' is error - closing manifold');
      mq.send(
        'manifold.v1.set',
        JSON.stringify({ name: this.manifold, value: Manifold.CLOSED })
      );
    }
    if (this.value !== 'off') {
      await this.update({
        value: 'off'
      });
    }
  };

  HeatExchanger.prototype.checkError = function(ignoredStates) {
    let errorFlags = this.errorFlags;
    errorFlags &= ~ignoredStates;
    let ret = String(errorFlags) !== String(0);
    return ret;
  };

  HeatExchanger.prototype.runOff = async function(firstRun) {
    if (firstRun) {
      await this.update({
        errorFlags: (this.errorFlags & WARM_FLOW_ERROR) | COLD_FLOW_ERROR
      });
    }
    if ((this.stateFlags & WARM_PUMP_ON) === WARM_PUMP_ON) {
      winston.info(this.name + ' is set to OFF - disabling warm pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.coldPump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~WARM_PUMP_ON)
      });
    }
    if ((this.stateFlags & COLD_PUMP_ON) === COLD_PUMP_ON) {
      winston.info(this.name + ' is set to OFF - disabling cold pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.coldPump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~COLD_PUMP_ON)
      });
    }
    if (
      (this.stateFlags & WARM_VALVES_OPEN) === WARM_VALVES_OPEN ||
      (this.stateFlags & COLD_VALVES_OPEN) === COLD_VALVES_OPEN ||
      (this.stateFlags & MAINS_VALVES_OPEN) === MAINS_VALVES_OPEN
    ) {
      winston.info(this.name + ' is set to OFF - changing manifold');
      mq.send(
        'manifold.v1.set',
        JSON.stringify({ name: this.manifold, value: Manifold.CLOSED })
      );
    }
  };

  HeatExchanger.prototype.runDisabled = async function() {
    if ((this.stateFlags & WARM_PUMP_ON) === WARM_PUMP_ON) {
      winston.info(this.name + ' is disabled - disabling warm pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.coldPump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~WARM_PUMP_ON)
      });
    }
    if ((this.stateFlags & COLD_PUMP_ON) === COLD_PUMP_ON) {
      winston.info(this.name + ' is disabled - disabling cold pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.coldPump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~COLD_PUMP_ON)
      });
    }
    if (
      (this.stateFlags & WARM_VALVES_OPEN) === WARM_VALVES_OPEN ||
      (this.stateFlags & COLD_VALVES_OPEN) === COLD_VALVES_OPEN ||
      (this.stateFlags & MAINS_VALVES_OPEN) === MAINS_VALVES_OPEN
    ) {
      winston.info(this.name + ' is disabled- changing manifold');
      mq.send(
        'manifold.v1.set',
        JSON.stringify({ name: this.manifold, value: Manifold.CLOSED })
      );
    }
  };

  HeatExchanger.prototype.runWarm = async function(firstRun) {
    if (firstRun) {
      winston.info(this.name + ' is set to warm and not running - changing manifold');
      setTimeout(HeatExchanger.timeoutWarmValves, 5000, this);
      mq.send(
        'manifold.v1.set',
        JSON.stringify({ name: this.manifold, value: Manifold.WARM_WATER })
      );
      await this.update({
        stateFlags: (this.stateFlags |= WARM_VALVES_REQUESTED)
      });
    } else {
      if (this.checkError(COLD_FLOW_ERROR | WARM_FLOW_ERROR)) {
        await this.handleError();
        return;
      }
      if (this.stateFlags & WARM_VALVES_OPEN) {
        if (
          (this.stateFlags & WARM_PUMP_ON) === 0 &&
          (this.stateFlags & WARM_PUMP_REQUESTED) === 0
        ) {
          winston.info(
            this.name +
              ' is set to warm with manifold open and not running - enabling warm pump'
          );
          setTimeout(HeatExchanger.timeoutWarmFlow, 5000, this);
          mq.send('pump.v1.set', JSON.stringify({ name: this.warmPump, value: true }));
          await this.update({
            stateFlags: (this.stateFlags |= WARM_PUMP_ON | WARM_PUMP_REQUESTED)
          });
        } else if (
          (this.stateFlags & WARM_PUMP_ON) === WARM_PUMP_ON &&
          (this.stateFlags & WARM_PUMP_REQUESTED) === 0
        ) {
          if (this.checkError(COLD_FLOW_ERROR)) {
            await this.handleError();
          }
        }
      }
    }
  };

  HeatExchanger.prototype.runCold = async function(firstRun) {
    if (firstRun) {
      winston.info(this.name + ' is set to cold and not running - changing manifold');
      setTimeout(HeatExchanger.timeoutColdValves, 5000, this);
      mq.send(
        'manifold.v1.set',
        JSON.stringify({ name: this.manifold, value: Manifold.COLD_WATER })
      );
      await this.update({
        stateFlags: (this.stateFlags |= COLD_VALVES_REQUESTED)
      });
    } else {
      if (this.checkError(COLD_FLOW_ERROR | WARM_FLOW_ERROR)) {
        await this.handleError();
        return;
      }
      if (this.stateFlags & COLD_VALVES_OPEN) {
        if (
          (this.stateFlags & COLD_PUMP_ON) === 0 &&
          (this.stateFlags & COLD_PUMP_REQUESTED) === 0
        ) {
          winston.info(
            this.name +
              ' is set to cold with manifold open and not running - enabling cold pump'
          );
          setTimeout(HeatExchanger.timeoutColdFlow, 5000, this);
          mq.send('pump.v1.set', JSON.stringify({ name: this.coldPump, value: true }));
          await this.update({
            stateFlags: (this.stateFlags |= COLD_PUMP_ON | COLD_PUMP_REQUESTED)
          });
        } else if (
          (this.stateFlags & COLD_PUMP_ON) === COLD_PUMP_ON &&
          (this.stateFlags & COLD_PUMP_REQUESTED) === 0
        ) {
          if (this.checkError(WARM_FLOW_ERROR)) {
            await this.handleError();
          }
        }
      }
    }
  };

  HeatExchanger.prototype.runMains = async function(firstRun) {
    if (firstRun) {
      winston.info(this.name + ' set to mains and not running - changing manifold');
      setTimeout(HeatExchanger.timeoutMainsValves, 5000, this);
      mq.send(
        'manifold.v1.set',
        JSON.stringify({ name: this.manifold, value: Manifold.MAINS_WATER })
      );
      await this.update({
        stateFlags: (this.stateFlags |= MAINS_VALVES_REQUESTED)
      });
      return;
    }
    if (this.checkError(COLD_FLOW_ERROR | WARM_FLOW_ERROR)) {
      await this.handleError();
    }
  };

  HeatExchanger.prototype.process = async function(instance, options) {
    if (this.enabled) {
      let firstRun =
        options.fields.indexOf('requestedValue') !== -1 ||
        options.fields.indexOf('enabled') !== -1;
      if (firstRun) {
        if (
          this.requestedValue !== 'off' &&
          this.stateFlags !== 0 &&
          this.errorFlags !== (WARM_FLOW_ERROR | COLD_FLOW_ERROR)
        ) {
          winston.error(
            "Can't change to new mode, current mode isn't OFF, disabling system"
          );
          await this.update({
            errorFlags: this.errorFlags | SEQUENCE_ERROR,
            enabled: false
          });
          return;
        }
      }
      winston.info('First run: ' + firstRun);
      switch (this.requestedValue) {
        case 'off': {
          await this.runOff(firstRun);
          break;
        }
        case 'warm': {
          await this.runWarm(firstRun);
          break;
        }
        case 'cold': {
          await this.runCold(firstRun);
          break;
        }
        case 'mains': {
          await this.runMains(firstRun);
          break;
        }
        default: {
          winston.error('Unknown heatexchanger mode: ' + this.requestedValue);
        }
      }
    } else {
      await this.runDisabled();
    }
  };

  HeatExchanger.timeoutWarmFlow = async function(instance) {
    winston.info(instance.name + ' marking warm flow timeout');
    instance = await HeatExchanger.lockByModel(instance);
    if ((instance.errorFlags & WARM_FLOW_ERROR) === 0) {
      await instance.update({
        stateFlags: instance.stateFlags & ~WARM_PUMP_REQUESTED,
        value: 'warm'
      });
    } else {
      await instance.update({
        stateFlags: instance.stateFlags & ~WARM_PUMP_REQUESTED,
        errorFlags: instance.errorFlags | PUMP_ERROR
      });
    }
    HeatExchanger.unlock(instance);
  };

  HeatExchanger.timeoutWarmValves = async function(instance) {
    winston.info(instance.name + ' marking warm valves timeout');
    instance = await HeatExchanger.lockByModel(instance);
    let stateFlags = instance.stateFlags & ~WARM_VALVES_REQUESTED;
    let errorFlags = instance.errorFlags;

    if ((instance.stateFlags & WARM_VALVES_OPEN) === 0) {
      errorFlags |= MANIFOLD_ERROR;
    }
    await instance.update({ stateFlags: stateFlags, errorFlags: errorFlags });
    HeatExchanger.unlock(instance);
  };

  HeatExchanger.timeoutColdFlow = async function(instance) {
    winston.info(instance.name + ' marking cold flow timeout');
    instance = await HeatExchanger.lockByModel(instance);
    if ((instance.errorFlags & COLD_FLOW_ERROR) === 0) {
      await instance.update({
        stateFlags: instance.stateFlags & ~COLD_PUMP_REQUESTED,
        value: 'cold'
      });
    } else {
      await instance.update({
        stateFlags: instance.stateFlags & ~COLD_PUMP_REQUESTED,
        errorFlags: instance.errorFlags | PUMP_ERROR
      });
    }
    HeatExchanger.unlock(instance);
  };

  HeatExchanger.timeoutColdValves = async function(instance) {
    winston.info(instance.name + ' marking cold valves timeout');
    instance = await HeatExchanger.lockByModel(instance);
    let stateFlags = instance.stateFlags & ~COLD_VALVES_REQUESTED;
    let errorFlags = instance.errorFlags;

    if ((instance.stateFlags & COLD_VALVES_OPEN) === 0) {
      errorFlags |= MANIFOLD_ERROR;
    }
    await instance.update({ stateFlags: stateFlags, errorFlags: errorFlags });
    HeatExchanger.unlock(instance);
  };

  HeatExchanger.timeoutMainsValves = async function(instance) {
    winston.info(instance.name + ' marking mains valves timeout');
    instance = await HeatExchanger.lockByModel(instance);
    let stateFlags = instance.stateFlags & ~MAINS_VALVES_REQUESTED;

    if ((instance.stateFlags & MAINS_VALVES_OPEN) === 0) {
      await instance.update({
        stateFlags: stateFlags,
        errorFlags: (this.errorFlags |= MANIFOLD_ERROR)
      });
    } else {
      await instance.update({ stateFlags: stateFlags, value: 'mains' });
    }
    HeatExchanger.unlock(instance);
  };

  HeatExchanger.bootstrap = async function() {
    let heatexchangers = await HeatExchanger.findAll();
    if (heatexchangers !== null) {
      for (var i = 0; i < heatexchangers.length; i++) {
        heatexchangers[i].bootstrap();
      }
    }
  };

  HeatExchanger.prototype.bootstrap = function() {
    mq.send('flow.v1.getcurrentvalue', JSON.stringify({ name: this.warmFlow }));
    mq.send('flow.v1.getcurrentvalue', JSON.stringify({ name: this.coldFlow }));
    mq.send('mainifold.v1.getcurrentvalue', JSON.stringify({ name: this.manifold }));
  };

  lockutils.lockHook(HeatExchanger);

  return { single: HeatExchanger };
};
