const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];
let db = {};
let sequelize;

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable]);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

let model = sequelize.import('cooler', require('./cooler'));
db.Cooler = model.single;
db.CoolerHistory = model.history;
db.CoolerSetHistory = model.setHistory;

model = sequelize.import('bubbler', require('./bubbler'));
db.Bubbler = model.single;
db.BubblerHistory = model.history;

model = sequelize.import('flow', require('./flow'));
db.Flow = model.single;
db.FlowHistory = model.history;

model = sequelize.import('heater', require('./heater'));
db.Heater = model.single;
db.HeaterHistory = model.history;
db.HeaterSetHistory = model.setHistory;

model = sequelize.import('level', require('./level'));
db.Level = model.single;
db.LevelHistory = model.history;

model = sequelize.import('pump', require('./pump'));
db.Pump = model.single;
db.PumpHistory = model.history;
db.PumpSetHistory = model.setHistory;

model = sequelize.import('temperature', require('./temperature'));
db.Temperature = model.single;
db.TemperatureHistory = model.history;

model = sequelize.import('valve', require('./valve'));
db.Valve = model.single;
db.ValveHistory = model.history;
db.ValveSetHistory = model.setHistory;

model = sequelize.import('volume', require('./volume'));
db.Volume = model.single;
db.VolumeHistory = model.history;

Object.keys(db).forEach(function(modelName) {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
