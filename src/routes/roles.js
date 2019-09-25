'use strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { list } = require('../controllers/roleController');

exports.plugin = {
  name: 'routes-roles',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        validate: {
          query: Joi.object().keys({
            name: [Joi.string(), Joi.array().items(Joi.string())],
          }),
        },
      },
      handler: list,
    });
  },
};
