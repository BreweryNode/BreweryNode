const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.js')[env];
let db = {};
let sequelize;

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable]);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

let model = sequelize.import('bubbler', require('./bubbler'));
db.Bubbler = model.single;

model = sequelize.import('cooler', require('./cooler'));
db.Cooler = model.single;

model = sequelize.import('flow', require('./flow'));
db.Flow = model.single;

model = sequelize.import('heater', require('./heater'));
db.Heater = model.single;

model = sequelize.import('level', require('./level'));
db.Level = model.single;

model = sequelize.import('pump', require('./pump'));
db.Pump = model.single;

model = sequelize.import('temperature', require('./temperature'));
db.Temperature = model.single;

model = sequelize.import('valve', require('./valve'));
db.Valve = model.single;

model = sequelize.import('volume', require('./volume'));
db.Volume = model.single;

Object.keys(db).forEach(function(modelName) {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
