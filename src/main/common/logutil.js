const mq = require('./mq');

exports.log = function(level, message) {
  let lLog = {};
  lLog.level = level;
  lLog.message = message;
  return mq.send('logging.v1.' + level, JSON.stringify(lLog));
};

exports.error = function(message) {
  return exports.log('error', message);
};

exports.warn = function(message) {
  return exports.log('warn', message);
};

exports.info = function(message) {
  return exports.log('info', message);
};

exports.verbose = function(message) {
  return exports.log('verbose', message);
};

exports.debug = function(message) {
  return exports.log('debug', message);
};

exports.silly = function(message) {
  return exports.log('silly', message);
};
