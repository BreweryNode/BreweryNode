const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor, commonmodels.mutator];

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Valve',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Valve = defineTable(sequelize, DataTypes);
  functions.defineDTO(Valve, extraModels);
  functions.defineVersions(Valve, extraModels);
  functions.addMessageHandlers(Valve, extraModels);

  Valve.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Valve.messageHandlers[key](dto);
  };

  Valve.doCompare = functions.booleanCompare;

  lockutils.lockHook(Valve);

  return { single: Valve };
};
