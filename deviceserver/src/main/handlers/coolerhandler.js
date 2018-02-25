const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const deviceutil = require('brewerynode-common').deviceutil;
const models = require('../models');

function handleMessage(msg) {
  let dto = JSON.parse(msg.content.toString());
  deviceutil.handleMessage(
    { name: 'cooler', number: false, mutator: true },
    msg,
    dto,
    models.Cooler
  );
}

function registerMQ() {
  logutil.silly('Registering cooler handlers');
  return mq.recv('cooler', 'cooler.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('cooler.v1.createnew', JSON.stringify({ name: 'Fermenter' }));
}

main();
