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
  models.Level.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lLevel => {
      if (lLevel === null) {
        models.Level.create(lDTO)
          .then(() => {
            logutil.info('Created level: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating level:\n' + err);
          });
      } else {
        logutil.warn('Level already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving level:\n' + err);
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
  models.Level.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lLevel => {
      if (lLevel === null) {
        logutil.warn('Unknown level: ' + lDTO.name);
      } else if (lLevel.value !== lDTO.value) {
        lLevel.update({ value: lDTO.value });
        mq.send('level.v1.valuechanged', lLevel.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error saving level:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Level.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lLevel => {
      if (lLevel === null) {
        logutil.warn('Unknown level: ' + lDTO.name);
      } else {
        mq.send('level.v1.valuechanged', lLevel.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting level:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Level.findAll({})
    .then(lLevels => {
      if (lLevels === null) {
        logutil.warn('No levels');
      } else {
        for (var i = 0; i < lLevels.length; i++) {
          mq.send('level.v1.valuechanged', lLevels[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting levels:\n' + err);
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
      logutil.warn('Unknown level nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering level handlers');
  return mq.recv('level', 'level.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('level.v1.createnew', JSON.stringify({ name: 'Warm Water' }));
  mq.send('level.v1.createnew', JSON.stringify({ name: 'Cold Water' }));
}

main();
