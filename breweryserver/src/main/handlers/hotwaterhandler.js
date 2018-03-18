const winston = require('winston');
const mq = require('brewerynode-common').mq;
const hotwater = require('../models').HotWater;

function handleMessage(msg) {
  hotwater.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering HotWater handlers');
  return Promise.all([
    mq.recv('hotwater', 'hotwater.v1.#', false, handleMessage),
    mq.recv('', 'temperature.v1.valuechanged', true, hotwater.handleTemperatureChange),
    mq.recv('', 'level.v1.valuechanged', true, hotwater.handleLevelChange)
  ]);
}

function createTestData() {
  return Promise.all([
    hotwater.createNew({
      name: 'Warm Water',
      heater: 'Warm Water',
      level: 'Warm Water',
      temperature: 'Warm Water',
      requestedValue: 25,
      enabled: false
    })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
  hotwater.bootstrap();
}

main();
