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
  models.Heater.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lHeater => {
      if (lHeater === null) {
        models.Heater.create(lDTO)
          .then(() => {
            logutil.info('Created heater: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating heater:\n' + err);
          });
      } else {
        logutil.warn('Heater already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving heater:\n' + err);
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
  models.Heater.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lHeater => {
      if (lHeater === null) {
        logutil.warn('Unknown heater: ' + lDTO.name);
      } else {
        if (lHeater.value !== lDTO.value) {
          lHeater.update({ value: lDTO.value });
          mq.send('heater.v1.valuechanged', lHeater.toDTO());
        }
        if (lDTO.value !== lHeater.requestedValue) {
          logutil.info(
            lDTO.name + ' is not in requested state: ' + lDTO.value + ' - changing'
          );
          mq.send('heater.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
        }
      }
    })
    .catch(err => {
      logutil.error('Error saving heater:\n' + err);
    });
}

function handleSet(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (
    !Object.prototype.hasOwnProperty.call(lDTO, 'name') ||
    !Object.prototype.hasOwnProperty.call(lDTO, 'value')
  ) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Heater.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lHeater => {
      if (lHeater === null) {
        logutil.warn('Unknown heater: ' + lDTO.name);
      } else if (lHeater.value !== lDTO.requestedValue) {
        lHeater.update({ requestedValue: lDTO.value });
        mq.send('heater.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
      }
    })
    .catch(err => {
      logutil.error('Error saving heater:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Heater.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lHeater => {
      if (lHeater === null) {
        logutil.warn('Unknown heater: ' + lDTO.name);
      } else {
        mq.send('heater.v1.valuechanged', lHeater.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting heater:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Heater.findAll({})
    .then(lHeaters => {
      if (lHeaters === null) {
        logutil.warn('No heaters');
      } else {
        for (var i = 0; i < lHeaters.length; i++) {
          mq.send('heater.v1.valuechanged', lHeaters[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting heaters:\n' + err);
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
    case 'set': {
      handleSet(message);
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
      logutil.warn('Unknown heater nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering heater handlers');
  return mq.recv('heater', 'heater.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('heater.v1.createnew', JSON.stringify({ name: 'Warm Water' }));
  mq.send('heater.v1.createnew', JSON.stringify({ name: 'Boiler 1' }));
  mq.send('heater.v1.createnew', JSON.stringify({ name: 'Boiler 2' }));
}

main();
