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
  models.Cooler.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lCooler => {
      if (lCooler === null) {
        models.Cooler.create(lDTO)
          .then(() => {
            logutil.info('Created cooler: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating cooler:\n' + err);
          });
      } else {
        logutil.warn('Cooler already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving cooler:\n' + err);
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
  models.Cooler.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lCooler => {
      if (lCooler === null) {
        logutil.warn('Unknown cooler: ' + lDTO.name);
      } else {
        if (lCooler.value !== lDTO.value) {
          lCooler.update({ value: lDTO.value });
          mq.send('cooler.v1.valuechanged', lCooler.toDTO());
        }
        if (lDTO.value !== lCooler.requestedValue) {
          logutil.info(
            lDTO.name + ' is not in requested state: ' + lDTO.value + ' - changing'
          );
          mq.send('cooler.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
        }
      }
    })
    .catch(err => {
      logutil.error('Error saving cooler:\n' + err);
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
  models.Cooler.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lCooler => {
      if (lCooler === null) {
        logutil.warn('Unknown cooler: ' + lDTO.name);
      } else if (lCooler.value !== lDTO.requestedValue) {
        lCooler.update({ requestedValue: lDTO.value });
        mq.send('cooler.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
      }
    })
    .catch(err => {
      logutil.error('Error saving cooler:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Cooler.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lCooler => {
      if (lCooler === null) {
        logutil.warn('Unknown cooler: ' + lDTO.name);
      } else {
        mq.send('cooler.v1.valuechanged', lCooler.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting cooler:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Cooler.findAll({})
    .then(lCoolers => {
      if (lCoolers === null) {
        logutil.warn('No coolers');
      } else {
        for (var i = 0; i < lCoolers.length; i++) {
          mq.send('cooler.v1.valuechanged', lCoolers[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting coolers:\n' + err);
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
      logutil.warn('Unknown cooler nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering cooler handlers');
  return mq.recv('cooler', 'cooler.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('cooler.v1.createnew', JSON.stringify({ name: 'Freezer' }));
}

main();
