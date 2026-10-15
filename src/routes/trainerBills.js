const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { create } = require('../controllers/trainerBillController');
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
            amount: Joi.number().positive()
              .when('courseSlots', { is: Joi.exist(), then: Joi.forbidden(), otherwise: Joi.required() }),
          }),
        },
        pre: [{ method: authorizeTrainerBillCreation }],
      },
      handler: create,
    });
  },
};
