var Promise = require('bluebird');
var models;
var logutil = require('brewerynode-common').logutil;
var winston = require('winston');

function startDB() {
  return new Promise(function(resolve, reject) {
    models = require('./models');
    console.log('Syncing database');
    models.sequelize
      .sync({ force: false })
      .then(() => {
        console.log("Database sync'd");
        resolve();
      })
      .catch(err => {
        console.warn(err);
        reject(err);
      });
  });
}

function handleNewLog(msg) {
  return new Promise(function(resolve, reject) {
    let lLog = JSON.parse(msg.content.toString());
    if (!lLog.hasOwnProperty('message') || !lLog.hasOwnProperty('level')) {
      console.warn('Bad DTO: ' + JSON.stringify(lLog));
      reject();
      return;
    }
    models.Log.create(lLog)
      .then(() => {
        winston.log(lLog.level, lLog.message);
        resolve();
      })
      .catch(err => {
        console.error('Error saving log:\n' + err);
        reject();
      });
  });
}

function startMQ() {
  return new Promise(function(resolve, reject) {
    let mq = require('brewerynode-common').mq;
    console.log('Connecting to MQ');
    mq
      .connect('amqp://localhost', 'amq.topic')
      .then(() => {
        console.log('MQ Connected');
        return Promise.all([mq.recv('logserver', 'logging.v1.#', handleNewLog)]);
      })
      .then(() => {
        console.log('MQ Listening');
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
  await Promise.all([startDB(), startMQ()]);
  logutil.info('Log server started');
}

main();
