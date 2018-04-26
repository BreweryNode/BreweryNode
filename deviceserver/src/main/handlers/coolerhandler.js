const winston = require('winston');
const mq = require('brewerynode-common').mq;
const cooler = require('../models').Cooler;

function handleMessage(msg) {
  cooler.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering cooler handlers');
  return mq.recv('cooler', 'cooler.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([cooler.createNew({ name: 'Freezer' })]);
}

async function main() {
  await registerMQ();
  await createTestData();

  // Mq.send('cooler.v1.reading', JSON.stringify({ name: 'Freezer', value: true }));
}

main();
