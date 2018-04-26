const winston = require('winston');
const mq = require('brewerynode-common').mq;
const manifold = require('../models').Manifold;

function handleMessage(msg) {
  manifold.handleMessage(msg);
}

function registerMQ() {
  winston.silly('Registering Manifold handlers');
  return Promise.all([
    mq.recv('manifold', 'manifold.v1.#', false, handleMessage),
    mq.recv('', 'valve.v1.valuechanged', true, manifold.handleValveChange)
  ]);
}

function createTestData() {
  return Promise.all([
    manifold.createNew({
      name: 'Manifold',
      warmWaterInput: 'Warm Water Input',
      warmWaterOutput: 'Warm Water Output',
      coldWaterInput: 'Cold Water Input',
      coldWaterOutput: 'Cold Water Output',
      mainsWaterInput: 'Mains Water Input',
      mainsWaterOutput: 'Mains Water Output'
    })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
  manifold.bootstrap();
}

main();
