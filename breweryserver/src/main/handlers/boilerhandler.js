const winston = require('winston');
const mq = require('brewerynode-common').mq;
const boiler = require('../models').Boiler;

function handleMessage(msg) {
  boiler.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering Boiler handlers');
  return Promise.all([
    mq.recv('boiler', 'boiler.v1.#', false, handleMessage),
    mq.recv('', 'temperature.v1.valuechanged', true, boiler.handleTemperatureChange),
    mq.recv('', 'flow.v1.valuechanged', true, boiler.handleFlowChange)
  ]);
}

function createTestData() {
  return Promise.all([
    boiler.createNew({
      name: 'Boiler',
      element1: 'Boiler 1',
      element2: 'Boiler 2',
      pump: 'Boiler',
      flow: 'Boiler',
      temperature: 'Boiler',
      requestedValue: 100,
      enabled: false
    })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
  boiler.bootstrap();
}

main();
