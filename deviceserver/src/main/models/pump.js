const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor, commonmodels.mutator];

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Pump',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Pump = defineTable(sequelize, DataTypes);
  functions.defineDTO(Pump, extraModels);
  functions.defineVersions(Pump, extraModels);
  functions.addMessageHandlers(Pump, extraModels);

  Pump.handleMessage = async function (msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Pump.messageHandlers[key](dto);
  };

  Pump.doCompare = functions.booleanCompare;

  lockutils.lockHook(Pump);

  return { single: Pump };
};
