const winston = require('winston');
const mq = require('brewerynode-common').mq;
const pump = require('../models').Pump;

function handleMessage(msg) {
  pump.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering pump handlers');
  return mq.recv('pump', 'pump.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    pump.createNew({ name: 'Warm Water' }),
    pump.createNew({ name: 'Cold Water' }),
    pump.createNew({ name: 'Boiler' }),
    pump.createNew({ name: 'Agitator' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();

  // Mq.send('pump.v1.reading', JSON.stringify({ name: 'Warm Water', value: true }));
}

main();
