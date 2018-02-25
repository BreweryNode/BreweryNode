'use strict';
const sensor = require('./sensor');

module.exports = (sequelize, DataTypes) => {
  let Flow = sensor.createSensor(sequelize, DataTypes, {
    name: 'Flow',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false,
    comparison: 'boolean'
  });
  return Flow;
};
