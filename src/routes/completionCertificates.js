'use-strict';

const Joi = require('joi');
const { list, update } = require('../controllers/completionCertificatesController');
const { monthValidation } = require('./validations/utils');
const {
  authorizeGetCompletionCertificates,
  authorizeCompletionCertificateEdit,
} = require('./preHandlers/completionCertificates');
const { GENERATION } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-completion-certificates',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['completioncertificates:read'] },
        validate: {
          query: Joi.object({
            months: Joi.alternatives().try(Joi.array().items(monthValidation).min(1), monthValidation),
            course: Joi.objectId(),
          }).xor('months', 'course'),
        },
        pre: [{ method: authorizeGetCompletionCertificates }],
      },
      handler: list,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['completioncertificates:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            action: Joi.string().valid(GENERATION).required(),
          }),
        },
        pre: [{ method: authorizeCompletionCertificateEdit }],
      },
      handler: update,
    });
  },
};
