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
db.Cooler = model;
model = sequelize.import('bubbler', require('./bubbler'));
db.Bubbler = model.single;
db.BubblerHistory = model.history;
model = sequelize.import('flow', require('./flow'));
db.Flow = model;
model = sequelize.import('heater', require('./heater'));
db.Heater = model;
model = sequelize.import('level', require('./level'));
db.Level = model;
model = sequelize.import('pump', require('./pump'));
db.Pump = model;
model = sequelize.import('temperature', require('./temperature'));
db.Temperature = model;
model = sequelize.import('volume', require('./volume'));
db.Volume = model;
model = sequelize.import('valve', require('./valve'));
db.Valve = model.single;
db.ValveHistory = model.history;
db.ValveSetHistory = model.setHistory;

Object.keys(db).forEach(function(modelName) {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
