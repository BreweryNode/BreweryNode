const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const deviceutil = require('brewerynode-common').deviceutil;
const models = require('../models');

function handleMessage(msg) {
  let dto = JSON.parse(msg.content.toString());
  deviceutil.handleMessage(
    { name: 'volume', number: true, mutator: false },
    msg,
    dto,
    models.Volume
  );
}

function registerMQ() {
  logutil.silly('Registering volume handlers');
  return mq.recv('volume', 'volume.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('volume.v1.createnew', JSON.stringify({ name: 'Fermenter' }));
}

main();
