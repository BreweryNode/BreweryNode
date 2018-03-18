const winston = require('winston');
const mq = require('brewerynode-common').mq;
const coldwater = require('../models').ColdWater;

function handleMessage(msg) {
  coldwater.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering ColdWater handlers');
  return Promise.all([
    mq.recv('coldwater', 'coldwater.v1.#', false, handleMessage),
    mq.recv('', 'temperature.v1.valuechanged', true, coldwater.handleTemperatureChange),
    mq.recv('', 'level.v1.valuechanged', true, coldwater.handleLevelChange)
  ]);
}

function createTestData() {
  return Promise.all([
    coldwater.createNew({
      name: 'Cold Water',
      cooler: 'Freezer',
      level: 'Cold Water',
      temperature: 'Cold Water',
      requestedValue: 2,
      enabled: false
    })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
  coldwater.bootstrap();
}

main();
