const winston = require('winston');
const mq = require('brewerynode-common').mq;
const flow = require('../models').Flow;

function handleMessage(msg) {
  flow.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering flow handlers');
  return mq.recv('flow', 'flow.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    flow.createNew({ name: 'Warm Water' }),
    flow.createNew({ name: 'Cold Water' }),
    flow.createNew({ name: 'Boiler' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();

  //  Mq.send('flow.v1.reading', JSON.stringify({ name: 'Cold Water', value: true }));
}

main();
