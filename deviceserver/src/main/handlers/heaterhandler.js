const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const deviceutil = require('brewerynode-common').deviceutil;
const models = require('../models');

function handleMessage(msg) {
  let dto = JSON.parse(msg.content.toString());
  deviceutil.handleMessage(
    { name: 'heater', number: false, mutator: true },
    msg,
    dto,
    models.Heater
  );
}

function registerMQ() {
  logutil.silly('Registering heater handlers');
  return mq.recv('heater', 'heater.v1.#', false, handleMessage);
}

async function main() {
  await registerMQ();

  mq.send('heater.v1.createnew', JSON.stringify({ name: 'Warm Water' }));
  mq.send('heater.v1.createnew', JSON.stringify({ name: 'Boiler 1' }));
  mq.send('heater.v1.createnew', JSON.stringify({ name: 'Boiler 2' }));
}

main();
