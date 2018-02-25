const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const level = require('../models').Level;

function handleMessage(msg) {
  level
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
  logutil.silly('Registering level handlers');
  return mq.recv('level', 'level.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([
    level.createNew(level, { name: 'Warm Water' }),
    level.createNew(level, { name: 'Cold Water' })
  ]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
