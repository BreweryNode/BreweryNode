const logutil = require('./logutil');
const mq = require('./mq');
const sensorutil = require('./sensorutil');

function createNew(model, dto) {
  return new Promise(function(resolve, reject) {
    sensorutil
      .createNew(model, dto)
      .then(instance => {
        return model.getSetHistoryModel().createNew(model, instance);
      })
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
}

function instanceReading(model, dto, instance) {
  return new Promise(function(resolve, reject) {
    sensorutil
      .instanceReading(model, dto, instance)
      .then(() => {
        return instance.checkRequestedChanged(model, dto);
      })
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
}

function checkRequestedChanged(model, dto, instance) {
  return new Promise(function(resolve) {
    if (model.doCompare(instance.value, instance.requestedValue)) {
      resolve();
    } else {
      mq
        .send(
          model.getName() + '.' + dto.name + '.set',
          JSON.stringify({ value: instance.requestedValue })
        )
        .then(() => {
          resolve();
        });
    }
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
      .then(() => {
        resolve();
      })
      .catch(err => {
        logutil.error('Error saving ' + model.getName() + ':\n' + err);
        reject();
      });
  });
}

function instanceRequestSet(model, dto, instance) {
  return new Promise(function(resolve, reject) {
    if (model.doCompare(instance.requestedValue, dto.value)) {
      resolve();
    } else {
      instance
        .update({ requestedValue: dto.value })
        .then(() => {
          return model.getSetHistoryModel().createNew(model, instance);
        })
        .then(() => {
          return mq.send(
            model.getName() + '.' + dto.name + '.set',
            JSON.stringify({ value: dto.value })
          );
        })
        .then(() => {
          resolve();
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
  instanceRequestSet: instanceRequestSet,
  instanceReading: instanceReading,
  checkRequestedChanged: checkRequestedChanged
};
