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
    models.Volume.findOne({
      where: {
        name: lDTO.name
      }
    })
      .then(lVolume => {
        if (lVolume === null) {
          logutil.warn('Unknown volume: ' + lDTO.name);
          reject();
        } else {
          if (lVolume.value != lDTO.value) {
            lVolume.update({ value: lDTO.value });
            mq.send('volume.v1.valuechanged', lVolume.toDTO());
          }
          resolve();
        }
      })
      .catch(err => {
        logutil.error('Error saving volume:\n' + JSON.stringify(err));
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
        return Promise.all([mq.recv('volume', 'volume.v1', true, handleNewReading)]);
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

function addVolume(pVolume) {
  return new Promise(function(resolve, reject) {
    models.Volume.create(pVolume)
      .then(() => {
        logutil.info('Created volume: ' + pVolume.name);
        resolve();
      })
      .catch(err => {
        logutil.error('Error creating volume:\n' + err);
        reject(err);
      });
  });
}

async function main() {
  console.log('Starting');
  await startMQ();
  await startDB();
  logutil.info('Volume server started');

  addVolume({ name: 'Fermenter' })
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
