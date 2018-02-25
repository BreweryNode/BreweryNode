const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const temperature = require('../models').Temperature;

function handleMessage(msg) {
  temperature
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
  logutil.silly('Registering temperature handlers');
  return mq.recv('temperature', 'temperature.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    temperature.createNew(temperature, { mac: '28ff220b00150208', name: 'Cold Water' }),
    temperature.createNew(temperature, { mac: '28ff6a02641403ed', name: 'Warm Water' }),
    temperature.createNew(temperature, { mac: '28ff983d6414031a', name: 'Fermenter' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
