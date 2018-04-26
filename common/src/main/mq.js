const logutil = require('./logutil');

exports.connect = async function(host, exchange) {
  try {
    exports.exchange = exchange;
    exports.connection = await require('amqplib').connect(host);
    exports.channel = await exports.connection.createChannel();
    await exports.channel.assertExchange(exchange, 'topic', { durable: true });
  } catch (err) {
    logutil.error(err);
    throw new Error('Error connecting to MQ');
  }
};

exports.recv = async function(queuename, topic, exclusive, callback) {
  try {
    let channel = await exports.connection.createChannel();
    await channel.assertExchange(exports.exchange, 'topic', { durable: true });
    let q = await channel.assertQueue(queuename, { exclusive: exclusive });
    await channel.unbindQueue(q.queue, exports.exchange);
    await channel.bindQueue(q.queue, exports.exchange, topic);
    await channel.consume(q.queue, callback, { noAck: true });
  } catch (err) {
    logutil.error(err);
    throw new Error('Error setting up recv');
  }
};

exports.send = async function(topic, message) {
  try {
    await exports.channel.publish(exports.exchange, topic, new Buffer(message));
  } catch (err) {
    logutil.error(err);
  }
};

exports.disconnect = function() {
  return exports.connection.close();
};
