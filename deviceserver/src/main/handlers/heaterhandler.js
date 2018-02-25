const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const heater = require('../models').Heater;

function handleMessage(msg) {
  heater
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
  logutil.silly('Registering heater handlers');
  return mq.recv('heater', 'heater.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    heater.createNew(heater, { name: 'Warm Water' }),
    heater.createNew(heater, { name: 'Boiler 1' }),
    heater.createNew(heater, { name: 'Boiler 2' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
