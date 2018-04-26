const winston = require('winston');
const mq = require('brewerynode-common').mq;
const valve = require('../models').Valve;

function handleMessage(msg) {
  valve.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering valve handlers');
  return mq.recv('valve', 'valve.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    valve.createNew({ name: 'Warm Water Input' }),
    valve.createNew({ name: 'Warm Water Output' }),
    valve.createNew({ name: 'Cold Water Input' }),
    valve.createNew({ name: 'Cold Water Output' }),
    valve.createNew({ name: 'Mains Water Input' }),
    valve.createNew({ name: 'Mains Water Output' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();

  // Mq.send('valve.v1.reading', JSON.stringify({ name: 'Fermenter', value: true }));
}

main();
