'use-strict';

const Joi = require('joi');
const { seedDb } = require('../controllers/endToEndController');
const { authorizeDatabaseSeed } = require('./preHandlers/endToEnd');
const { PLANNING, AUTHENTICATION, BILLING } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-e2e',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/seed/{type}',
      options: {
        auth: false,
        validate: {
          params: Joi.object({
            type: Joi.string().required().valid(PLANNING, AUTHENTICATION, BILLING),
          }),
        },
        pre: [{ method: authorizeDatabaseSeed }],
      },
      handler: seedDb,
    });
  },
};
