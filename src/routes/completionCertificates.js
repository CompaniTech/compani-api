'use-strict';

const Joi = require('joi');
const { getCompletionCertificates } = require('../controllers/completionCertificatesController');
const { MM_YYYY } = require('../helpers/constants');

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
            months: Joi.array().items(Joi.string().valid(MM_YYYY)).min(1).required(),
          }),
        },
      },
      handler: getCompletionCertificates,
    });
  },
};
