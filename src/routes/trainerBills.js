const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { create, list } = require('../controllers/trainerBillController');
const { authorizeTrainerBillCreation } = require('./preHandlers/trainerBills');
const { formDataPayload, objectIdOrArray } = require('./validations/utils');

exports.plugin = {
  name: 'routes-trainer-bills',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['trainerbills:create'] },
        payload: formDataPayload(),
        validate: {
          payload: Joi.object({
            courseSlots: objectIdOrArray,
            number: Joi.string().required(),
            file: Joi.any().required(),
            amount: Joi.number().positive(),
            course: Joi.objectId(),
          }).xor('amount', 'courseSlots').oxor('course', 'courseSlots'),
        },
        pre: [{ method: authorizeTrainerBillCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['trainerbills:create'] },
      },
      handler: list,
    });
  },
};
