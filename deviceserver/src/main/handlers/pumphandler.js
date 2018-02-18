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
  models.Pump.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lPump => {
      if (lPump === null) {
        models.Pump.create(lDTO)
          .then(() => {
            logutil.info('Created pump: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating pump:\n' + err);
          });
      } else {
        logutil.warn('Pump already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving pump:\n' + err);
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
  models.Pump.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lPump => {
      if (lPump === null) {
        logutil.warn('Unknown pump: ' + lDTO.name);
      } else {
        if (lPump.value !== lDTO.value) {
          lPump.update({ value: lDTO.value });
          mq.send('pump.v1.valuechanged', lPump.toDTO());
        }
        if (lDTO.value !== lPump.requestedValue) {
          logutil.info(
            lDTO.name + ' is not in requested state: ' + lDTO.value + ' - changing'
          );
          mq.send('pump.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
        }
      }
    })
    .catch(err => {
      logutil.error('Error saving pump:\n' + err);
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
  models.Pump.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lPump => {
      if (lPump === null) {
        logutil.warn('Unknown pump: ' + lDTO.name);
      } else if (lPump.value !== lDTO.requestedValue) {
        lPump.update({ requestedValue: lDTO.value });
        mq.send('pump.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
      }
    })
    .catch(err => {
      logutil.error('Error saving pump:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Pump.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lPump => {
      if (lPump === null) {
        logutil.warn('Unknown pump: ' + lDTO.name);
      } else {
        mq.send('pump.v1.valuechanged', lPump.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting pump:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Pump.findAll({})
    .then(lPumps => {
      if (lPumps === null) {
        logutil.warn('No pumps');
      } else {
        for (var i = 0; i < lPumps.length; i++) {
          mq.send('pump.v1.valuechanged', lPumps[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting pumps:\n' + err);
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
      logutil.warn('Unknown pump nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering pump handlers');
  return mq.recv('pump', 'pump.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('pump.v1.createnew', JSON.stringify({ name: 'Cold Water' }));
  mq.send('pump.v1.createnew', JSON.stringify({ name: 'Warn Water' }));
  mq.send('pump.v1.createnew', JSON.stringify({ name: 'Boiler' }));
  mq.send('pump.v1.createnew', JSON.stringify({ name: 'Agitator' }));
}

main();
