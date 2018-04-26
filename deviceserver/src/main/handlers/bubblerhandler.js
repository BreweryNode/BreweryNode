const winston = require('winston');
const mq = require('brewerynode-common').mq;
const bubbler = require('../models').Bubbler;

function handleMessage(msg) {
  bubbler.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering bubbler handlers');
  return mq.recv('bubbler', 'bubbler.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([bubbler.createNew({ name: 'Fermenter' })]);
}

async function main() {
  await registerMQ();
  await createTestData();

  //  Mq.send('bubbler.v1.reading', JSON.stringify({ name: 'Fermenter', value: 3 }));
}

main();
