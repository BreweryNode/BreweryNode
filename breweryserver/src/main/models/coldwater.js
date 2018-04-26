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
const COOLER_ON = 1;
const LEVEL_ERROR = 1;

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'ColdWater',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0,
    fields: {
      cooler: { type: DataTypes.STRING, allowNull: false, unique: false },
      level: { type: DataTypes.STRING, allowNull: false, unique: false },
      temperature: { type: DataTypes.STRING, allowNull: false, unique: false },
      errorFlags: { type: DataTypes.INTEGER, defaultValue: 0 },
      stateFlags: { type: DataTypes.INTEGER, defaultValue: 0 }
    }
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let ColdWater = defineTable(sequelize, DataTypes);
  functions.defineDTO(ColdWater, extraModels);
  functions.defineVersions(ColdWater, extraModels);
  functions.addMessageHandlers(ColdWater, extraModels);
  functions.addUpdateProcessor(ColdWater);

  ColdWater.doCompare = functions.numericCompare;

  ColdWater.handleMessage = function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    ColdWater.messageHandlers[key](dto);
  };

  ColdWater.handleTemperatureChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let coldWaters = await ColdWater.findAll({
      where: {
        temperature: dto.name
      },
      attributes: ['id']
    });
    if (coldWaters !== null) {
      each(coldWaters, async function(cw) {
        cw = await ColdWater.lockByModel(cw);
        await cw.reading(cw, dto);
        ColdWater.unlock(cw);
      });
    }
  };

  ColdWater.handleLevelChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    let coldWaters = await ColdWater.findAll({
      where: {
        level: dto.name
      },
      attributes: ['id']
    });
    if (coldWaters !== null) {
      each(coldWaters, async function(cw) {
        cw = await ColdWater.lockByModel(cw);
        let current = cw.errorFlags;
        if (dto.value) {
          current &= ~LEVEL_ERROR;
        } else {
          current |= LEVEL_ERROR;
        }
        await cw.update({ errorFlags: current });
        ColdWater.unlock(cw);
      });
    }
  };

  ColdWater.prototype.process = async function() {
    if (this.enabled) {
      if (this.errorFlags > 0) {
        if ((this.stateFlags & COOLER_ON) > 0) {
          winston.info(this.name + ' is in error - disabling cooler');
          mq.send('cooler.v1.set', JSON.stringify({ name: this.cooler, value: false }));
          await this.update({ stateFlags: (this.stateFlags &= ~COOLER_ON) });
        }
      } else if (
        this.stateFlags === 0 &&
        this.value > this.requestedValue + this.tolerance
      ) {
        winston.info(
          this.name +
            ' is not in range: ' +
            this.value +
            '(' +
            this.requestedValue +
            '/' +
            this.tolerance +
            ') - enabling cooler'
        );
        mq.send('cooler.v1.set', JSON.stringify({ name: this.cooler, value: true }));
        await this.update({ stateFlags: (this.stateFlags |= COOLER_ON) });
      } else if ((this.stateFlags & COOLER_ON) > 0 && this.value <= this.requestedValue) {
        winston.info(
          this.name +
            ' is in range: ' +
            this.value +
            '(' +
            this.requestedValue +
            '/' +
            this.tolerance +
            ') - disabling cooler'
        );
        mq.send('cooler.v1.set', JSON.stringify({ name: this.cooler, value: false }));
        await this.update({ stateFlags: (this.stateFlags &= ~COOLER_ON) });
      }
    } else if (this.stateFlags > 0) {
      winston.info('System disabled - disabling cooler');
      mq.send('cooler.v1.set', JSON.stringify({ name: this.cooler, value: false }));
      await this.update({ stateFlags: (this.stateFlags &= ~COOLER_ON) });
    }
  };

  ColdWater.bootstrap = async function() {
    let coldWaters = await ColdWater.findAll();
    if (coldWaters !== null) {
      for (var i = 0; i < coldWaters.length; i++) {
        coldWaters[i].bootstrap();
      }
    }
  };

  ColdWater.prototype.bootstrap = async function() {
    mq.send('cooler.v1.getcurrentvalue', JSON.stringify({ name: this.cooler }));
    mq.send('level.v1.getcurrentvalue', JSON.stringify({ name: this.level }));
    mq.send('temperature.v1.getcurrentvalue', JSON.stringify({ name: this.temperature }));
  };

  lockutils.lockHook(ColdWater);

  return { single: ColdWater };
};
