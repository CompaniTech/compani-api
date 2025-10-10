'use-strict';

const Joi = require('joi');
const { create } = require('../controllers/xmlSEPAFileInfosController');
const { authorizeXMLFileDownload } = require('./preHandlers/xmlSEPAFileInfos');

const NAME_MAX_LENGTH = 140;

exports.plugin = {
  name: 'routes-xmlSEPAFileInfos',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['xml:create'] },
        validate: {
          payload: Joi.object({
            payments: Joi.array().items(Joi.objectId()).min(1).required(),
            name: Joi.string().required().max(NAME_MAX_LENGTH),
          }),
        },
        pre: [{ method: authorizeXMLFileDownload }],
      },
      handler: create,
    });
  },
};
