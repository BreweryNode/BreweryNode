'use strict';
const mutator = require('./mutator');

module.exports = (sequelize, DataTypes) => {
  let Heater = mutator.createMutator(sequelize, DataTypes, {
    name: 'Heater',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false,
    comparison: 'boolean'
  });
  return Heater;
};
