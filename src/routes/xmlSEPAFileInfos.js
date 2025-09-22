'use-strict';

const Joi = require('joi');
const { downloadXmlSEPAFile } = require('../controllers/xmlSEPAFileInfosController');
const { authorizeXMLFileDownload } = require('./preHandlers/xmlSEPAFileInfos');

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
            name: Joi.string().required(),
          }),
        },
        pre: [{ method: authorizeXMLFileDownload }],
      },
      handler: downloadXmlSEPAFile,
    });
  },
};
