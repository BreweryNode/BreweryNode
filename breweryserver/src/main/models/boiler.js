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
  commonmodels.tolerance
];
const HEATER_ON = 1;
const PUMP_REQUESTED = 2;
const PUMP_ON = 4;
const FLOW_ERROR = 1;

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Boiler',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0,
    fields: {
      element1: { type: DataTypes.STRING, allowNull: false, unique: false },
      element2: { type: DataTypes.STRING, allowNull: false, unique: false },
      flow: { type: DataTypes.STRING, allowNull: false, unique: false },
      pump: { type: DataTypes.STRING, allowNull: false, unique: false },
      temperature: { type: DataTypes.STRING, allowNull: false, unique: false },
      errorFlags: { type: DataTypes.INTEGER, defaultValue: FLOW_ERROR },
      stateFlags: { type: DataTypes.INTEGER, defaultValue: 0 }
    }
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Boiler = defineTable(sequelize, DataTypes);
  functions.defineDTO(Boiler, extraModels);
  functions.defineVersions(Boiler, extraModels);
  functions.addMessageHandlers(Boiler, extraModels);

  Boiler.hook('afterUpdate', (instance, options) => {
    instance.process(instance, options);
  });

  Boiler.doCompare = functions.numericCompare;

  Boiler.handleMessage = function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Boiler.messageHandlers[key](dto);
  };

  Boiler.handleTemperatureChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let boilers = await Boiler.findAll({
      where: {
        temperature: dto.name
      },
      attributes: ['id']
    });
    if (boilers !== null) {
      each(boilers, async function(boiler) {
        boiler = await Boiler.lockByModel(boiler);
        boiler.reading(boiler, dto);
      });
    }
  };

  Boiler.handleFlowChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let boilers = await Boiler.findAll({
      where: {
        temperature: dto.name
      },
      attributes: ['id']
    });
    if (boilers !== null) {
      each(boilers, async function(boiler) {
        boiler = await Boiler.lockByModel(boiler);
        let current = boiler.errorFlags;
        if (dto.value) {
          current &= ~FLOW_ERROR;
        } else {
          current |= FLOW_ERROR;
        }
        await boiler.update({ errorFlags: current });
        lockutils.unlock(boiler.mutex);
      });
    }
  };

  Boiler.prototype.process = async function(instance, options) {
    if (options.fields.indexOf('enabled') !== -1 && this.enabled) {
      if ((this.stateFlags & PUMP_ON) === 0 && (this.stateFlags & PUMP_REQUESTED) === 0) {
        winston.info(this.name + ' is in enabled and not running - enabling pump');
        setTimeout(Boiler.timeoutFlow, 2000, this);
        mq.send('pump.v1.set', JSON.stringify({ name: this.pump, value: true }));
        this.update({ stateFlags: (this.stateFlags |= PUMP_ON | PUMP_REQUESTED) });
        return;
      }
    }
    if (this.enabled) {
      if (this.errorFlags > 0) {
        if ((this.stateFlags & PUMP_REQUESTED) === PUMP_REQUESTED) {
          winston.info(this.name + ' ignomring errors - pumping requested');
          return;
        }
        if ((this.stateFlags & HEATER_ON) === HEATER_ON) {
          winston.info(this.name + ' is in error - disabling heaters');
          mq.send('heater.v1.set', JSON.stringify({ name: this.element1, value: false }));
          mq.send('heater.v1.set', JSON.stringify({ name: this.element2, value: false }));
          this.update({ stateFlags: (this.stateFlags &= ~HEATER_ON) });
        }
        if ((this.stateFlags & PUMP_ON) === PUMP_ON) {
          winston.info(this.name + ' is in error - disabling pump');
          mq.send('pump.v1.set', JSON.stringify({ name: this.pump, value: false }));
          this.update({ stateFlags: (this.stateFlags &= ~PUMP_ON) });
        }
      } else if ((this.stateFlags & HEATER_ON) === 0) {
        winston.info(this.name + ' is in enabled and pumping - enabling heaters');
        mq.send('heater.v1.set', JSON.stringify({ name: this.element1, value: true }));
        mq.send('heater.v1.set', JSON.stringify({ name: this.element2, value: true }));
        this.update({ stateFlags: (this.stateFlags |= HEATER_ON) });
      }
    } else if ((this.stateFlags & HEATER_ON) === HEATER_ON) {
      winston.info(this.name + ' is disabled - disabling heaters');
      mq.send('heater.v1.set', JSON.stringify({ name: this.element1, value: false }));
      mq.send('heater.v1.set', JSON.stringify({ name: this.element2, value: false }));
      this.update({ stateFlags: (this.stateFlags &= ~HEATER_ON) });
    }
    if ((this.stateFlags & PUMP_ON) === PUMP_ON) {
      winston.info(this.name + ' is disabled - disabling pump');
      mq.send('pump.v1.set', JSON.stringify({ name: this.pump, value: false }));
      this.update({ stateFlags: (this.stateFlags &= ~PUMP_ON) });
    }
  };

  Boiler.timeoutFlow = async function(instance) {
    winston.info(instance.name + ' marking flow timeout');
    instance.update({ stateFlags: (instance.stateFlags &= ~PUMP_REQUESTED) });
  };

  Boiler.bootstrap = async function() {
    let boilers = await Boiler.findAll();
    if (boilers !== null) {
      for (var i = 0; i < boilers.length; i++) {
        boilers[i].bootstrap();
      }
    }
  };

  Boiler.prototype.bootstrap = async function() {
    mq.send('heater.v1.getcurrentvalue', JSON.stringify({ name: this.element1 }));
    mq.send('heater.v1.getcurrentvalue', JSON.stringify({ name: this.element2 }));
    mq.send('flow.v1.getcurrentvalue', JSON.stringify({ name: this.flow }));
    mq.send('pump.v1.getcurrentvalue', JSON.stringify({ name: this.pump }));
    mq.send('temperature.v1.getcurrentvalue', JSON.stringify({ name: this.temperature }));
  };

  lockutils.lockHook(Boiler);

  return { single: Boiler };
};
