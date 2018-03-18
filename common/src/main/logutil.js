const stackTrace = require('stack-trace');
const winston = require('winston');

function getTrace() {
  let trace = stackTrace.get()[3];
  let filename = trace.getFileName().split('/src/main');
  let modulename = filename[0].slice(filename[0].lastIndexOf('/') + 1);
  return modulename + ':' + filename[1].slice(1) + ':' + trace.getLineNumber();
}

function parameterTest(bool) {
  if (bool !== undefined) {
    return true;
  }
  return false;
}

exports.error = async function(err, message) {
  winston.log(
    'error',
    (parameterTest(message) ? message : 'Error') + ':\n' + err + '\nAt:\n' + getTrace()
  );
};

exports.trace = stackTrace.get();
