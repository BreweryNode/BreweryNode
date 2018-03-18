const mq = require('../mq');
const winston = require('winston');
const lockutils = require('../lockutils');

exports.getVersionedFields = function(versionedFields) {
  versionedFields.push('value');
};

exports.getFields = function(sequelize, DataTypes, config, fields) {
  Object.assign(fields, {
    value: { type: config.valueType, defaultValue: config.defaultValue }
  });
};

exports.getDTOFields = function(dtoFields) {
  dtoFields.push('name');
  dtoFields.push('value');
};

exports.addMessageHandlers = function(dbClass, messageHandlers) {
  Object.assign(messageHandlers, {
    reading: dbClass.reading,
    getcurrentvalue: dbClass.getCurrentValue,
    valuechanged: function() {}
  });
};

exports.addMethods = function(dbClass, config) {
  dbClass.reading = async function(dto) {
    try {
      let record = await dbClass.find(dto, true);
      if (record) {
        await record.reading(record, dto);
        lockutils.unlock(record.mutex);
      } else {
        winston.warn('Unknown ' + dbClass.getName() + ': ' + dto.name);
      }
    } catch (err) {
      winston.error('Error model saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.getCurrentValue = async function(dto) {
    try {
      let record = await dbClass.find(dto);
      if (record) {
        mq.send(
          dbClass.getName().toLowerCase() + '.v1.valuechanged',
          JSON.stringify(record.toDTO())
        );
      } else {
        winston.warn('Unknown ' + dbClass.getName() + ': ' + dto.name);
      }
    } catch (err) {
      winston.error('Error saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.prototype.reading = async function(instance, dto) {
    try {
      if (!dbClass.doCompare(instance.value, dto.value, config.comparison)) {
        return await instance.update({ value: dto.value });
      }
    } catch (err) {
      winston.error('Error instance saving ' + dbClass.getName() + ':\n' + err);
    }
  };
};

exports.addHooks = function(dbClass) {
  dbClass.hook('afterUpdate', (instance, options) => {
    if (options.fields.indexOf('value') !== -1) {
      mq.send(
        dbClass.getName().toLowerCase() + '.v1.valuechanged',
        JSON.stringify(instance.toDTO())
      );
    }
  });
};
