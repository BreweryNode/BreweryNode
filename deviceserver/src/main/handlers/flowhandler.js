const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const deviceutil = require('brewerynode-common').deviceutil;
const models = require('../models');

function handleMessage(msg) {
  let dto = JSON.parse(msg.content.toString());
  deviceutil.handleMessage(
    { name: 'flow', number: false, mutator: false },
    msg,
    dto,
    models.Flow
  );
}

function registerMQ() {
  logutil.silly('Registering flow handlers');
  return mq.recv('flow', 'flow.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('flow.v1.createnew', JSON.stringify({ name: 'Warm Water' }));
  mq.send('flow.v1.createnew', JSON.stringify({ name: 'Cold Water' }));
  mq.send('flow.v1.createnew', JSON.stringify({ name: 'Boiler' }));
}

main();
