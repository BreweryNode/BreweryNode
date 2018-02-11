'use strict';
var dto = require('dto');

module.exports = (sequelize, DataTypes) => {
    var Log = sequelize.define('Log', {
            id: {type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4},
            message: {type: DataTypes.STRING},
            level: {type: DataTypes.ENUM, values: ['error', 'warn', 'info', 'verbose', 'debug', 'silly']},
            revision: {type: DataTypes.INTEGER, defaultValue: 0}
        }
    );

    Log.prototype.toDTO = function () {
        return JSON.stringify(dto.take.only(this.dataValues, ['message', 'level']));
    };

    return Log;
};