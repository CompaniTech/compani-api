const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { create, update, remove } = require('../controllers/trainerBillController');
const {
  authorizeTrainerBillCreation,
  authorizeTrainerBillUpdate,
  authorizeTrainerBillDeletion,
} = require('./preHandlers/trainerBills');
const { formDataPayload, objectIdOrArray } = require('./validations/utils');
const { INVOICED, PAID } = require('../helpers/constants');

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

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['trainerbills:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ status: Joi.string().valid(INVOICED, PAID).required() }),
        },
        pre: [{ method: authorizeTrainerBillUpdate }],
      },
      handler: update,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        auth: { scope: ['trainerbills:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeTrainerBillDeletion }],
      },
      handler: remove,
    });
  },
};
