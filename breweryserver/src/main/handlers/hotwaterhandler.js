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
    !Object.prototype.hasOwnProperty.call(lDTO, 'name') ||
    !Object.prototype.hasOwnProperty.call(lDTO, 'heater') ||
    !Object.prototype.hasOwnProperty.call(lDTO, 'level') ||
    !Object.prototype.hasOwnProperty.call(lDTO, 'temperature')
  ) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.HotWater.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lHotWater => {
      if (lHotWater === null) {
        models.HotWater.create(lDTO)
          .then(() => {
            logutil.info('Created hotwater: ' + lDTO.name);
          })
          .catch(err => {
            logutil.error('Error creating hotwater:\n' + err);
          });
      } else {
        logutil.warn('HotWater already added: ' + lDTO.name);
      }
    })
    .catch(err => {
      logutil.error('Error saving hotwater:\n' + err);
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
  models.HotWater.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lHotWater => {
      if (lHotWater === null) {
        logutil.warn('Unknown hotwater: ' + lDTO.name);
      } else {
        if (lHotWater.value !== lDTO.value) {
          lHotWater.update({ value: lDTO.value });
          mq.send('hotwater.v1.valuechanged', lHotWater.toDTO());
        }
        if (lDTO.value !== lHotWater.requestedValue) {
          logutil.info(
            lDTO.name + ' is not in requested state: ' + lDTO.value + ' - changing'
          );
          mq.send(
            'hotwater.' + lDTO.name + '.set',
            JSON.stringify({ value: lDTO.value })
          );
        }
      }
    })
    .catch(err => {
      logutil.error('Error saving hotwater:\n' + err);
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
  models.HotWater.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lHotWater => {
      if (lHotWater === null) {
        logutil.warn('Unknown hotwater: ' + lDTO.name);
      } else if (lHotWater.value !== lDTO.requestedValue) {
        lHotWater.update({ requestedValue: lDTO.value });
        mq.send('hotwater.' + lDTO.name + '.set', JSON.stringify({ value: lDTO.value }));
      }
    })
    .catch(err => {
      logutil.error('Error saving hotwater:\n' + err);
    });
}

function handleGetCurrent(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  if (!Object.prototype.hasOwnProperty.call(lDTO, 'name')) {
    logutil.warn('Bad DTO: ' + JSON.stringify(lDTO));
    return;
  }
  models.HotWater.findOne({
    where: {
      name: lDTO.name
    }
  })
    .then(lHotWater => {
      if (lHotWater === null) {
        logutil.warn('Unknown hotwater: ' + lDTO.name);
      } else {
        mq.send('hotwater.v1.valuechanged', lHotWater.toDTO());
      }
    })
    .catch(err => {
      logutil.error('Error getting hotwater:\n' + err);
    });
}

function handleGetAllCurrent() {
  models.HotWater.findAll({})
    .then(lHotWaters => {
      if (lHotWaters === null) {
        logutil.warn('No hotwaters');
      } else {
        for (var i = 0; i < lHotWaters.length; i++) {
          mq.send('hotwater.v1.valuechanged', lHotWaters[i].toDTO());
        }
      }
    })
    .catch(err => {
      logutil.error('Error getting hotwaters:\n' + err);
    });
}

function process(pHotWater) {
  if (pHotWater.errorFlags !== 0) {
    if (pHotWater.stateFlags !== 0) {
      logutil.info(pHotWater.name + ' is in error - disabling heater');
      mq.send('heater.v1.set', JSON.stringify({ name: pHotWater.heater, value: false }));
      pHotWater.update({ stateFlags: 0 });
    }
    return;
  }
  if (
    pHotWater.stateFlags === 0 &&
    pHotWater.value < pHotWater.requestedValue + pHotWater.tolerance
  ) {
    logutil.info(
      pHotWater.name +
        ' is not in requested range: ' +
        pHotWater.value +
        '(' +
        pHotWater.tolerance +
        ') - enabling heater'
    );
    mq.send('heater.v1.set', JSON.stringify({ name: pHotWater.heater, value: true }));
    pHotWater.update({ stateFlags: 1 });
  } else if (pHotWater.stateFlags === 1 && pHotWater.value >= pHotWater.requestedValue) {
    logutil.info(pHotWater.name + ' is in range - disabling heater');
    mq.send('heater.v1.set', JSON.stringify({ name: pHotWater.heater, value: false }));
    pHotWater.update({ stateFlags: 0 });
  }
}

function handleTemperature(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  models.HotWater.findAll({
    where: {
      temperature: lDTO.name
    }
  }).then(lHotWaters => {
    if (lHotWaters !== null) {
      for (var i = 0; i < lHotWaters.length; i++) {
        let lHotWater = lHotWaters[i];
        if (lHotWater.value !== lDTO.value) {
          lHotWater.update({ value: lDTO.value });
          mq.send('hotwater.v1.valuechanged', lHotWater.toDTO());
          process(lHotWater);
        }
      }
    }
  });
}

function handleLevel(msg) {
  let lDTO = JSON.parse(msg.content.toString());
  models.HotWater.findAll({
    where: {
      level: lDTO.name
    }
  }).then(lHotWaters => {
    for (var i = 0; i < lHotWaters.length; i++) {
      let lHotWater = lHotWaters[i];
      if (lDTO.value) {
        lHotWater.update({ errorFlags: 0 });
      } else {
        lHotWater.update({ errorFlags: 1 });
      }
      process(lHotWater);
    }
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
    case 'valuechanged': {
      break;
    }
    default: {
      logutil.warn('Unknown hotwater nesssage: ' + message.fields.routingKey);
      break;
    }
  }
}

function registerMQ() {
  logutil.silly('Registering hotwater handlers');
  return Promise.all([
    mq.recv('hotwater', 'hotwater.v1.#', false, handleMessage),
    mq.recv('', 'temperature.v1.valuechanged', true, handleTemperature),
    mq.recv('', 'level.v1.valuechanged', true, handleLevel)
  ]);
}

async function main() {
  await registerMQ();

  mq.send(
    'hotwater.v1.createnew',
    JSON.stringify({
      name: 'Warm Water',
      heater: 'Warm Water',
      level: 'Warm Water',
      temperature: 'Warm Water',
      requestedValue: 25,
      enabled: true
    })
  );
}

main();
