const Promise = require('bluebird');
var models;
let mq = require('brewerynode-common').mq;
const winston = require('winston');

function startDB() {
  return new Promise(function(resolve, reject) {
    models = require('./models');
    winston.silly('Syncing database');
    models.sequelize
      .sync({ force: true })
      .then(() => {
        winston.silly("Database sync'd");
        resolve();
      })
      .catch(err => {
        winston.warn(err);
        reject(err);
      });
  });
}

function startMQ() {
  return new Promise(function(resolve, reject) {
    winston.info('Connecting to MQ');
    mq
      .connect(process.env.MQ_ADDRESS, 'amq.topic')
      .then(() => {
        winston.info('MQ Connected');
        resolve();
      })
      .catch(err => {
        winston.warn(err);
        reject(err);
      });
  });
}

async function main() {
  winston.info('Starting');
  await startMQ();
  await startDB();
  winston.info('Starting handlers');
  require('./handlers');
  winston.info('Brewery server started');
}

const console = new winston.transports.Console({ level: 'silly' });
winston.add(console);
main();
