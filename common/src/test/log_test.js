const mq = require('../main').mq;
const logutil = require('../main').logutil;

describe('mq', () => {
  beforeAll(async () => {
    await mq.connect(process.env.MQ_ADDRESS, 'amq.topic');
  });

  afterAll(async () => {
    await mq.disconnect();
  });

  let message = '';
  let count = 0;

  function ensureMessage() {
    return new Promise(function(resolve) {
      (function waitForFoo() {
        if (count >= 6) {
          return resolve(message);
        }
        setTimeout(waitForFoo, 30);
      })();
    });
  }

  it('subscribes', async () => {
    expect.assertions(1);
    return expect(
      mq.recv('test', 'logging.v1.#', rec => {
        message += rec.content;
        count += 1;
      })
    ).resolves.toBeDefined();
  });

  it('logs_info', () => {
    return expect(logutil.info('INFO TEST')).resolves.toBeUndefined();
  });

  it('logs_debug', () => {
    return expect(logutil.debug('DEBUG TEST')).resolves.toBeUndefined();
  });

  it('logs_silly', () => {
    return expect(logutil.silly('SILLY TEST')).resolves.toBeUndefined();
  });

  it('logs_verbose', () => {
    return expect(logutil.verbose('VERBOSE TEST')).resolves.toBeUndefined();
  });

  it('logs_warn', () => {
    return expect(logutil.warn('WARN TEST')).resolves.toBeUndefined();
  });

  it('logs_error', () => {
    return expect(logutil.error('ERROR TEST')).resolves.toBeUndefined();
  });

  it('receives', async () => {
    expect.assertions(1);
    return expect(ensureMessage()).resolves.toMatchSnapshot();
  });
});
