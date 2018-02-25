'use strict';
const mutator = require('./mutator');

module.exports = (sequelize, DataTypes) => {
  let Pump = mutator.createMutator(sequelize, DataTypes, {
    name: 'Pump',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false,
    comparison: 'boolean'
  });
  return Pump;
};
