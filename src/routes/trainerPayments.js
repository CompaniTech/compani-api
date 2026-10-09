const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { list, update, remove } = require('../controllers/trainerPaymentController');
const { authorizeTrainerPaymentUpdate, authorizeTrainerPaymentDeletion } = require('./preHandlers/trainerPayments');
const { TRAINER_PAYMENT_STATUS } = require('../models/TrainerPayment');
const { PAID, PENDING } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-trainer-payments',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['trainerbills:edit'] },
        validate: {
          query: Joi.object({
            status: Joi
              .alternatives()
              .try(
                Joi.string().valid(...TRAINER_PAYMENT_STATUS),
                Joi.array().items(Joi.string().valid(...TRAINER_PAYMENT_STATUS)).min(1)
              )
              .required(),
          }),
        },
      },
      handler: list,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['trainerbills:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ status: Joi.string().valid(PENDING, PAID).required() }),
        },
        pre: [{ method: authorizeTrainerPaymentUpdate }],
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
        pre: [{ method: authorizeTrainerPaymentDeletion }],
      },
      handler: remove,
    });
  },
};
