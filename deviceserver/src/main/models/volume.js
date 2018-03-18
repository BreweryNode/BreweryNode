const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor];

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Volume',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Volume = defineTable(sequelize, DataTypes);
  functions.defineDTO(Volume, extraModels);
  functions.defineVersions(Volume, extraModels);
  functions.addMessageHandlers(Volume, extraModels);

  Volume.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Volume.messageHandlers[key](dto);
  };

  Volume.doCompare = functions.numericCompare;

  lockutils.lockHook(Volume);

  return { single: Volume };
};
