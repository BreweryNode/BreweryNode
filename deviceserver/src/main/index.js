var models;
let mq = require('brewerynode-common').mq;
const winston = require('winston');
global.Promise = require('bluebird');

async function startDB() {
  try {
    models = require('./models');
    winston.silly('Syncing database');
    await models.sequelize.sync({ force: true });
    winston.silly("Database sync'd");
  } catch (err) {
    winston.error(err);
  }
}

async function startMQ() {
  try {
    winston.info('Connecting to MQ');
    await mq.connect(process.env.MQ_ADDRESS, 'amq.topic');
    winston.info('MQ Connected');
  } catch (err) {
    winston.error(err);
  }
}

async function main() {
  winston.info('Starting');
  await startMQ();
  await startDB();
  winston.info('Starting handlers');
  require('./handlers');
  winston.info('Reading server started');
}

const console = new winston.transports.Console({ level: 'silly' });
winston.add(console);

process.on('unhandledRejection', (reason, p) => {
  winston.error('Unhandled Rejection at: Promise' + p + 'reason:' + reason);
  // Application specific logging, throwing an error, or other logic here
});

main();
