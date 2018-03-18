const mq = require('../mq');
const winston = require('winston');
const lockutils = require('../lockutils');

exports.getVersionedFields = function(versionedFields) {
  versionedFields.push('requestedValue');
};

exports.getFields = function(sequelize, DataTypes, config, fields) {
  Object.assign(fields, {
    requestedValue: { type: config.valueType, defaultValue: config.defaultValue }
  });
};

exports.getDTOFields = function(dtoFields) {
  dtoFields.push('requestedValue');
};

exports.addMessageHandlers = function(dbClass, messageHandlers) {
  Object.assign(messageHandlers, {
    set: dbClass.requestSet
  });
};

exports.addMethods = function(dbClass, config) {
  dbClass.requestSet = async function(dto) {
    try {
      let record = await dbClass.find(dto, true);
      if (record) {
        await record.requestSet(record, dto);
        lockutils.unlock(record.mutex);
        return record;
      }
      winston.warn('Unknown ' + dbClass.getName() + ': ' + dto.name);
    } catch (err) {
      winston.error('Error model saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.prototype.requestSet = async function(instance, dto) {
    try {
      if (!dbClass.doCompare(instance.requestedValue, dto.value, config.comparison)) {
        await instance.update({ requestedValue: dto.value });
      }
    } catch (err) {
      winston.error('Error instance saving ' + dbClass.getName() + ':\n' + err);
    }
  };
};

exports.addHooks = function(dbClass, config) {
  dbClass.hook('afterUpdate', (instance, options) => {
    if (options.fields.indexOf('requestedValue') !== -1) {
      if (
        !dbClass.doCompare(instance.requestedValue, instance.value, config.comparison)
      ) {
        mq.send(
          dbClass.getName().toLowerCase() + '.' + instance.name + '.set',
          JSON.stringify({ value: instance.requestedValue })
        );
      }
    }
  });
};
