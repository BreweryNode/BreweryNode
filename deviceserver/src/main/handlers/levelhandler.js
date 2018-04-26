const winston = require('winston');
const mq = require('brewerynode-common').mq;
const level = require('../models').Level;

function handleMessage(msg) {
  level.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering level handlers');
  return mq.recv('level', 'level.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    level.createNew({ name: 'Warm Water' }),
    level.createNew({ name: 'Cold Water' }),
    level.createNew({ name: 'Boiler' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();

  mq.send('level.v1.reading', JSON.stringify({ name: 'Warm Water', value: true }));
}

main();
