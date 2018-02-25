const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const deviceutil = require('brewerynode-common').deviceutil;
const models = require('../models');

function handleMessage(msg) {
  let dto = JSON.parse(msg.content.toString());
  deviceutil.handleMessage(
    { name: 'level', number: false, mutator: false },
    msg,
    dto,
    models.Level
  );
}

function registerMQ() {
  logutil.silly('Registering level handlers');
  return mq.recv('level', 'level.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('level.v1.createnew', JSON.stringify({ name: 'Warm Water' }));
  mq.send('level.v1.createnew', JSON.stringify({ name: 'Cold Water' }));
}

main();
