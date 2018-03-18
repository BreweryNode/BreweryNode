const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor];

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Temperature',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0,
    fields: { mac: { type: DataTypes.STRING, allowNull: false, unique: true } }
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Temperature = defineTable(sequelize, DataTypes);
  functions.defineDTO(Temperature, extraModels);
  functions.defineVersions(Temperature, extraModels);
  functions.addMessageHandlers(Temperature, extraModels);

  Temperature.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Temperature.messageHandlers[key](dto);
  };

  Temperature.findByMac = async function(dto, lock) {
    winston.silly('Searching by mac for: ' + dto.mac);
    if (lock) {
      let record = await Temperature.findOne({
        where: {
          mac: dto.mac
        },
        attributes: ['id']
      });
      if (record) {
        return Temperature.lockById(record.id);
      }
      return null;
    }
    let record = await Temperature.findOne({
      where: {
        id: dto.id
      }
    });
    return record;
  };

  let oldFind = Temperature.find;
  Temperature.find = function(dto, lock) {
    if (Object.prototype.hasOwnProperty.call(dto, 'mac')) {
      return Temperature.findByMac(dto, lock);
    }
    return oldFind(dto, lock);
  };

  Temperature.doCompare = functions.numericCompare;

  lockutils.lockHook(Temperature);

  return { single: Temperature };
};
