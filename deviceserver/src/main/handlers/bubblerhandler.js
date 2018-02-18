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
  models.Bubbler.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lBubbler => {
      if (lBubbler === null) {
        models.Bubbler.create(lDTO)
          .then(() => {
            logutil.info('Created bubbler: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating bubbler:\n' + err);
          });
      } else {
        logutil.warn('Bubbler already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving bubbler:\n' + err);
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
  models.Bubbler.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lBubbler => {
      if (lBubbler === null) {
        logutil.warn('Unknown bubbler: ' + lDTO.name);
      } else if (lBubbler.value !== lDTO.value) {
        lBubbler.update({ value: lDTO.value });
        mq.send('bubbler.v1.valuechanged', lBubbler.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error saving bubble:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
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
      } else {
        mq.send('bubbler.v1.valuechanged', lBubbler.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting bubbler:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.Bubbler.findAll({})
    .then(lBubblers => {
      if (lBubblers === null) {
        logutil.warn('No bubblers');
      } else {
        for (var i = 0; i < lBubblers.length; i++) {
          mq.send('bubbler.v1.valuechanged', lBubblers[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting bubblers:\n' + err);
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
      logutil.warn('Unknown bubbler nesssage' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering bubbler handlers');
  return mq.recv('bubbler', 'bubbler.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('bubbler.v1.createnew', JSON.stringify({ name: 'Fermenter' }));
}

main();
