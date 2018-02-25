const mq = require('brewerynode-common').mq;

describe('handlelog', () => {
  afterAll(async () => {
    await mq.disconnect();
  });

  it('handles-invalid-msg', () => {
    expect.assertions(0);
  });
});
