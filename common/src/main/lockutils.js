const client1 = require('redis').createClient(6379, 'localhost');
const winston = require('winston');
const Redlock = require('redlock');

const redlock = new Redlock([client1], {
  // The expected clock drift; for more details
  // see http://redis.io/topics/distlock
  driftFactor: 0.01, // Time in ms

  // the max number of times Redlock will attempt
  // to lock a resource before erroring
  retryCount: 100,

  // The time in ms between attempts
  retryDelay: 100, // Time in ms

  // the max time in ms randomly added to retries
  // to improve performance under high contention
  // see https://www.awsarchitectureblog.com/2015/03/backoff.html
  retryJitter: 2 // Time in ms
});

async function lock(id, time) {
  try {
    let lock = await redlock.lock(id, time);
    return lock;
  } catch (err) {
    winston.error(err);
  }
}

async function unlock(lock) {
  await lock.unlock();
}

function lockHook(model) {
  model.addHook('beforeUpdate', (instance, options) => {
    if (!instance.mutex) {
      winston.silly(JSON.stringify(instance));
      winston.silly(JSON.stringify(options));
      throw new Error(model.getName() + ' Mutex needed');
    }
  });
}

module.exports = {
  lock: lock,
  unlock: unlock,
  lockHook: lockHook
};
