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
  models.Flow.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lFlow => {
      if (lFlow === null) {
        models.Flow.create(lDTO)
          .then(() => {
            logutil.info('Created flow: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating flow:\n' + err);
          });
      } else {
        logutil.warn('Flow already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving flow:\n' + err);
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
  models.Flow.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lFlow => {
      if (lFlow === null) {
        logutil.warn('Unknown flow: ' + lDTO.name);
      } else if (lFlow.value !== lDTO.value) {
        lFlow.update({ value: lDTO.value });
        mq.send('flow.v1.valuechanged', lFlow.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error saving flow:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.Flow.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lFlow => {
      if (lFlow === null) {
        logutil.warn('Unknown flow: ' + lDTO.name);
      } else {
        mq.send('flow.v1.valuechanged', lFlow.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting flow:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Flow.findAll({})
    .then(lFlows => {
      if (lFlows === null) {
        logutil.warn('No flows');
      } else {
        for (var i = 0; i < lFlows.length; i++) {
          mq.send('flow.v1.valuechanged', lFlows[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting flows:\n' + err);
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
      logutil.warn('Unknown flow nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering flow handlers');
  return mq.recv('flow', 'flow.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('flow.v1.createnew', JSON.stringify({ name: 'Warm Water' }));
  mq.send('flow.v1.createnew', JSON.stringify({ name: 'Cold Water' }));
  mq.send('flow.v1.createnew', JSON.stringify({ name: 'Boiler' }));
}

main();
