const commonmodels = require('brewerynode-common').models;
const winston = require('winston');
const functions = require('brewerynode-common').models.functions;
const lockutils = require('brewerynode-common').lockutils;
const each = require('async-each');
const mq = require('brewerynode-common').mq;

let extraModels = [
  commonmodels.base,
  commonmodels.sensor,
  commonmodels.mutator,
  commonmodels.exact
];

const WARM_WATER_INPUT_OPEN = 1;
const WARM_WATER_OUTPUT_OPEN = 2;
const COLD_WATER_INPUT_OPEN = 4;
const COLD_WATER_OUTPUT_OPEN = 8;
const MAINS_WATER_INPUT_OPEN = 16;
const MAINS_WATER_OUTPUT_OPEN = 32;

function defineTable(sequelize, DataTypes) {
  let config = {
    name: 'Manifold',
    valueType: DataTypes.INTEGER,
    defaultValue: 0,
    fields: {
      warmWaterInput: { type: DataTypes.STRING, allowNull: false, unique: true },
      warmWaterOutput: { type: DataTypes.STRING, allowNull: false, unique: true },
      coldWaterInput: { type: DataTypes.STRING, allowNull: false, unique: true },
      coldWaterOutput: { type: DataTypes.STRING, allowNull: false, unique: true },
      mainsWaterInput: { type: DataTypes.STRING, allowNull: false, unique: true },
      mainsWaterOutput: { type: DataTypes.STRING, allowNull: false, unique: true }
    }
  };
  return functions.defineTable(sequelize, DataTypes, config, extraModels);
}

module.exports = (sequelize, DataTypes) => {
  let Manifold = defineTable(sequelize, DataTypes);
  functions.defineDTO(Manifold, extraModels);
  functions.defineVersions(Manifold, extraModels);
  functions.addMessageHandlers(Manifold, extraModels);
  functions.addUpdateProcessor(Manifold);

  Manifold.handleMessage = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    winston.info(
      'Handling message: "' + msg.fields.routingKey + '" : "' + msg.content.toString()
    );

    let key = msg.fields.routingKey.slice(msg.fields.routingKey.lastIndexOf('.') + 1);
    Manifold.messageHandlers[key](dto);
  };

  Manifold.checkValveChange = async function(dto, field, bitmask) {
    let manifolds = await Manifold.findAll({
      where: {
        [field]: dto.name
      },
      attributes: ['id']
    });
    if (manifolds !== null) {
      each(manifolds, async function(manifold) {
        manifold = await Manifold.lockByModel(manifold);
        let current = manifold.value;
        if (dto.value) {
          current |= bitmask;
        } else {
          current &= ~bitmask;
        }
        await manifold.update({ value: current });
        Manifold.unlock(manifold);
      });
    }
  };

  Manifold.handleValveChange = async function(msg) {
    let dto = JSON.parse(msg.content.toString());
    Manifold.checkValveChange(dto, 'warmWaterInput', WARM_WATER_INPUT_OPEN);
    Manifold.checkValveChange(dto, 'warmWaterOutput', WARM_WATER_OUTPUT_OPEN);
    Manifold.checkValveChange(dto, 'coldWaterInput', COLD_WATER_INPUT_OPEN);
    Manifold.checkValveChange(dto, 'coldWaterOutput', COLD_WATER_OUTPUT_OPEN);
    Manifold.checkValveChange(dto, 'mainsWaterInput', MAINS_WATER_INPUT_OPEN);
    Manifold.checkValveChange(dto, 'mainsWaterOutput', MAINS_WATER_OUTPUT_OPEN);
  };

  Manifold.doCompare = functions.booleanCompare;

  Manifold.checkValveStatus = async function(requestedValue, value, valve, bitmask) {
    if (((value & bitmask) ^ (requestedValue & bitmask)) === bitmask) {
      mq.send(
        'valve.v1.set',
        JSON.stringify({
          name: valve,
          value: (requestedValue & bitmask) === bitmask
        })
      );
    }
  };

  Manifold.prototype.process = async function() {
    let setValue = this.requestedValue;
    Manifold.checkValveStatus(
      setValue,
      this.value,
      this.warmWaterInput,
      WARM_WATER_INPUT_OPEN
    );
    Manifold.checkValveStatus(
      setValue,
      this.value,
      this.warmWaterOutput,
      WARM_WATER_OUTPUT_OPEN
    );
    Manifold.checkValveStatus(
      setValue,
      this.value,
      this.coldWaterInput,
      COLD_WATER_INPUT_OPEN
    );
    Manifold.checkValveStatus(
      setValue,
      this.value,
      this.coldWaterOutput,
      COLD_WATER_OUTPUT_OPEN
    );
    Manifold.checkValveStatus(
      setValue,
      this.value,
      this.mainsWaterInput,
      MAINS_WATER_INPUT_OPEN
    );
    Manifold.checkValveStatus(
      setValue,
      this.value,
      this.mainsWaterOutput,
      MAINS_WATER_OUTPUT_OPEN
    );
  };

  Manifold.bootstrap = async function() {
    let manifolds = await Manifold.findAll();
    if (manifolds !== null) {
      for (var i = 0; i < manifolds.length; i++) {
        manifolds[i].bootstrap();
      }
    }
  };

  Manifold.prototype.bootstrap = async function() {
    mq.send('valve.v1.getcurrentvalue', JSON.stringify({ name: this.warmWaterInput }));
    mq.send('valve.v1.getcurrentvalue', JSON.stringify({ name: this.warmWaterOutput }));
    mq.send('valve.v1.getcurrentvalue', JSON.stringify({ name: this.coldWaterInput }));
    mq.send('valve.v1.getcurrentvalue', JSON.stringify({ name: this.coldWaterOutput }));
    mq.send('valve.v1.getcurrentvalue', JSON.stringify({ name: this.mainsWaterInput }));
    mq.send('valve.v1.getcurrentvalue', JSON.stringify({ name: this.mainsWaterOutput }));
  };

  lockutils.lockHook(Manifold);

  module.exports.CLOSED = 0;
  module.exports.WARM_WATER = WARM_WATER_INPUT_OPEN | WARM_WATER_OUTPUT_OPEN;
  module.exports.FILL_WARM = MAINS_WATER_INPUT_OPEN | WARM_WATER_OUTPUT_OPEN;
  module.exports.DRAIN_WARM = WARM_WATER_INPUT_OPEN | MAINS_WATER_OUTPUT_OPEN;
  module.exports.COLD_WATER = COLD_WATER_INPUT_OPEN | COLD_WATER_OUTPUT_OPEN;
  module.exports.FILL_COLD = MAINS_WATER_INPUT_OPEN | COLD_WATER_OUTPUT_OPEN;
  module.exports.DRAIN_COLD = COLD_WATER_INPUT_OPEN | MAINS_WATER_OUTPUT_OPEN;
  module.exports.MAINS_WATER = MAINS_WATER_INPUT_OPEN | MAINS_WATER_OUTPUT_OPEN;

  return Manifold;
};
