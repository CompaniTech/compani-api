'use-strict';

const Joi = require('joi');
const { get, update, uploadTemplate } = require('../controllers/vendorCompanyController');
const { authorizeVendorCompanyUpdate } = require('./preHandlers/vendorCompanies');
const {
  addressValidation,
  siretValidation,
  ibanValidation,
  bicValidation,
  icsValidation,
  formDataPayload,
} = require('./validations/utils');

exports.plugin = {
  name: 'routes-vendor-companies',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['vendorcompanies:read'] },
      },
      handler: get,
    });

    server.route({
      method: 'PUT',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            name: Joi.string(),
            address: addressValidation,
            siret: siretValidation,
            iban: ibanValidation,
            bic: bicValidation,
            activityDeclarationNumber: Joi.string(),
            billingRepresentative: Joi.objectId(),
            shareCapital: Joi.number().positive(),
            ics: icsValidation,
          }),
        },
        auth: { scope: ['vendorcompanies:edit'] },
        pre: [{ method: authorizeVendorCompanyUpdate }],
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/mandate/upload',
      options: {
        auth: { scope: ['vendorcompanies:edit'] },
        payload: formDataPayload(),
        validate: {
          payload: Joi.object({ file: Joi.any().required() }),
        },
      },
      handler: uploadTemplate,
    });
  },
};
