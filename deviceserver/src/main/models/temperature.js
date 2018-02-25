'use strict';
const sensor = require('./sensor');
const sensorutil = require('brewerynode-common').sensorutil;

module.exports = (sequelize, DataTypes) => {
  let Temperature = sensor.createSensor(sequelize, DataTypes, {
    name: 'Temperature',
    valueType: DataTypes.DOUBLE,
    defaultValue: 0,
    comparison: 'number',
    fields: { mac: { type: DataTypes.STRING, allowNull: false, unique: true } }
  });

  Temperature.single.search = function(model, dto) {
    if (Object.prototype.hasOwnProperty.call(dto, 'mac')) {
      console.log('Looking for ' + model.getName() + ': ' + dto.name);
      return model.findOne({
        where: {
          mac: dto.mac
        }
      });
    }
    return sensorutil.search(model, dto);
  };

  return Temperature;
};
