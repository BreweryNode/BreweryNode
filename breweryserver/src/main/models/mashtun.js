const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const mq = require('brewerynode-common').mq;
const lockutils = require('brewerynode-common').lockutils;
const each = require('async-each');

let extraModels = [
  commonmodels.base,
  commonmodels.sensor,
  commonmodels.mutator,
  commonmodels.enabled,
  commonmodels.tolerance,
  commonmodels.mode
];
const HEATERS_ON = 1;
const PUMP_REQUESTED = 2;
const PUMP_ON = 4;
const PUMP_SLEEP = 8;
const PUMP_SLEEP_FINISHED = 16;
const WARM_WATER_ON = 32;
const HEAT_EXCHANGER_REQUESTED = 64;
const HEAT_EXCHANGER_ON = 128;

const FLOW_ERROR = 1;
const HEAT_EXCHANGER_ERROR = 2;

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'MashTun',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0,
    modeType: DataTypes.STRING,
    defaultMode: 'off',
    fields: {
      element1: { type: DataTypes.STRING, allowNull: false, unique: false },
      element2: { type: DataTypes.STRING, allowNull: false, unique: false },
      flow: { type: DataTypes.STRING, allowNull: false, unique: false },
      pump: { type: DataTypes.STRING, allowNull: false, unique: false },
      temperature: { type: DataTypes.STRING, allowNull: false, unique: false },
      warmwater: { type: DataTypes.STRING, allowNull: false, unique: false },
      heatexchanger: { type: DataTypes.STRING, allowNull: false, unique: false },
      errorFlags: {
        type: DataTypes.INTEGER,
        defaultValue: FLOW_ERROR | HEAT_EXCHANGER_ERROR
      },
      stateFlags: { type: DataTypes.INTEGER, defaultValue: PUMP_SLEEP_FINISHED }
    }
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let MashTun = defineTable(sequelize, DataTypes);
  functions.defineDTO(MashTun, extraModels);
  functions.defineVersions(MashTun, extraModels);
  functions.addMessageHandlers(MashTun, extraModels);
  functions.addUpdateProcessor(MashTun);

  MashTun.doCompare = functions.stringCompare;

  MashTun.handleMessage = function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    MashTun.messageHandlers[key](dto);
  };

  MashTun.handleTemperatureChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let mashtuns = await MashTun.findAll({
      where: {
        temperature: dto.name
      },
      attributes: ['id']
    });
    if (mashtuns !== null) {
      each(mashtuns, async function(mashtun) {
        mashtun = await MashTun.lockByModel(mashtun);
        mashtun.reading(mashtun, dto);
        MashTun.unlock(mashtun);
      });
    }
  };

  MashTun.handleFlowChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let mashtuns = await MashTun.findAll({
      where: {
        temperature: dto.name
      },
      attributes: ['id']
    });
    if (mashtuns !== null) {
      each(mashtuns, async function(mashtun) {
        mashtun = await MashTun.lockByModel(mashtun);
        let current = mashtun.errorFlags;
        if (dto.value) {
          current &= ~FLOW_ERROR;
        } else {
          current |= FLOW_ERROR;
        }
        await mashtun.update({ errorFlags: current });
        MashTun.unlock(mashtun);
      });
    }
  };

  MashTun.handleTemperatureChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let mashtuns = await MashTun.findAll({
      where: {
        temperature: dto.name
      },
      attributes: ['id']
    });
    if (mashtuns !== null) {
      each(mashtuns, async function(mt) {
        mt = await MashTun.lockByModel(mt);
        await mt.reading(mt, dto);
        MashTun.unlock(mt);
      });
    }
  };

  MashTun.handleHeatExchangerChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let mashtuns = await MashTun.findAll({
      where: {
        heatexchanger: dto.name
      },
      attributes: ['id']
    });
    if (mashtuns !== null) {
      each(mashtuns, async function(mashtun) {
        mashtun = await MashTun.lockByModel(mashtun);
        let current = mashtun.errorFlags;
        if (dto.value === 'warm') {
          current &= ~HEAT_EXCHANGER_ERROR;
        } else {
          current |= HEAT_EXCHANGER_ERROR;
        }
        await mashtun.update({ errorFlags: current });
        MashTun.unlock(mashtun);
      });
    }
  };

  MashTun.prototype.handleError = async function() {
    if ((this.stateFlags & PUMP_ON) === PUMP_ON) {
      winston.info(this.name + ' is in error - disabling pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.pump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~PUMP_ON)
      });
    }
    if ((this.stateFlags & HEATERS_ON) === HEATERS_ON) {
      winston.info(this.name + ' is in error - disabling heaters');
      mq.send('heater.v1.set', JSON.stringify({ name: this.element1, value: false }));
      mq.send('heater.v1.set', JSON.stringify({ name: this.element2, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~HEATERS_ON)
      });
    }
    if ((this.stateFlags & WARM_WATER_ON) === WARM_WATER_ON) {
      winston.info(this.name + ' is in error - disabling warm water');
      mq.send('hotwater.v1.disable', JSON.stringify({ name: this.warmwater }));
      await this.update({
        stateFlags: (this.stateFlags &= ~WARM_WATER_ON)
      });
    }
    if ((this.stateFlags & HEAT_EXCHANGER_ON) === HEAT_EXCHANGER_ON) {
      winston.info(this.name + ' is in error - disabling heat exchanger');
      mq.send(
        'heatexchanger.v1.set',
        JSON.stringify({ name: this.heatexchanger, value: 'off' })
      );
      await this.update({
        stateFlags: (this.stateFlags &= ~HEAT_EXCHANGER_ON)
      });
    }
    if (this.requestedMode !== 'off') {
      await this.update({
        requestedMode: 'off'
      });
    }
  };

  MashTun.prototype.checkError = function(ignoredStates) {
    let errorFlags = this.errorFlags;
    errorFlags &= ~ignoredStates;
    let ret = String(errorFlags) !== String(0);
    return ret;
  };

  MashTun.prototype.runOff = async function(firstRun) {
    if (firstRun) {
      await this.update({
        errorFlags: this.errorFlags & (FLOW_ERROR | HEAT_EXCHANGER_ERROR),
        mode: 'off'
      });
    }
    if ((this.stateFlags & PUMP_ON) === PUMP_ON) {
      winston.info(this.name + ' is set to OFF - disabling pump ' + this.stateFlags);
      mq.send('pump.v1.set', JSON.stringify({ name: this.pump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~PUMP_ON)
      });
    }
    if ((this.stateFlags & HEATERS_ON) === HEATERS_ON) {
      winston.info(this.name + ' is set to OFF - disabling heaters ' + this.stateFlags);
      mq.send('heater.v1.set', JSON.stringify({ name: this.element1, value: false }));
      mq.send('heater.v1.set', JSON.stringify({ name: this.element2, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~HEATERS_ON)
      });
    }
    if ((this.stateFlags & WARM_WATER_ON) === WARM_WATER_ON) {
      winston.info(
        this.name + ' is set to OFF - disabling warm water ' + this.stateFlags
      );
      mq.send('hotwater.v1.set', JSON.stringify({ name: this.warmwater, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~WARM_WATER_ON)
      });
    }
    if ((this.stateFlags & HEAT_EXCHANGER_ON) === HEAT_EXCHANGER_ON) {
      winston.info(
        this.name + ' is set to OFF - disabling heat exchanger ' + this.stateFlags
      );
      mq.send(
        'heatexchanger.v1.set',
        JSON.stringify({ name: this.heatexchanger, value: 'off' })
      );
      await this.update({
        stateFlags: (this.stateFlags &= ~HEAT_EXCHANGER_ON)
      });
    }
  };

  MashTun.prototype.runDisabled = async function(firstRun) {
    if (firstRun) {
      await this.update({
        errorFlags: this.errorFlags & (FLOW_ERROR | HEAT_EXCHANGER_ERROR)
      });
    }
    if ((this.stateFlags & PUMP_ON) === PUMP_ON) {
      winston.info(this.name + ' is disabled - disabling pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.pump, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~PUMP_ON)
      });
    }
    if ((this.stateFlags & HEATERS_ON) === HEATERS_ON) {
      winston.info(this.name + ' is disabled - disabling heaters');
      mq.send('heater.v1.set', JSON.stringify({ name: this.element1, value: false }));
      mq.send('heater.v1.set', JSON.stringify({ name: this.element2, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~HEATERS_ON)
      });
    }
    if ((this.stateFlags & WARM_WATER_ON) === WARM_WATER_ON) {
      winston.info(this.name + ' is disabled - disabling warm water');
      mq.send('hotwater.v1.set', JSON.stringify({ name: this.warmwater, value: false }));
      await this.update({
        stateFlags: (this.stateFlags &= ~WARM_WATER_ON)
      });
    }
    if ((this.stateFlags & HEAT_EXCHANGER_ON) === HEAT_EXCHANGER_ON) {
      winston.info(this.name + ' is disabled - disabling heat exchanger');
      mq.send(
        'heatexchanger.v1.set',
        JSON.stringify({ name: this.heatexchanger, value: 'off' })
      );
      await this.update({
        stateFlags: (this.stateFlags &= ~HEAT_EXCHANGER_ON)
      });
    }
  };

  MashTun.prototype.runHeatup = async function(firstRun) {
    if (firstRun) {
      winston.info(this.name + ' is set to heatup and not running - enabling pump');
      setTimeout(MashTun.timeoutFlow, 5000, this);
      mq.send('pump.v1.set', JSON.stringify({ name: this.pump, value: true }));
      await this.update({
        stateFlags: (this.stateFlags |= PUMP_ON | PUMP_REQUESTED)
      });
    } else if (
      (this.stateFlags & PUMP_REQUESTED) === PUMP_REQUESTED &&
      (this.errorFlags & FLOW_ERROR) === FLOW_ERROR
    ) {
      winston.info(this.name + ' is waiting for pump to kick in, ignoring errors');
    } else if (
      (this.stateFlags & PUMP_ON) === PUMP_ON &&
      (this.errorFlags & FLOW_ERROR) === 0
    ) {
      winston.silly(this.name + ' is in normal warup mode');
      if (this.value < this.requestedValue - this.tolerance) {
        if ((this.stateFlags & HEATERS_ON) === 0) {
          winston.info(
            this.name +
              ' is not in range: ' +
              this.value +
              '(' +
              this.requestedValue +
              '/' +
              this.tolerance +
              ') - enabling heaters'
          );
          mq.send('heater.v1.set', JSON.stringify({ name: this.element1, value: true }));
          mq.send('heater.v1.set', JSON.stringify({ name: this.element2, value: true }));
          await this.update({ stateFlags: (this.stateFlags |= HEATERS_ON) });
        }
      } else if (
        (this.stateFlags & HEATERS_ON) === HEATERS_ON &&
        this.value >= this.requestedValue
      ) {
        winston.info(
          this.name +
            ' is in range: ' +
            this.value +
            '(' +
            this.requestedValue +
            '/' +
            this.tolerance +
            ') - disabling heaters'
        );
        mq.send('heater.v1.set', JSON.stringify({ name: this.element1, value: false }));
        mq.send('heater.v1.set', JSON.stringify({ name: this.element2, value: false }));
        await this.update({ stateFlags: (this.stateFlags &= ~HEATERS_ON) });
      } else {
        winston.silly('All is well');
      }
    } else {
      await this.handleError();
    }
  };

  MashTun.prototype.checkTemperatures = async function() {
    if (this.value < this.requestedValue - this.tolerance) {
      if ((this.stateFlags & HEAT_EXCHANGER_ON) === 0) {
        winston.info(
          this.name +
            ' is not in range: ' +
            this.value +
            '(' +
            this.requestedValue +
            '/' +
            this.tolerance +
            ') - enabling heat exchanger'
        );
        setTimeout(MashTun.timeoutHeatExchanger, 15000, this);
        mq.send(
          'heatexchanger.v1.set',
          JSON.stringify({ name: this.heatexchanger, value: 'warm' })
        );
        await this.update({
          stateFlags: (this.stateFlags |= HEAT_EXCHANGER_ON | HEAT_EXCHANGER_REQUESTED)
        });
      }
    } else if (
      (this.stateFlags & HEAT_EXCHANGER_ON) === HEAT_EXCHANGER_ON &&
      this.value >= this.requestedValue
    ) {
      winston.info(
        this.name +
          ' is in range: ' +
          this.value +
          '(' +
          this.requestedValue +
          '/' +
          this.tolerance +
          ') - disabling heat exchanger'
      );
      mq.send(
        'heatexchanger.v1.set',
        JSON.stringify({ name: this.heatexchanger, value: 'off' })
      );
      await this.update({ stateFlags: (this.stateFlags &= ~HEAT_EXCHANGER_ON) });
    }
  };

  MashTun.prototype.runMash = async function(firstRun) {
    if (firstRun) {
      winston.info(this.name + ' is set to mash and not running - enabling warm water');
      mq.send(
        'hotwater.v1.set',
        JSON.stringify({ name: this.warmwater, value: this.requestedValue + 5 })
      );
      mq.send('hotwater.v1.enable', JSON.stringify({ name: this.warmwater }));
      await this.update({
        stateFlags: (this.stateFlags |= WARM_WATER_ON)
      });
    }
    if (
      (this.stateFlags & PUMP_REQUESTED) === 0 &&
      (this.stateFlags & PUMP_SLEEP_FINISHED) === PUMP_SLEEP_FINISHED
    ) {
      winston.info(this.name + ' is set to mash and finished sleeping - enabling pump');
      setTimeout(MashTun.timeoutFlow, 5000, this);
      mq.send('pump.v1.enable', JSON.stringify({ name: this.pump }));
      await this.update({
        stateFlags: (this.stateFlags |= PUMP_ON | PUMP_REQUESTED) & ~PUMP_SLEEP_FINISHED
      });
    } else if (
      (this.stateFlags & PUMP_REQUESTED) === PUMP_REQUESTED &&
      (this.errorFlags & FLOW_ERROR) === FLOW_ERROR
    ) {
      winston.info(this.name + ' is waiting for pump to kick in, ignoring errors');
    } else if (
      (this.stateFlags & HEAT_EXCHANGER_REQUESTED) === HEAT_EXCHANGER_REQUESTED &&
      (this.errorFlags & HEAT_EXCHANGER_ERROR) === HEAT_EXCHANGER_ERROR
    ) {
      winston.info(
        this.name + ' is waiting for heat exchanger to kick in, ignoring errors'
      );
    } else if (
      (this.stateFlags & PUMP_ON) === PUMP_ON &&
      (this.stateFlags & PUMP_SLEEP) === PUMP_SLEEP
    ) {
      winston.silly(this.name + ' is pumping in mash mode - sleep has been requested');
      mq.send('pump.v1.disable', JSON.stringify({ name: this.pump }));
      await this.update({
        stateFlags: (this.stateFlags &= PUMP_ON)
      });
      await this.checkTemperatures();
    } else if (
      (this.stateFlags & PUMP_ON) === PUMP_ON &&
      (this.errorFlags & FLOW_ERROR) === 0
    ) {
      winston.silly(this.name + ' is pumping in mash mode');
      await this.checkTemperatures();
    } else if (
      (this.stateFlags & PUMP_SLEEP) === PUMP_SLEEP &&
      (this.errorFlags & FLOW_ERROR) === FLOW_ERROR
    ) {
      winston.silly(this.name + ' is sleeping in mash mode');
      await this.checkTemperatures();
    } else {
      await this.handleError();
    }
  };

  MashTun.prototype.process = async function(instance, options) {
    if (this.enabled) {
      let firstRun =
        options.fields.indexOf('requestedMode') !== -1 ||
        options.fields.indexOf('enabled') !== -1;
      winston.info('First run: ' + firstRun);
      switch (this.requestedMode) {
        case 'off': {
          await this.runOff(firstRun);
          break;
        }
        case 'heatup': {
          await this.runHeatup(firstRun);
          break;
        }
        case 'mash': {
          await this.runMash(firstRun);
          break;
        }
        default: {
          winston.error('Unknown mashtun mode: ' + this.requestedMode);
        }
      }
    } else {
      await this.runDisabled();
    }
  };

  MashTun.timeoutFlow = async function(instance) {
    winston.info(instance.name + ' marking flow timeout');
    instance = await MashTun.lockByModel(instance);
    await instance.update({ stateFlags: (instance.stateFlags &= ~PUMP_REQUESTED) });
    MashTun.unlock(instance);
  };

  MashTun.timeoutHeatExchanger = async function(instance) {
    winston.info(instance.name + ' marking heatexchanger timeout');
    instance = await MashTun.lockByModel(instance);
    await instance.update({
      stateFlags: (instance.stateFlags &= ~HEAT_EXCHANGER_REQUESTED)
    });
    MashTun.unlock(instance);
  };

  MashTun.pumpSleep = async function(instance) {
    winston.info(instance.name + ' pump sleep toggle');
    instance = await MashTun.lockByModel(instance);
    if (instance.mode !== 'mash') {
      if ((instance.stateFlags & PUMP_SLEEP_FINISHED) === 0) {
        await instance.update({
          stateFlags: (instance.stateFlags |= PUMP_SLEEP_FINISHED)
        });
      }
      setTimeout(MashTun.pumpSleep, 40000, instance);
    } else if ((instance.stateFlags & PUMP_SLEEP) === PUMP_SLEEP) {
      await instance.update({
        stateFlags: (instance.stateFlags &= ~PUMP_SLEEP) | PUMP_SLEEP_FINISHED
      });
      setTimeout(MashTun.pumpSleep, 40000, instance);
    } else {
      await instance.update({
        stateFlags: (instance.stateFlags &= ~PUMP_SLEEP_FINISHED) | PUMP_SLEEP
      });
      setTimeout(MashTun.pumpSleep, 20000, instance);
    }
    MashTun.unlock(instance);
  };

  MashTun.bootstrap = async function() {
    let mashtuns = await MashTun.findAll();
    if (mashtuns !== null) {
      for (var i = 0; i < mashtuns.length; i++) {
        mashtuns[i].bootstrap();
      }
    }
  };

  MashTun.prototype.bootstrap = async function() {
    mq.send('heater.v1.getcurrentvalue', JSON.stringify({ name: this.element1 }));
    mq.send('heater.v1.getcurrentvalue', JSON.stringify({ name: this.element2 }));
    mq.send('heater.v1.warmwater', JSON.stringify({ name: this.warmwater }));
    mq.send('heater.v1.manifold', JSON.stringify({ name: this.manifold }));
    mq.send('flow.v1.getcurrentvalue', JSON.stringify({ name: this.flow }));
    mq.send('pump.v1.getcurrentvalue', JSON.stringify({ name: this.pump }));
    mq.send('temperature.v1.getcurrentvalue', JSON.stringify({ name: this.temperature }));
    setTimeout(MashTun.pumpSleep, 20000, this);
  };

  lockutils.lockHook(MashTun);

  return MashTun;
};
