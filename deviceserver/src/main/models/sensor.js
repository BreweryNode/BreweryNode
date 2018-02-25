'use strict';
const dto = require('dto');
const sensorutil = require('brewerynode-common').sensorutil;
const messageutil = require('brewerynode-common').messageutil;

function createSensor(sequelize, DataTypes, config) {
  let SensorHistory;
  let fields = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    value: { type: config.valueType, defaultValue: config.defaultValue }
  };

  if (!Object.prototype.hasOwnProperty.call(config, 'fields')) {
    config.fields = {};
  }

  var Sensor = sequelize.define(config.name, Object.assign(fields, config.fields));

  Sensor.createNew = sensorutil.createNew;
  Sensor.search = sensorutil.search;
  Sensor.reading = sensorutil.reading;
  Sensor.getCurrent = sensorutil.getCurrent;
  Sensor.getAllCurrent = sensorutil.getAllCurrent;

  Sensor.getHistoryModel = function() {
    return SensorHistory;
  };

  Sensor.getName = function() {
    return config.name;
  };
  Sensor.doCompare = function(val1, val2) {
    return sensorutil.doCompare(val1, val2, config.comparison);
  };
  Sensor.handleMessage = function(msg) {
    return messageutil.handleMessage(Sensor, msg);
  };

  Sensor.prototype.toDTO = function() {
    return JSON.stringify(dto.take.only(this.dataValues, ['name', 'value']));
  };

  Sensor.prototype.reading = function(model, dto) {
    return sensorutil.instanceReading(model, dto, this);
  };

  SensorHistory = sequelize.define(config.name + 'History', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    value: { type: config.valueType, defaultValue: config.defaultValue }
  });

  SensorHistory.belongsTo(Sensor, { as: 'sensor', onDelete: 'CASCADE' });

  SensorHistory.createNew = sensorutil.createNewHistory;
  SensorHistory.getHistory = sensorutil.getHistory;

  SensorHistory.getName = function() {
    return config.name + 'History';
  };
  SensorHistory.prototype.toDTO = function() {
    return dto.take.only(this.dataValues, ['value', 'createdAt']);
  };

  return { single: Sensor, history: SensorHistory };
}

module.exports = {
  createSensor: createSensor
};
