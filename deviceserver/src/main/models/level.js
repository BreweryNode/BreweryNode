const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor];

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Level',
    valueType: DataTypes.BOOLEAN,
    defaultValue: 0
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Level = defineTable(sequelize, DataTypes);
  functions.defineDTO(Level, extraModels);
  functions.defineVersions(Level, extraModels);
  functions.addMessageHandlers(Level, extraModels);

  Level.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Level.messageHandlers[key](dto);
  };

  Level.doCompare = functions.booleanCompare;

  lockutils.lockHook(Level);

  return { single: Level };
};
