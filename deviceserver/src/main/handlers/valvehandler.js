const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const valve = require('../models').Valve;

function handleMessage(msg) {
  valve
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
  logutil.silly('Registering valve handlers');
  return mq.recv('valve', 'valve.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    valve.createNew(valve, { name: 'Warm Water Input' }),
    valve.createNew(valve, { name: 'Warm Water Output' }),
    valve.createNew(valve, { name: 'Cold Water Input' }),
    valve.createNew(valve, { name: 'Cold Water Output' }),
    valve.createNew(valve, { name: 'Mains Water Input' }),
    valve.createNew(valve, { name: 'Mains Water Output' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
