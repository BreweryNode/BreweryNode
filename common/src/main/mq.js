var Promise = require('bluebird');

exports.connect = function(host, exchange) {
  exports.exchange = exchange;
  return new Promise(function(resolve, reject) {
    require('amqplib')
      .connect(host)
      .then(connection => {
        exports.connection = connection;
        return connection.createChannel();
      })
      .then(channel => {
        exports.channel = channel;
        return channel.assertExchange(exchange, 'topic', { durable: true });
      })
      .then(exchange => {
        resolve(exchange);
      })
      .catch(err => {
        reject(err);
      });
  });
};

exports.recv = function(queuename, topic, callback) {
  return new Promise(function(resolve, reject) {
    exports.channel
      .assertQueue(queuename)
      .then(q => {
        return exports.channel.unbindQueue(q.queue, exports.exchange);
      })
      .then(q => {
        return exports.channel.bindQueue(q.queue, exports.exchange, topic);
      })
      .then(q => {
        return exports.channel.consume(q.queue, callback, { noAck: true });
      })
      .then(ret => {
        resolve(ret);
      })
      .catch(err => {
        reject(err);
      });
  });
};

exports.send = function(topic, message) {
  return new Promise(function(resolve, reject) {
    if (exports.channel.publish(exports.exchange, topic, new Buffer(message))) {
      resolve();
    } else {
      reject();
    }
  });
};

exports.disconnect = function() {
  return exports.connection.close();
};
