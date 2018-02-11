jest.genMockFromModule('amqplib');
const mq = require('../../main/common').mq;

describe('mq', () => {
  it('fails_to_connect', () => {
    expect.assertions(1);
    return expect(
      mq.connect('amqp://localhost:1', 'amq.topic')
    ).rejects.toThrowErrorMatchingSnapshot();
  });

  it('connects', () => {
    expect.assertions(1);
    return expect(
      mq.connect(
        'amqp://jgvoxqek:b_W1ueA3zx7l8YSYFLGzfJ4qFPEyxBDR@penguin.rmq.cloudamqp.com/jgvoxqek',
        'amq.topic'
      )
    ).resolves.toBeDefined();
  });

  let message;

  function ensureMessage() {
    return new Promise(function(resolve) {
      (function waitForFoo() {
        if (message) {
          return resolve(message.content.toString());
        }
        setTimeout(waitForFoo, 30);
      })();
    });
  }

  it('subscribes', async () => {
    expect.assertions(1);
    return expect(
      mq.recv('test', 'test.v1.#', rec => {
        message = rec;
      })
    ).resolves.toBeDefined();
  });

  it('sends', async () => {
    expect.assertions(1);
    return expect(mq.send('test.v1.testmq', 'This is a test')).resolves.toBeUndefined();
  });

  it('receives', async () => {
    expect.assertions(1);
    return expect(ensureMessage()).resolves.toMatchSnapshot();
  });

  it('disconnects', () => {
    expect.assertions(1);
    return expect(mq.disconnect()).resolves.toBeUndefined();
  });

  it('fails_to_disconnect', () => {
    expect.assertions(1);
    return expect(mq.disconnect()).rejects.toThrowErrorMatchingSnapshot();
  });

  it('doesnt-send', async () => {
    expect.assertions(1);
    return expect(
      mq.send('test.v1.testmq', 'This is a test')
    ).rejects.toThrowErrorMatchingSnapshot();
  });

  it('doesnt-send', async () => {
    expect.assertions(1);
    return expect(mq.send('test.v1.testmq')).rejects.toThrowErrorMatchingSnapshot();
  });
});
