const logutil = require('./logutil');
const mq = require('./mq');
const sensorutil = require('./sensorutil');

function createNew(model, dto) {
  return new Promise(function(resolve, reject) {
    sensorutil
      .createNew(model, dto)
      .then(instance => {
        model.getSetHistoryModel().createNew(model, instance);
      })
      .catch(err => {
        reject(err);
      });
  });
}

function createNewSetHistory(model, instance) {
  return new Promise(function(resolve, reject) {
    let history = model.getSetHistoryModel().build({ value: instance.requestedValue });
    history.setSensor(instance, { save: false });
    history
      .save()
      .then(() => {
        logutil.info('Created set history for: ' + model.getName() + ':' + instance.name);
        resolve();
      })
      .catch(err => {
        logutil.error('Error creating ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function requestSet(model, dto) {
  return new Promise(function(resolve, reject) {
    model
      .search(model, dto)
      .then(record => {
        if (record === null) {
          logutil.warn('Unknown ' + model.getName() + ': ' + dto.name);
          reject();
        } else {
          return record.requestSet(model, dto);
        }
      })
      .catch(err => {
        logutil.error('Error saving ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function instanceRequestSet(model, dto, instance) {
  return new Promise(function(resolve, reject) {
    if (model.doCompare(instance.value, dto.value)) {
      resolve();
    } else {
      instance
        .update({ requestedValue: dto.value })
        .then(() => {
          mq.send(
            model.getName() + '.' + dto.name + '.set',
            JSON.stringify({ value: dto.value })
          );
          return model.getSetHistoryModel().createNew(model, instance);
        })
        .catch(err => {
          reject(err);
        });
    }
  });
}

module.exports = {
  createNewSetHistory: createNewSetHistory,
  createNew: createNew,
  requestSet: requestSet,
  instanceRequestSet: instanceRequestSet
};
