const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const models = require('../models');

function handleCreateNew(msg) {
  let lDTO;
  try {
    lDTO = JSON.parse(msg.content.toString());
  } catch (err) {
    logutil.error('Error parsing message:\n' + err);
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Volume.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lVolume => {
      if (lVolume === null) {
        models.Volume.create(lDTO)
          .then(() => {
            logutil.info('Created volume: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating volume:\n' + err);
          });
      } else {
        logutil.warn('Volume already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving volume:\n' + err);
    });
}

function handleNewReading(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (
    !Object.prototype.hasOwnProperty.call(lDTO, 'name') ||
    !Object.prototype.hasOwnProperty.call(lDTO, 'value')
  ) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
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
      } else if (lVolume.value !== lDTO.value) {
        lVolume.update({ value: lDTO.value });
        mq.send('volume.v1.valuechanged', lVolume.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error saving volume:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
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
      } else {
        mq.send('volume.v1.valuechanged', lVolume.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting volume:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Volume.findAll({})
    .then(lVolumes => {
      if (lVolumes === null) {
        logutil.warn('No volumes');
      } else {
        for (var i = 0; i < lVolumes.length; i++) {
          mq.send('volume.v1.valuechanged', lVolumes[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting volumes:\n' + err);
    });
}

function handleMessage(message) {
  switch (message.fields.routingKey.slice(
    message.fields.routingKey.lastIndexOf('.') + 1
  )) {
    case 'createnew': {
      handleCreateNew(message);
      break;
    }
    case 'reading': {
      handleNewReading(message);
      break;
    }
    case 'getcurrent': {
      handleGetCurrent(message);
      break;
    }
    case 'getallcurrent': {
      handleGetAllCurrent(message);
      break;
    }
    default: {
      logutil.warn('Unknown volume nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering volume handlers');
  return mq.recv('volume', 'volume.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('volume.v1.createnew', JSON.stringify({ name: 'Fermenter' }));
}

main();
