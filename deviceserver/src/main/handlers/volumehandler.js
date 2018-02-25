const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const volume = require('../models').Volume;

function handleMessage(msg) {
  volume
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
  logutil.silly('Registering volume handlers');
  return mq.recv('volume', 'volume.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([volume.createNew(volume, { name: 'Fermenter' })]);
}

async function main() {
  await registerMQ();
  await createTestData();
}

main();
