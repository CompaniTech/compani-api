const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { create, list, remove } = require('../controllers/trainingContractController');
const {
  authorizeTrainingContractUpload,
  authorizeTrainingContractGet,
  authorizeTrainingContractDeletion,
} = require('./preHandlers/trainingContracts');

const { formDataPayload } = require('./validations/utils');

exports.plugin = {
  name: 'routes-trainingcontracts',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['courses:create'] },
        payload: formDataPayload(),
        validate: {
          payload: Joi.object({
            course: Joi.objectId().required(),
            file: Joi.any().required(),
            company: Joi.objectId().required(),
            startDate: Joi.date(),
          }),
        },
        pre: [{ method: authorizeTrainingContractUpload }],
      },
      handler: create,
    });

    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['trainingcontracts:read'] },
        validate: {
          query: Joi.object({
            course: Joi.objectId().required(),
            company: Joi.objectId(),
            holding: Joi.objectId(),
          }).oxor('company', 'holding'),
        },
        pre: [{ method: authorizeTrainingContractGet }],
      },
      handler: list,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['courses:create'] },
        pre: [{ method: authorizeTrainingContractDeletion }],
      },
      handler: remove,
    });
  },
};
