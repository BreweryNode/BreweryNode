const mq = require('./mq');
const logutil = require('./logutil');

function search(model, dto) {
  console.log('Looking for ' + model.getName() + ': ' + dto.name);
  return model.findOne({
    where: {
      name: dto.name
    }
  });
}

function createNew(model, dto) {
  return new Promise(function(resolve, reject) {
    model
      .search(model, dto)
      .then(record => {
        if (record === null) {
          logutil.info('Creating ' + model.getName() + ': ' + dto.name);
          model
            .create(dto)
            .then(instance => {
              model.getHistoryModel().createNew(model, instance);
              logutil.info('Created ' + model.getName() + ': ' + dto.name);
              resolve(instance);
            })
            .catch(err => {
              logutil.error('Error creating ' + model.getName() + ':\n' + err);
              reject();
            });
        } else {
          logutil.warn(model.getName() + ' already added: ' + dto.name);
          reject();
        }
      })
      .catch(err => {
        logutil.error('Error saving ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function createNewHistory(model, instance) {
  return new Promise(function(resolve, reject) {
    let history = model.getHistoryModel().build({ value: instance.value });
    history.setSensor(instance, { save: false });
    history
      .save()
      .then(() => {
        logutil.info('Created history for: ' + model.getName() + ':' + instance.name);
        resolve();
      })
      .catch(err => {
        logutil.error('Error creating ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function reading(model, dto) {
  return new Promise(function(resolve, reject) {
    model
      .search(model, dto)
      .then(record => {
        if (record === null) {
          logutil.warn('Unknown ' + model.getName() + ': ' + dto.name);
          reject();
        } else {
          return record.reading(model, dto);
        }
      })
      .catch(err => {
        logutil.error('Error saving ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function getCurrent(model, dto) {
  return new Promise(function(resolve, reject) {
    model
      .search(model, dto)
      .then(record => {
        if (record === null) {
          logutil.warn('Unknown ' + model.getName() + ': ' + dto.name);
          reject();
        } else {
          mq.send(model.getName() + 'v1.valuechanged', record.toDTO());
          resolve();
        }
      })
      .catch(err => {
        logutil.error('Error getting ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function getAllCurrent(model) {
  return new Promise(function(resolve, reject) {
    model
      .findAll({})
      .then(records => {
        if (records === null) {
          logutil.warn('No ' + model.getName() + 's');
          reject();
        } else {
          for (var i = 0; i < records.length; i++) {
            mq.send(model.getName() + '.v1.valuechanged', records[i].toDTO());
          }
          resolve();
        }
      })
      .catch(err => {
        logutil.error('Error getting ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function getHistory(model, historyModel, dto) {
  return new Promise(function(resolve, reject) {
    historyModel
      .findAll({
        include: [{ model: model, as: 'sensor', where: { name: dto.name } }]
      })
      .then(records => {
        if (records === null) {
          logutil.warn('No ' + model.getName() + 's');
          reject();
        } else {
          let history = [];
          for (var i = 0; i < records.length; i++) {
            history.push(records[i].toDTO());
          }
          mq.send(
            model.getName() + '.v1.history',
            JSON.stringify({ name: dto.name, history: history })
          );
          resolve();
        }
      })
      .catch(err => {
        logutil.error('Error getting history for: ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function doCompare(val1, val2, type) {
  switch (type) {
    case 'boolean': {
      return Boolean(val1) === Boolean(val2);
    }
    case 'number': {
      return Number(val1) === Number(val2);
    }
    default: {
      return val1 === val2;
    }
  }
}

function instanceReading(model, dto, instance) {
  return new Promise(function(resolve, reject) {
    if (!model.doCompare(instance.value, dto.value)) {
      instance
        .update({ value: dto.value })
        .then(() => {
          model.getHistoryModel().createNew(model, instance);
          mq.send(model.getName() + '.v1.valuechanged', instance.toDTO());
          resolve();
        })
        .catch(err => {
          reject(err);
        });
    }
  });
}

module.exports = {
  search: search,
  reading: reading,
  createNew: createNew,
  getCurrent: getCurrent,
  getAllCurrent: getAllCurrent,
  instanceReading: instanceReading,
  doCompare: doCompare,
  createNewHistory: createNewHistory,
  getHistory: getHistory
};
