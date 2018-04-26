const winston = require('winston');
const mq = require('brewerynode-common').mq;
const mashtun = require('../models').MashTun;

function handleMessage(msg) {
  mashtun.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering MashTun handlers');
  return Promise.all([
    mq.recv('mashtun', 'mashtun.v1.#', false, handleMessage),
    mq.recv('', 'flow.v1.valuechanged', true, mashtun.handleFlowChange),
    mq.recv('', 'temperature.v1.valuechanged', true, mashtun.handleTemperatureChange),
    mq.recv('', 'heatexchanger.v1.valuechanged', true, mashtun.handleHeatExchangerChange)
  ]);
}

function createTestData() {
  return Promise.all([
    mashtun.createNew({
      name: 'MashTun',
      requestedValue: 66,
      element1: 'Boiler 1',
      element2: 'Boiler 2',
      flow: 'Boiler',
      pump: 'Boiler',
      temperature: 'Boiler',
      warmwater: 'Warm Water',
      heatexchanger: 'HeatExchanger',
      enabled: 'true'
    })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
  mashtun.bootstrap();
}

main();
