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
  if (
    !Object.prototype.hasOwnProperty.call(lDTO, 'mac') ||
    !Object.prototype.hasOwnProperty.call(lDTO, 'name')
  ) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
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
          })
          .catch(err => {
            logutil.error('Error creating temperature probe:\n' + err);
          });
      } else {
        logutil.warn('Temperature probe already added: ' + lDTO.mac);
      }
    })
    .catch(err => {
      logutil.error('Error saving temperature probe:\n' + err);
    });
}

function handleNewReading(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (
    !Object.prototype.hasOwnProperty.call(lDTO, 'mac') ||
    !Object.prototype.hasOwnProperty.call(lDTO, 'value')
  ) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
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
      } else if (lTemperature.value !== lDTO.value) {
        lTemperature.update({ value: lDTO.value });
        mq.send('temperature.v1.valuechanged', lTemperature.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error saving temperature:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Temperature.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lTemperature => {
      if (lTemperature === null) {
        logutil.warn('Unknown temperature probe: ' + lDTO.mac);
      } else {
        mq.send('temperature.v1.valuechanged', lTemperature.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting temperature:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Temperature.findAll({})
    .then(lTemperatures => {
      if (lTemperatures === null) {
        logutil.warn('No temperature probes');
      } else {
        for (var i = 0; i < lTemperatures.length; i++) {
          mq.send('temperature.v1.valuechanged', lTemperatures[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting temperatures:\n' + err);
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
      logutil.warn('Unknown temperature nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering temperature reading handlers');
  return mq.recv('temperature', 'temperature.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send(
    'temperature.v1.createnew',
    JSON.stringify({ mac: '28ff220b00150208', name: 'Cold Water' })
  );
  mq.send(
    'temperature.v1.createnew',
    JSON.stringify({ mac: '28ff6a02641403ed', name: 'Warm Water' })
  );
  mq.send(
    'temperature.v1.createnew',
    JSON.stringify({ mac: '28ff983d6414031a', name: 'Fermenter' })
  );
}

main();
