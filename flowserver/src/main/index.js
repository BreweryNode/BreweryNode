const Promise = require('bluebird');
var models;
const logutil = require('brewerynode-common').logutil;
const mq = require('brewerynode-common').mq;

function startDB() {
  return new Promise(function(resolve, reject) {
    models = require('./models');
    logutil.silly('Syncing database');
    models.sequelize
      .sync({ force: false })
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

function handleNewReading(msg) {
  return new Promise(function(resolve, reject) {
    let lDTO = JSON.parse(msg.content.toString());
    if (!lDTO.hasOwnProperty('name') || !lDTO.hasOwnProperty('value')) {
      logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
      reject();
      return;
    }
    models.Flow.findOne({
      where: {
        name: lDTO.name
      }
    })
      .then(lFlow => {
        if (lFlow === null) {
          logutil.warn('Unknown flow: ' + lDTO.name);
          reject();
        } else {
          if (lFlow.value != lDTO.value) {
            lFlow.update({ value: lDTO.value });
            mq.send('flow.v1.valuechanged', lFlow.toDTO());
          }
          resolve();
        }
      })
      .catch(err => {
        logutil.error('Error saving flow:\n' + JSON.stringify(err));
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
        return Promise.all([mq.recv('flow', 'flow.v1', handleNewReading)]);
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

function addFlow(pFlow) {
  return new Promise(function(resolve, reject) {
    models.Flow.create(pFlow)
      .then(() => {
        logutil.info('Created flow: ' + pFlow.name);
        resolve();
      })
      .catch(err => {
        logutil.error('Error creating flow:\n' + err);
        reject(err);
      });
  });
}

async function main() {
  console.log('Starting');
  await startMQ();
  await startDB();
  logutil.info('Flow server started');

  Promise.all([
    addFlow({ name: 'Warm Water' }),
    addFlow({ name: 'Cold Water' }),
    addFlow({ name: 'Boiler' })
  ])
    .then(() => {
      console.log('Test data created');
    })
    .catch(err => {
      console.log(
        'Error during test data creation, could be normal if already created\n' +
          JSON.stringify(err)
      );
    });
}

main();
