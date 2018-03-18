const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;

let extraModels = [commonmodels.base, commonmodels.sensor, commonmodels.mutator];
// FLAGS FOR THE IN AND OUT STORED IN VALUE - change to numeric and add enabled commonmodel
function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'ManifoldRoute',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false,
    fields: {
      input: { type: DataTypes.STRING, allowNull: false, unique: true },
      output: { type: DataTypes.STRING, allowNull: false, unique: true }
    }
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let ManifoldRoute = defineTable(sequelize, DataTypes);
  functions.defineDTO(ManifoldRoute, extraModels);
  functions.defineVersions(ManifoldRoute, extraModels);
  functions.addMessageHandlers(ManifoldRoute, extraModels);

  ManifoldRoute.hook('afterUpdate', instance => {
    instance.process();
  });

  ManifoldRoute.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    ManifoldRoute.messageHandlers[key](dto);
  };

  ManifoldRoute.doCompare = functions.booleanCompare;

  ManifoldRoute.prototype.process = async function() {
    if (this.enabled) {
    }
  };

  lockutils.lockHook(ManifoldRoute);

  return { single: ManifoldRoute };
};
