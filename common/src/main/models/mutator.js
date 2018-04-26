const mq = require('../mq');
const winston = require('winston');

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

exports.addMethods = function(dbClass) {
  dbClass.requestSet = async function(dto) {
    try {
      let record = await dbClass.find(dto, true);
      if (record) {
        await record.requestSet(record, dto);
        dbClass.unlock(record);
        return record;
      }
      winston.warn('Unknown ' + dbClass.getName() + ': ' + dto.name);
    } catch (err) {
      winston.error('Error model saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.prototype.requestSet = async function(instance, dto) {
    try {
      if (!dbClass.doCompare(instance.requestedValue, dto.value)) {
        await instance.update({ requestedValue: dto.value });
      }
    } catch (err) {
      winston.error('Error instance saving ' + dbClass.getName() + ':\n' + err);
    }
  };
};

exports.addHooks = function(dbClass) {
  dbClass.hook('afterUpdate', (instance, options) => {
    if (options.fields.indexOf('requestedValue') !== -1) {
      if (!dbClass.doCompare(instance.requestedValue, instance.value)) {
        mq.send(
          dbClass.getName().toLowerCase() + '.' + instance.name + '.set',
          JSON.stringify({ value: instance.requestedValue })
        );
      }
    }
  });
};
