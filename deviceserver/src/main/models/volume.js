'use strict';
const sensor = require('./sensor');

module.exports = (sequelize, DataTypes) => {
  let Volume = sensor.createSensor(sequelize, DataTypes, {
    name: 'Volume',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0,
    comparison: 'number'
  });
  return Volume;
};
