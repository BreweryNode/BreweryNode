const mq = require('../mq');
const winston = require('winston');
const lockutils = require('../lockutils');

exports.getVersionedFields = function(versionedFields) {
  versionedFields.push('tolerance');
};

exports.getFields = function(sequelize, DataTypes, config, fields) {
  Object.assign(fields, {
    tolerance: { type: DataTypes.DOUBLE, defaultValue: 0.5 }
  });
};

exports.getDTOFields = function() {};

exports.addMessageHandlers = function(dbClass, messageHandlers) {
  Object.assign(messageHandlers, {
    ontarget: function() {}
  });
};

exports.addMethods = function() {};

exports.addHooks = function(dbClass) {
  dbClass.hook('afterUpdate', (instance, options) => {
    if (options.fields.indexOf('value') !== -1) {
      if (Math.abs(instance.value - instance.requestedValue) > instance.tolerance) {
        mq.send(dbClass.getName().toLowerCase() + '.v1.ontarget', 'false');
      } else {
        mq.send(dbClass.getName().toLowerCase() + '.v1.ontarget', 'true');
      }
    }
  });
};
