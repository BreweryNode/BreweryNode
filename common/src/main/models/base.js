const mq = require('../mq');
const winston = require('winston');
const lockutils = require('../lockutils');

exports.getVersionedFields = function() {};

exports.getFields = function(sequelize, DataTypes, config, fields) {
  Object.assign(fields, {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: { type: DataTypes.STRING, allowNull: false, unique: true }
  });
};

exports.getDTOFields = function(dtoFields) {
  dtoFields.push('name');
  dtoFields.push('createdAt');
};

exports.addMessageHandlers = function(dbClass, messageHandlers) {
  Object.assign(messageHandlers, {
    createnew: dbClass.createNew,
    created: function() {}
  });
};

exports.handleMessage = async function(key, dto) {
  switch (key) {
    case 'createnew': {
      await exports.createNew(dto);
      return true;
    }
    default: {
      return false;
    }
  }
};

exports.addMethods = function(dbClass, config) {
  dbClass.getName = function() {
    return config.name;
  };

  dbClass.lockById = async function(id) {
    //    Winston.silly('Locking ' + dbClass.getName() + ' id: ' + id);
    let mutex = await lockutils.lock(id, 10000);
    //    Winston.silly('Locked ' + dbClass.getName() + ' id: ' + id);
    let record = await dbClass.findOne({
      where: {
        id: id
      }
    });
    record.mutex = mutex;
    return record;
  };

  dbClass.lockByModel = async function(model) {
    return dbClass.lockById(model.id);
  };

  dbClass.unlock = async function(record) {
    //    Winston.silly('Unlocking ' + dbClass.getName() + ' id: ' + record.id);
    let lock = record.mutex;
    record.mutex = null;
    lockutils.unlock(lock);
    //    Winston.silly('Unlocked ' + dbClass.getName() + ' id: ' + record.id);
  };

  dbClass.find = function(dto, lock) {
    if (Object.prototype.hasOwnProperty.call(dto, 'id')) {
      return dbClass.findById(dto, lock);
    } else if (Object.prototype.hasOwnProperty.call(dto, 'name')) {
      return dbClass.findByName(dto, lock);
    }
  };

  dbClass.findById = async function(dto, lock) {
    //    Winston.silly('Searching by id for: ' + dto.id + ' lock: ' + lock);
    if (lock) {
      let record = await dbClass.findOne({
        where: {
          id: dto.id
        },
        attributes: ['id']
      });
      if (record) {
        return dbClass.lockById(record.id);
      }
      return record;
    }

    let record = await dbClass.findOne({
      where: {
        id: dto.id
      }
    });
    return record;
  };

  dbClass.findByName = async function(dto, lock) {
    //    Winston.silly('Searching by name for: ' + dto.name + ' lock: ' + lock);
    if (lock) {
      let record = await dbClass.findOne({
        where: {
          name: dto.name
        },
        attributes: ['id']
      });
      if (record) {
        return dbClass.lockById(record.id);
      }
      return record;
    }
    let record = await dbClass.findOne({
      where: {
        name: dto.name
      }
    });
    return record;
  };

  dbClass.createNew = async function(dto) {
    try {
      let record = await dbClass.findByName(dto);
      if (record) {
        winston.warn(dbClass.getName() + ' already added: ' + dto.name);
      } else {
        winston.silly('Creating ' + dbClass.getName() + ': ' + dto.name);
        return await dbClass.create(dto);
      }
    } catch (err) {
      winston.error('Error saving ' + dbClass.getName() + ':\n' + err);
    }
  };
};

exports.addHooks = function(dbClass) {
  dbClass.hook('afterCreate', instance => {
    mq.send(
      dbClass.getName().toLowerCase() + '.v1.created',
      JSON.stringify(instance.toDTO())
    );
  });
};
