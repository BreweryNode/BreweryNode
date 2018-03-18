const logutil = require('../logutil');

const dto = require('dto');
const Version = require('sequelize-version');
const winston = require('winston');

function defineTable(sequelize, DataTypes, config, extraModels) {
  let fields = config.fields;
  if (fields === undefined) {
    fields = {};
  }
  for (let i = 0; i < extraModels.length; i++) {
    extraModels[i].getFields(sequelize, DataTypes, config, fields);
  }

  let model = sequelize.define(config.name, fields);
  for (let i = 0; i < extraModels.length; i++) {
    extraModels[i].addMethods(model, config);
  }
  for (let i = 0; i < extraModels.length; i++) {
    extraModels[i].addHooks(model, config);
  }
  return model;
}

function defineDTO(model, extraModels) {
  let dtoFields = [];

  for (let i = 0; i < extraModels.length; i++) {
    extraModels[i].getDTOFields(dtoFields);
  }

  model.prototype.toDTO = function() {
    return dto.take.only(this.dataValues, dtoFields);
  };
}

function defineVersions(model, extraModels) {
  let versionedFields = [];

  for (let i = 0; i < extraModels.length; i++) {
    extraModels[i].getVersionedFields(versionedFields);
  }

  let difference = Object.keys(model.rawAttributes).filter(
    x => !versionedFields.includes(x)
  );

  const historyOptions = { prefix: '_', suffix: 'History', exclude: difference };
  (() => new Version(model, historyOptions))();
}

function addMessageHandlers(model, extraModels) {
  let messageHandlers = {};

  for (let i = 0; i < extraModels.length; i++) {
    extraModels[i].addMessageHandlers(model, messageHandlers);
  }

  model.messageHandlers = messageHandlers;
}

function numericCompare(val1, val2) {
  winston.silly('Numeric comparing ' + val1 + ' to: ' + val2);
  return Number(val1) === Number(val2);
}

function booleanCompare(val1, val2) {
  winston.silly(
    'Boolean comparing ' + val1 + ' to: ' + val2 + ' = ' + (String(val1) === String(val2))
  );
  return String(val1) === String(val2);
}

module.exports = {
  defineTable: defineTable,
  defineDTO: defineDTO,
  defineVersions: defineVersions,
  numericCompare: numericCompare,
  booleanCompare: booleanCompare,
  addMessageHandlers: addMessageHandlers
};
