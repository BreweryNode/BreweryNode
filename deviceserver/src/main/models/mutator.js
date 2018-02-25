const dto = require('dto');
const sensorutil = require('brewerynode-common').sensorutil;
const mutatorutil = require('brewerynode-common').mutatorutil;
const sensor = require('./sensor');

function createMutator(sequelize, DataTypes, config) {
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
  Sensor.single.reading = mutatorutil.reading;
  Sensor.single.requestSet = mutatorutil.requestSet;
  Sensor.single.getSetHistoryModel = function() {
    return SensorSetHistory;
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
