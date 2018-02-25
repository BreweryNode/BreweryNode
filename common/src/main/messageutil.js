const logutil = require('./logutil');

function handleMessage(model, msg) {
  let dto = JSON.parse(msg.content.toString());
  console.log(
    'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
  );
  switch (msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1)) {
    case 'createnew': {
      return model.createNew(model, dto);
    }
    case 'reading': {
      return model.reading(model, dto);
    }
    case 'set': {
      return model.requestSet(model, dto);
    }
    case 'getcurrent': {
      return model.getCurrent(model, dto);
    }
    case 'getallcurrent': {
      return model.getAllCurrent(model);
    }
    case 'gethistory': {
      return model.getHistoryModel().getHistory(model, model.getHistoryModel(), dto);
    }
    case 'valuechanged': {
      return new Promise(function(resolve) {
        resolve();
      });
    }
    default: {
      logutil.warn('Unknown ' + model.getName() + ' nesssage: ' + msg.fields.routingKey);
      return new Promise(function(resolve, reject) {
        reject();
      });
    }
  }
}

module.exports = {
  handleMessage: handleMessage
};
