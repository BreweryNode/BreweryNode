const winston = require('winston');
const mq = require('brewerynode-common').mq;
const heater = require('../models').Heater;

function handleMessage(msg) {
  heater.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering heater handlers');
  return mq.recv('heater', 'heater.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    heater.createNew({ name: 'Warm Water' }),
    heater.createNew({ name: 'Boiler 1' }),
    heater.createNew({ name: 'Boiler 2' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();

  mq.send('heater.v1.reading', JSON.stringify({ name: 'Warm Water', value: true }));
}

main();
