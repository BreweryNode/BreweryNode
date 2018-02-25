const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const pump = require('../models').Pump;

function handleMessage(msg) {
  pump
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
  logutil.silly('Registering pump handlers');
  return mq.recv('pump', 'pump.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    pump.createNew(pump, { name: 'Warm Water' }),
    pump.createNew(pump, { name: 'Cold Water' }),
    pump.createNew(pump, { name: 'Boiler' }),
    pump.createNew(pump, { name: 'Agitator' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
