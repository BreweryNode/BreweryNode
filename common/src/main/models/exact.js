const mq = require('../mq');

exports.getVersionedFields = function() {};

exports.getFields = function() {};

exports.getDTOFields = function() {};

exports.addMessageHandlers = function(dbClass, messageHandlers) {
  Object.assign(messageHandlers, {
    ontarget: function() {}
  });
};

exports.addMethods = function() {};

exports.addHooks = function(dbClass) {
  dbClass.hook('afterUpdate', (instance, options) => {
    if (
      options.fields.indexOf('value') !== -1 ||
      options.fields.indexOf('requestedValue') !== -1
    ) {
      if (dbClass.doCompare(instance.value, instance.requestedValue)) {
        mq.send(dbClass.getName().toLowerCase() + '.v1.ontarget', 'true');
      } else {
        mq.send(dbClass.getName().toLowerCase() + '.v1.ontarget', 'false');
      }
    }
  });
};
