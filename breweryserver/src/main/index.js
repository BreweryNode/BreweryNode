const Promise = require('bluebird');
var models;
let mq = require('brewerynode-common').mq;
var logutil = require('brewerynode-common').logutil;

function startDB() {
  return new Promise(function(resolve, reject) {
    models = require('./models');
    logutil.silly('Syncing database');
    models.sequelize
      .sync({ force: true })
      .then(() => {
        logutil.silly("Database sync'd");
        resolve();
      })
      .catch(err => {
        logutil.warn(err);
        reject(err);
      });
  });
}

function startMQ() {
  return new Promise(function(resolve, reject) {
    console.log('Connecting to MQ');
    mq
      .connect(process.env.MQ_ADDRESS, 'amq.topic')
      .then(() => {
        console.log('MQ Connected');
        resolve();
      })
      .catch(err => {
        console.warn(err);
        reject(err);
      });
  });
}

async function main() {
  console.log('Starting');
  await startMQ();
  await startDB();
  logutil.info('Starting handlers');
  require('./handlers');
  logutil.info('Reading server started');
}

main();
