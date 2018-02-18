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
  models.Valve.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lValve => {
      if (lValve === null) {
        models.Valve.create(lDTO)
          .then(() => {
            logutil.info('Created valve: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating valve:\n' + err);
          });
      } else {
        logutil.warn('Valve already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving valve:\n' + err);
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
  models.Valve.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lValve => {
      if (lValve === null) {
        logutil.warn('Unknown valve: ' + lDTO.name);
      } else {
        if (lValve.value !== lDTO.value) {
          lValve.update({ value: lDTO.value });
          mq.send('valve.v1.valuechanged', lValve.toDTO());
        }
        if (lDTO.value !== lValve.requestedValue) {
          logutil.info(
            lDTO.name + ' is not in requested state: ' + lDTO.value + ' - changing'
          );
          mq.send('valve.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
        }
      }
    })
    .catch(err => {
      logutil.error('Error saving valve:\n' + err);
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
  models.Valve.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lValve => {
      if (lValve === null) {
        logutil.warn('Unknown valve: ' + lDTO.name);
      } else if (lValve.value !== lDTO.requestedValue) {
        lValve.update({ requestedValue: lDTO.value });
        mq.send('valve.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
      }
    })
    .catch(err => {
      logutil.error('Error saving valve:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Valve.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lValve => {
      if (lValve === null) {
        logutil.warn('Unknown valve: ' + lDTO.name);
      } else {
        mq.send('valve.v1.valuechanged', lValve.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting valve:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Valve.findAll({})
    .then(lValves => {
      if (lValves === null) {
        logutil.warn('No valves');
      } else {
        for (var i = 0; i < lValves.length; i++) {
          mq.send('valve.v1.valuechanged', lValves[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting valves:\n' + err);
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
      logutil.warn('Unknown valve nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering valve handlers');
  return mq.recv('valve', 'valve.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('valve.v1.createnew', JSON.stringify({ name: 'Warm Water Input' }));
  mq.send('valve.v1.createnew', JSON.stringify({ name: 'Warm Water Output' }));
  mq.send('valve.v1.createnew', JSON.stringify({ name: 'Cold Water Input' }));
  mq.send('valve.v1.createnew', JSON.stringify({ name: 'Cold Water Output' }));
  mq.send('valve.v1.createnew', JSON.stringify({ name: 'Mains Water Input' }));
  mq.send('valve.v1.createnew', JSON.stringify({ name: 'Mains Water Output' }));
}

main();
