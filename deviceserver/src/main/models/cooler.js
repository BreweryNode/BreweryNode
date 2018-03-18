const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor, commonmodels.mutator];

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Cooler',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Cooler = defineTable(sequelize, DataTypes);
  functions.defineDTO(Cooler, extraModels);
  functions.defineVersions(Cooler, extraModels);
  functions.addMessageHandlers(Cooler, extraModels);

  Cooler.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Cooler.messageHandlers[key](dto);
  };

  Cooler.doCompare = functions.booleanCompare;

  lockutils.lockHook(Cooler);

  return { single: Cooler };
};
