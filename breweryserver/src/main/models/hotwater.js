'use strict';
var dto = require('dto');

module.exports = (sequelize, DataTypes) => {
  var HotWater = sequelize.define('HotWater', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    value: { type: DataTypes.DOUBLE, defaultValue: 20 },
    requestedValue: { type: DataTypes.DOUBLE, defaultValue: 20 },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    heater: { type: DataTypes.STRING, allowNull: false, unique: false },
    level: { type: DataTypes.STRING, allowNull: false, unique: false },
    temperature: { type: DataTypes.STRING, allowNull: false, unique: false },
    tolerance: { type: DataTypes.DOUBLE, defaultValue: 0.5 },
    errorFlags: { type: DataTypes.INTEGER, defaultValue: 0 },
    stateFlags: { type: DataTypes.INTEGER, defaultValue: 0 }
  });

  HotWater.prototype.toDTO = function() {
    return JSON.stringify(
      dto.take.only(this.dataValues, ['name', 'value', 'requestedValue'])
    );
  };

  return HotWater;
};
