const dto = require('dto');
const sensorutil = require('brewerynode-common').sensorutil;
const mutatorutil = require('brewerynode-common').mutatorutil;
const sensor = require('./sensor');

function createMutator(sequelize, DataTypes, config) {
  let fields = {
    requestedValue: { type: config.valueType, defaultValue: config.defaultValue }
  };
  config.fields = Object.assign(fields, config.fields);

  let Sensor = sensor.createSensor(sequelize, DataTypes, config);

  let SensorSetHistory = sequelize.define(config.name + 'SetHistory', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    value: { type: config.valueType, defaultValue: config.defaultValue }
  });

  Sensor.single.createNew = mutatorutil.createNew;
  Sensor.single.requestSet = mutatorutil.requestSet;
  Sensor.single.getSetHistoryModel = function() {
    return SensorSetHistory;
  };
  Sensor.single.prototype.requestSet = function(model, dto) {
    return mutatorutil.instanceRequestSet(model, dto, this);
  };

  Sensor.single.prototype.reading = function(model, dto) {
    return mutatorutil.instanceReading(model, dto, this);
  };
  Sensor.single.prototype.checkRequestedChanged = function(model, dto) {
    return mutatorutil.checkRequestedChanged(model, dto, this);
  };

  SensorSetHistory.belongsTo(Sensor.single, { as: 'sensor', onDelete: 'CASCADE' });

  SensorSetHistory.createNew = mutatorutil.createNewSetHistory;
  SensorSetHistory.getHistory = sensorutil.getHistory;

  SensorSetHistory.getName = function() {
    return config.name + 'History';
  };
  SensorSetHistory.prototype.toDTO = function() {
    return dto.take.only(this.dataValues, ['value', 'createdAt']);
  };

  return { single: Sensor.single, history: Sensor.history, setHistory: SensorSetHistory };
}

module.exports = {
  createMutator: createMutator
};
