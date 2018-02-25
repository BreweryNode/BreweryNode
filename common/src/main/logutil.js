const mq = require('./mq');
const stackTrace = require('stack-trace');

exports.log = function(level, message) {
  let lLog = {};
  lLog.level = level;
  lLog.message = message;
  let trace = stackTrace.get()[2];
  let filename = trace.getFileName().split('/src/main');
  let modulename = filename[0].slice(filename[0].lastIndexOf('/') + 1);
  lLog.source = modulename + ':' + filename[1].slice(1) + ':' + trace.getLineNumber();
  console.log(JSON.stringify(lLog));
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
