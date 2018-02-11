"use strict";
var dto = require("dto");

module.exports = (sequelize, DataTypes) => {
  var Bubbler = sequelize.define("Bubbler", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    value: { type: DataTypes.INTEGER, defaultValue: 0 },
    revision: { type: DataTypes.INTEGER, defaultValue: 0 }
  });

  Bubbler.Revisions = Bubbler.hasPaperTrail();

  Bubbler.prototype.toDTO = function() {
    return JSON.stringify(dto.take.only(this.dataValues, ["name", "value"]));
  };

  return Bubbler;
};
