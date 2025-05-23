'use strict';

const Joi = require('joi');
const { completionCertificateCreation } = require('../controllers/scriptController');
const { monthValidation } = require('./validations/utils');

exports.plugin = {
  name: 'routes-scripts',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/completioncertificates-generation',
      options: {
        auth: { scope: ['scripts:run'] },
        validate: {
          query: Joi.object({ month: monthValidation.required() }),
        },
      },
      handler: completionCertificateCreation,
    });
  },
};
