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

exports.recv = function(queuename, topic, exclusive, callback) {
  return new Promise(function(resolve, reject) {
    let channel;
    exports.connection
      .createChannel()
      .then(ch => {
        channel = ch;
        return channel.assertExchange(exports.exchange, 'topic', { durable: true });
      })
      .then(() => {
        return channel.assertQueue(queuename, { exclusive: exclusive });
      })
      .then(q => {
        return channel.unbindQueue(q.queue, exports.exchange);
      })
      .then(q => {
        return channel.bindQueue(q.queue, exports.exchange, topic);
      })
      .then(q => {
        return channel.consume(q.queue, callback, { noAck: true });
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
