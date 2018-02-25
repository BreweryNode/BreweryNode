'use strict';
const mutator = require('./mutator');

module.exports = (sequelize, DataTypes) => {
  let Cooler = mutator.createMutator(sequelize, DataTypes, {
    name: 'Cooler',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false,
    comparison: 'boolean'
  });
  return Cooler;
};
