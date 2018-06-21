'use strict';

const Joi = require('joi');

const { create } = require('../controllers/roleController');

exports.plugin = {
  name: 'routes-roles',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object().keys({
            name: Joi.string(),
            features: Joi.array(),
          })
        },
        auth: {
          strategy: 'jwt',
          scope: ['Admin', 'Tech', 'Coach']
        }
      },
      handler: create
    });
  }
};
