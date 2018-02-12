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
    models.Bubbler.findOne({
      where: {
        name: lDTO.name
      }
    })
      .then(lBubbler => {
        if (lBubbler === null) {
          logutil.warn('Unknown bubbler: ' + lDTO.name);
          reject();
        } else {
          lBubbler.update({
            value: Number(lDTO.value) + Number(lBubbler.value)
          });
          mq.send('bubbler.v1.valuechanged', lBubbler.toDTO());
          resolve();
        }
      })
      .catch(err => {
        logutil.error('Error saving bubble:\n' + JSON.stringify(err));
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
        return Promise.all([mq.recv('bubbler', 'bubbler.v1', true, handleNewReading)]);
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

function addBubbler(pBubbler) {
  return new Promise(function(resolve, reject) {
    models.Bubbler.create(pBubbler)
      .then(() => {
        logutil.info('Created bubbler: ' + pBubbler.name);
        resolve();
      })
      .catch(err => {
        logutil.error('Error creating bubbler:\n' + err);
        reject(err);
      });
  });
}

async function main() {
  console.log('Starting');
  await startMQ();
  await startDB();
  logutil.info('Bubbler server started');

  addBubbler({ name: 'Fermenter' })
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
