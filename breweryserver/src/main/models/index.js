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

let model = sequelize.import('boiler', require('./boiler'));
db.Boiler = model.single;

model = sequelize.import('coldwater', require('./coldwater'));
db.ColdWater = model.single;

model = sequelize.import('hotwater', require('./hotwater'));
db.HotWater = model.single;

db.MashTun = sequelize.import('mashtun', require('./mashtun'));

db.Manifold = sequelize.import('manifold', require('./manifold'));

model = sequelize.import('heatexchanger', require('./heatexchanger'));
db.HeatExchanger = model.single;

Object.keys(db).forEach(function(modelName) {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
