const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor];

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Flow',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Flow = defineTable(sequelize, DataTypes);
  functions.defineDTO(Flow, extraModels);
  functions.defineVersions(Flow, extraModels);
  functions.addMessageHandlers(Flow, extraModels);

  Flow.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Flow.messageHandlers[key](dto);
  };

  Flow.doCompare = functions.booleanCompare;

  lockutils.lockHook(Flow);

  return { single: Flow };
};
