const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { create, update, remove } = require('../controllers/trainerInvoiceController');
const {
  authorizeTrainerInvoiceCreation,
  authorizeTrainerInvoiceUpdate,
  authorizeTrainerInvoiceDeletion,
} = require('./preHandlers/trainerInvoices');
const { formDataPayload, objectIdOrArray } = require('./validations/utils');
const { INVOICED, PAID } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-trainer-invoices',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['trainerinvoices:create'] },
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

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['trainerinvoices:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ status: Joi.string().valid(INVOICED, PAID).required() }),
        },
        pre: [{ method: authorizeTrainerInvoiceUpdate }],
      },
      handler: update,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        auth: { scope: ['trainerinvoices:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeTrainerInvoiceDeletion }],
      },
      handler: remove,
    });
  },
};
