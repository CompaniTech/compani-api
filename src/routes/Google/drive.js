'use strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { downloadFile } = require('../../controllers/driveController');

exports.plugin = {
  name: 'routes-gdrive',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/file/{id}/download',
      options: {
        validate: {
          params: Joi.object({ id: Joi.string().required() }),
        },
        auth: { strategy: 'jwt', mode: 'required' },
      },
      handler: downloadFile,
    });
  },
};
