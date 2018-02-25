const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const cooler = require('../models').Cooler;

function handleMessage(msg) {
  cooler
    .handleMessage(msg)
    .then(() => {})
    .catch(err => {
      console.log(
        'Error handling message: "' +
          msg.fields.routingKey +
          '" : "' +
          msg.content.toString() +
          '" : ' +
          err
      );
    });
}

function registerMQ() {
  logutil.silly('Registering cooler handlers');
  return mq.recv('cooler', 'cooler.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([cooler.createNew(cooler, { name: 'Fermenter' })]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
