'use-strict';

const Joi = require('joi');
const { list } = require('../controllers/completionCertificatesController');
const { monthValidation } = require('./validations/utils');
const { authorizeGetCompletionCertificates } = require('./preHandlers/completionCertificates');

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
  },
};
