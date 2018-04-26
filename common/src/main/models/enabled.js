const mq = require('../mq');
const winston = require('winston');
const functions = require('./functions');

exports.getVersionedFields = function(versionedFields) {
  versionedFields.push('enabled');
};

exports.getFields = function(sequelize, DataTypes, config, fields) {
  Object.assign(fields, {
    enabled: { type: DataTypes.BOOLEAN, defaultValue: false }
  });
};

exports.getDTOFields = function(dtoFields) {
  dtoFields.push('enabled');
};

exports.addMessageHandlers = function(dbClass, messageHandlers) {
  Object.assign(messageHandlers, {
    enable: dbClass.enable,
    disable: dbClass.disable,
    setState: dbClass.setState,
    statechanged: function() {}
  });
};

exports.addMethods = function(dbClass) {
  dbClass.enable = async function(dto) {
    Object.assign(dto, { enabled: true });
    return dbClass.setState(dto);
  };

  dbClass.disable = async function(dto) {
    Object.assign(dto, { enabled: false });
    return dbClass.setState(dto);
  };

  dbClass.setState = async function(dto) {
    try {
      let record = await dbClass.find(dto, true);
      if (record) {
        await record.setState(record, dto);
        dbClass.unlock(record);
        return record;
      }
      winston.warn('Unknown ' + dbClass.getName() + ': ' + dto.name);
    } catch (err) {
      winston.error('Error saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.prototype.setState = async function(instance, dto) {
    try {
      if (!functions.booleanCompare(instance.enabled, dto.enabled)) {
        await instance.update({ enabled: dto.enabled });
      }
    } catch (err) {
      winston.error('Error saving ' + dbClass.getName() + ':\n' + err);
    }
  };
};

exports.addHooks = function(dbClass) {
  dbClass.hook('afterUpdate', (instance, options) => {
    if (options.fields.indexOf('enabled') !== -1) {
      mq.send(
        dbClass.getName().toLowerCase() + '.v1.statechanged',
        JSON.stringify(instance.toDTO())
      );
    }
  });
};
