const winston = require('winston');
const mq = require('brewerynode-common').mq;
const temperature = require('../models').Temperature;

function handleMessage(msg) {
  temperature.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering temperature handlers');
  return mq.recv('temperature', 'temperature.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    temperature.createNew({ mac: '28ff220b00150208', name: 'Cold Water' }),
    temperature.createNew({ mac: '28ff6a02641403ed', name: 'Warm Water' }),
    temperature.createNew({ mac: '28ff983d6414031a', name: 'Fermenter' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();

  mq.send(
    'temperature.v1.reading',
    JSON.stringify({ mac: '28ff220b00150208', value: 3 })
  );
}

main();
