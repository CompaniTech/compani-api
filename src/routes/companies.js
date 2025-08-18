'use strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const {
  update,
  create,
  list,
  show,
  generateDocxMandate,
  updateMandate,
} = require('../controllers/companyController');
const {
  authorizeCompanyUpdate,
  authorizeCompanyCreation,
  doesCompanyExist,
  authorizeGetCompanies,
  authorizeGetCompany,
  authorizeGetMandate,
  authorizeMandateUpdate,
} = require('./preHandlers/companies');
const { addressValidation, ibanValidation, bicValidation } = require('./validations/utils');
const { LIST, DIRECTORY } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-companies',
  register: async (server) => {
    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['companies:edit', 'company-{params._id}'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object().keys({
            name: Joi.string(),
            address: addressValidation,
            iban: ibanValidation,
            bic: bicValidation,
            billingRepresentative: Joi.objectId(),
            salesRepresentative: Joi.objectId(),
          }),
        },
        pre: [
          { method: doesCompanyExist },
          { method: authorizeCompanyUpdate },
        ],
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/',
      handler: create,
      options: {
        auth: { scope: ['companies:create'] },
        validate: {
          payload: Joi.object().keys({
            name: Joi.string().required(),
            salesRepresentative: Joi.objectId(),
            holding: Joi.objectId(),
          }),
        },
        pre: [{ method: authorizeCompanyCreation }],
      },
    });

    server.route({
      method: 'GET',
      path: '/',
      handler: list,
      options: {
        validate: {
          query: Joi.object({
            withoutHoldingCompanies: Joi.boolean(),
            holding: Joi.objectId(),
            action: Joi.string().valid(LIST, DIRECTORY).default(LIST),
          }).oxor('withoutHoldingCompanies', 'holding'),
        },
        auth: { mode: 'optional' },
        pre: [{ method: authorizeGetCompanies }],
      },
    });

    server.route({
      method: 'GET',
      path: '/{_id}',
      handler: show,
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['companies:read'] },
        pre: [{ method: doesCompanyExist }, { method: authorizeGetCompany }],
      },
    });

    server.route({
      method: 'GET',
      path: '/{_id}/mandate',
      options: {
        auth: { scope: ['companies:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          query: Joi.object({ mandateId: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeGetMandate }],
      },
      handler: generateDocxMandate,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/mandates/{mandateId}',
      options: {
        auth: { scope: ['companies:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required(), mandateId: Joi.objectId().required() }),
          payload: Joi.object({ signedAt: Joi.date() }),
        },
        pre: [{ method: authorizeMandateUpdate }],
      },
      handler: updateMandate,
    });
  },
};
