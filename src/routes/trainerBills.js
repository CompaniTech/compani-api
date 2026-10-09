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
            courseSlots: objectIdOrArray.required(),
            number: Joi.string().required(),
            file: Joi.any().required(),
          }),
        },
        pre: [{ method: authorizeTrainerBillCreation }],
      },
      handler: create,
    });
  },
};
