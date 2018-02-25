'use strict';
const sensor = require('./sensor');

module.exports = (sequelize, DataTypes) => {
  let Bubbler = sensor.createSensor(sequelize, DataTypes, {
    name: 'Bubbler',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0,
    comparison: 'number'
  });
  return Bubbler;
};
