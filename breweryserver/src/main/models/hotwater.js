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
const LEVEL_ERROR = 1;

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'HotWater',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0,
    fields: {
      heater: { type: DataTypes.STRING, allowNull: false, unique: false },
      level: { type: DataTypes.STRING, allowNull: false, unique: false },
      temperature: { type: DataTypes.STRING, allowNull: false, unique: false },
      errorFlags: { type: DataTypes.INTEGER, defaultValue: 0 },
      stateFlags: { type: DataTypes.INTEGER, defaultValue: 0 }
    }
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let HotWater = defineTable(sequelize, DataTypes);
  functions.defineDTO(HotWater, extraModels);
  functions.defineVersions(HotWater, extraModels);
  functions.addMessageHandlers(HotWater, extraModels);
  functions.addUpdateProcessor(HotWater);

  HotWater.doCompare = functions.numericCompare;

  HotWater.handleMessage = function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    HotWater.messageHandlers[key](dto);
  };

  HotWater.handleTemperatureChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let hotWaters = await HotWater.findAll({
      where: {
        temperature: dto.name
      },
      attributes: ['id']
    });
    if (hotWaters !== null) {
      each(hotWaters, async function(hw) {
        hw = await HotWater.lockByModel(hw);
        await hw.reading(hw, dto);
        HotWater.unlock(hw);
      });
    }
  };

  HotWater.handleLevelChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let hotWaters = await HotWater.findAll({
      where: {
        level: dto.name
      },
      attributes: ['id']
    });
    if (hotWaters !== null) {
      each(hotWaters, async function(hw) {
        hw = await HotWater.lockByModel(hw);
        let current = hw.errorFlags;
        if (dto.value) {
          current &= ~LEVEL_ERROR;
        } else {
          current |= LEVEL_ERROR;
        }
        await hw.update({ errorFlags: current });
        HotWater.unlock(hw);
      });
    }
  };

  HotWater.prototype.process = async function() {
    if (this.enabled) {
      if (this.errorFlags > 0) {
        if ((this.stateFlags & HEATER_ON) > 0) {
          winston.info(this.name + ' is in error - disabling heater');
          mq.send('heater.v1.set', JSON.stringify({ name: this.heater, value: false }));
          await this.update({ stateFlags: (this.stateFlags &= ~HEATER_ON) });
        }
      } else if (
        this.stateFlags === 0 &&
        this.value < this.requestedValue - this.tolerance
      ) {
        winston.info(
          this.name +
            ' is not in range: ' +
            this.value +
            '(' +
            this.requestedValue +
            '/' +
            this.tolerance +
            ') - enabling heater'
        );
        mq.send('heater.v1.set', JSON.stringify({ name: this.heater, value: true }));
        await this.update({ stateFlags: (this.stateFlags |= HEATER_ON) });
      } else if ((this.stateFlags & HEATER_ON) > 0 && this.value >= this.requestedValue) {
        winston.info(
          this.name +
            ' is in range: ' +
            this.value +
            '(' +
            this.requestedValue +
            '/' +
            this.tolerance +
            ') - disabling heater'
        );
        mq.send('heater.v1.set', JSON.stringify({ name: this.heater, value: false }));
        await this.update({ stateFlags: (this.stateFlags &= ~HEATER_ON) });
      }
    } else if (this.stateFlags > 0) {
      winston.info('System disabled - disabling heater');
      mq.send('heater.v1.set', JSON.stringify({ name: this.heater, value: false }));
      await this.update({ stateFlags: (this.stateFlags &= ~HEATER_ON) });
    }
  };

  HotWater.bootstrap = async function() {
    let hotWaters = await HotWater.findAll();
    if (hotWaters !== null) {
      for (var i = 0; i < hotWaters.length; i++) {
        hotWaters[i].bootstrap();
      }
    }
  };

  HotWater.prototype.bootstrap = async function() {
    mq.send('heater.v1.getcurrentvalue', JSON.stringify({ name: this.heater }));
    mq.send('level.v1.getcurrentvalue', JSON.stringify({ name: this.level }));
    mq.send('temperature.v1.getcurrentvalue', JSON.stringify({ name: this.temperature }));
  };

  lockutils.lockHook(HotWater);

  return { single: HotWater };
};
