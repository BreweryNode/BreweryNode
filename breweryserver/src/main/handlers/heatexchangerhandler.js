const winston = require('winston');
const mq = require('brewerynode-common').mq;
const heatexchanger = require('../models').HeatExchanger;

function handleMessage(msg) {
  heatexchanger.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering HeatExchanger handlers');
  return Promise.all([
    mq.recv('heatexchanger', 'heatexchanger.v1.#', false, handleMessage),
    mq.recv('', 'flow.v1.valuechanged', true, heatexchanger.handleFlowChange),
    mq.recv('', 'manifold.v1.valuechanged', true, heatexchanger.handleManifoldChange)
  ]);
}

function createTestData() {
  return Promise.all([
    heatexchanger.createNew({
      name: 'HeatExchanger',
      manifold: 'Manifold',
      warmPump: 'Warm Water',
      warmFlow: 'Warm Water',
      coldPump: 'Cold Water',
      coldFlow: 'Cold Water',
      enabled: 'true'
    })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
  heatexchanger.bootstrap();
}

main();
