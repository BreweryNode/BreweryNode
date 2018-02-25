const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const flow = require('../models').Flow;

function handleMessage(msg) {
  flow
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
  logutil.silly('Registering flow handlers');
  return mq.recv('flow', 'flow.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    flow.createNew(flow, { name: 'Warm Water' }),
    flow.createNew(flow, { name: 'Cold Water' }),
    flow.createNew(flow, { name: 'Boiler' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
