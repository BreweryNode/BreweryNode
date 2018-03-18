const winston = require('winston');
const mq = require('brewerynode-common').mq;
const mainfold = require('../models').Mainfold;

function handleMessage(msg) {
  mainfold.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering Mainfold handlers');
  return Promise.all([mq.recv('mainfold', 'mainfold.v1.#', false, handleMessage)]);
}

function createTestData() {
  return Promise.all([
    mainfold.createNew({
      name: 'Cold Water',
      cooler: 'Freezer',
      level: 'Cold Water',
      temperature: 'Cold Water',
      requestedValue: 2,
      enabled: true
    })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
  mainfold.bootstrap();
}

main();
