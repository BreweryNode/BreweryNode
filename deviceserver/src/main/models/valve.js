'use strict';
const mutator = require('./mutator');

module.exports = (sequelize, DataTypes) => {
  let Valve = mutator.createMutator(sequelize, DataTypes, {
    name: 'Valve',
    valueType: DataTypes.BOOLEAN,
    defaultValue: false,
    comparison: 'boolean'
  });
  return Valve;
};
