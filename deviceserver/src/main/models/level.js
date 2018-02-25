'use strict';
const sensor = require('./sensor');

module.exports = (sequelize, DataTypes) => {
  let Level = sensor.createSensor(sequelize, DataTypes, {
    name: 'Level',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false,
    comparison: 'boolean'
  });
  return Level;
};
