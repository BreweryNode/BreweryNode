const Promise = require('bluebird');
var models;
let mq = require('brewerynode-common').mq;
var logutil = require('brewerynode-common').logutil;

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

function addTempertureProbe(pProbe) {
  return new Promise(function(resolve, reject) {
    models.Temperature.create(pProbe)
      .then(() => {
        logutil.info(
          'Created temperature probe: ' + pProbe.name + ' with mac: ' + pProbe.mac
        );
        resolve();
      })
      .catch(err => {
        logutil.error('Error creating temperature probe:\n' + err);
        reject();
      });
  });
}

function handleCreateNew(msg) {
  return new Promise(function(resolve, reject) {
    let lDTO;
    try {
      lDTO = JSON.parse(msg.content.toString());
    } catch (err) {
      logutil.error('Error parsing message:\n' + err);
      reject();
      return;
    }
    if (
      !Object.prototype.hasOwnProperty.call(lDTO, 'mac') ||
      !Object.prototype.hasOwnProperty.call(lDTO, 'name')
    ) {
      logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
      reject();
      return;
    }
    models.Temperature.findOne({
      where: {
        mac: lDTO.mac
      }
    })
      .then(lTemperature => {
        if (lTemperature === null) {
          models.Temperature.create(lDTO)
            .then(() => {
              logutil.info(
                'Created temperature probe: ' + lDTO.name + ' with mac: ' + lDTO.mac
              );
              resolve();
            })
            .catch(err => {
              logutil.error('Error creating temperature probe:\n' + err);
              reject();
            });
        } else {
          logutil.warn('Probe already added: ' + lDTO.mac);
          reject();
        }
      })
      .catch(err => {
        logutil.error('Error saving temperatue:\n' + err);
        reject();
      });
  });
}

function handleNewReading(msg) {
  return new Promise(function(resolve, reject) {
    let lDTO = JSON.parse(msg.content.toString());
    if (
      !Object.prototype.hasOwnProperty.call(lDTO, 'mac') ||
      !Object.prototype.hasOwnProperty.call(lDTO, 'value')
    ) {
      logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
      reject();
      return;
    }
    models.Temperature.findOne({
      where: {
        mac: lDTO.mac
      }
    })
      .then(lTemperature => {
        if (lTemperature === null) {
          logutil.warn('Unknown temperature probe: ' + lDTO.mac);
          reject();
        } else {
          if (lTemperature.value !== lDTO.value) {
            lTemperature.update({ value: lDTO.value });
            mq.send('temperature.v1.valuechanged', lTemperature.toDTO());
          }
          resolve();
        }
      })
      .catch(err => {
        logutil.error('Error saving temperatue:\n' + err);
        reject();
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
        return Promise.all([
          mq.recv('temperature', 'temperature.v1.createnew', handleCreateNew),
          mq.recv('temperature', 'temperature.v1.reading', handleNewReading)
        ]);
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
  await startMQ();
  await startDB();
  logutil.info('Temperature server started');

  Promise.all([
    addTempertureProbe({ mac: '28ff220b00150208', name: 'Cold Water' }),
    addTempertureProbe({ mac: '28ff6a02641403ed', name: 'Warm Water' }),
    addTempertureProbe({ mac: '28ff983d6414031a', name: 'Fermenter' })
  ])
    .then(() => {
      console.log('Test data created');
    })
    .catch(() => {
      console.log('Error during test data creation, could be normal if already created');
    });
}

main();
