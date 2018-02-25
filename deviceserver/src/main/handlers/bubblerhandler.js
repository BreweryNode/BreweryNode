const mq = require('brewerynode-common').mq;
const logutil = require('brewerynode-common').logutil;
const bubbler = require('../models').Bubbler;

function handleMessage(msg) {
  bubbler
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
  logutil.silly('Registering bubbler handlers');
  return mq.recv('bubbler', 'bubbler.v1.#', false, handleMessage);
}

function createTestData() {
  return Promise.all([bubbler.createNew(bubbler, { name: 'Fermenter' })]);
}

async function main() {
  await registerMQ();
  await createTestData();

  mq.send('bubbler.v1.reading', JSON.stringify({ name: 'Fermenter', value: 3 }));
}

main();
