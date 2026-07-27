const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { create } = require('../controllers/trainerInvoiceController');
const { authorizeTrainerInvoiceCreation } = require('./preHandlers/trainerInvoices');
const { formDataPayload, objectIdOrArray } = require('./validations/utils');

exports.plugin = {
  name: 'routes-trainer-invoices',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['trainerinvoices:edit'] },
        payload: formDataPayload(),
        validate: {
          payload: Joi.object({
            courseSlots: objectIdOrArray.required(),
            number: Joi.string().required(),
            file: Joi.any().required(),
          }),
        },
        pre: [{ method: authorizeTrainerInvoiceCreation }],
      },
      handler: create,
    });
  },
};
