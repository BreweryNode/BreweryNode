const mq = require('brewerynode-common').mq;
const winston = require('winston');
const volume = require('../models').Volume;

function handleMessage(msg) {
  volume.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering volume handlers');
  return mq.recv('volume', 'volume.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([volume.createNew({ name: 'Fermenter' })]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
