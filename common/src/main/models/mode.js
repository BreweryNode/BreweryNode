const mq = require('../mq');
const winston = require('winston');

exports.getVersionedFields = function(versionedFields) {
  versionedFields.push('mode');
  versionedFields.push('requestedMode');
};

exports.getFields = function(sequelize, DataTypes, config, fields) {
  Object.assign(fields, {
    mode: { type: config.modeType, defaultValue: config.defaultMode },
    requestedMode: { type: config.modeType, defaultValue: config.defaultMode }
  });
};

exports.getDTOFields = function(dtoFields) {
  dtoFields.push('mode');
};

exports.addMessageHandlers = function(dbClass, messageHandlers) {
  Object.assign(messageHandlers, {
    getcurrentmode: dbClass.getCurrentMode,
    setmode: dbClass.requestModeSet,
    modeontarget: function() {},
    modechanged: function() {}
  });
};

exports.addMethods = function(dbClass, config) {
  dbClass.requestModeSet = async function(dto) {
    try {
      let record = await dbClass.find(dto, true);
      if (record) {
        await record.requestModeSet(record, dto);
        dbClass.unlock(record);
        return record;
      }
      winston.warn('Unknown ' + dbClass.getName() + ': ' + dto.name);
    } catch (err) {
      winston.error('Error model saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.prototype.requestModeSet = async function(instance, dto) {
    try {
      if (!dbClass.doCompare(instance.requestedMode, dto.value)) {
        await instance.update({ requestedMode: dto.value });
      }
    } catch (err) {
      winston.error('Error instance saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.modeChanged = async function(dto) {
    try {
      let record = await dbClass.find(dto, true);
      if (record) {
        await record.modeChanged(record, dto);
        dbClass.unlock(record);
      } else {
        winston.warn('Unknown ' + dbClass.getName() + ': ' + dto.name);
      }
    } catch (err) {
      winston.error('Error model saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.getCurrentMode = async function(dto) {
    try {
      let record = await dbClass.find(dto);
      if (record) {
        mq.send(
          dbClass.getName().toLowerCase() + '.v1.modechanged',
          JSON.stringify(record.toDTO())
        );
      } else {
        winston.warn('Unknown ' + dbClass.getName() + ': ' + dto.name);
      }
    } catch (err) {
      winston.error('Error saving ' + dbClass.getName() + ':\n' + err);
    }
  };

  dbClass.prototype.modeChanged = async function(instance, dto) {
    try {
      if (!dbClass.doCompare(instance.mode, dto.mode)) {
        return await instance.update({ value: dto.mode });
      }
    } catch (err) {
      winston.error('Error instance saving ' + dbClass.getName() + ':\n' + err);
    }
  };
};

exports.addHooks = function(dbClass) {
  dbClass.hook('afterUpdate', (instance, options) => {
    if (options.fields.indexOf('mode') !== -1) {
      mq.send(
        dbClass.getName().toLowerCase() + '.v1.modechanged',
        JSON.stringify(instance.toDTO())
      );
    }
  });
  dbClass.hook('afterUpdate', (instance, options) => {
    if (options.fields.indexOf('requestedMode') !== -1) {
      if (dbClass.doCompare(instance.requestedMode, instance.mode)) {
        mq.send(
          dbClass.getName().toLowerCase() + '.v1.modeontarget',
          JSON.stringify(instance.toDTO())
        );
      }
    }
  });
};
