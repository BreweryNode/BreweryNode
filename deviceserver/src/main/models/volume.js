'use strict';
var dto = require('dto');

module.exports = (sequelize, DataTypes) => {
  var Volume = sequelize.define('Volume', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    value: { type: DataTypes.DOUBLE, defaultValue: 0 }
  });

  Volume.prototype.toDTO = function() {
    return JSON.stringify(dto.take.only(this.dataValues, ['name', 'value']));
  };

  return Volume;
};
