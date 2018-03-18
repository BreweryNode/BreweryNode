const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor];

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Bubbler',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Bubbler = defineTable(sequelize, DataTypes);
  functions.defineDTO(Bubbler, extraModels);
  functions.defineVersions(Bubbler, extraModels);
  functions.addMessageHandlers(Bubbler, extraModels);

  Bubbler.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Bubbler.messageHandlers[key](dto);
  };

  Bubbler.doCompare = functions.numericCompare;

  lockutils.lockHook(Bubbler);

  return { single: Bubbler };
};
