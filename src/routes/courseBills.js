'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  list,
  create,
  update,
  addBillingPurchase,
  updateBillingPurchase,
  deleteBillingPurchase,
  generateBillPdf,
  deleteBill,
} = require('../controllers/courseBillController');
const { LIST, BALANCE, GROUP, TRAINEE } = require('../helpers/constants');
const {
  authorizeCourseBillCreation,
  authorizeCourseBillGet,
  authorizeCourseBillUpdate,
  authorizeCourseBillingPurchaseAddition,
  authorizeCourseBillingPurchaseUpdate,
  authorizeCourseBillingPurchaseDelete,
  authorizeBillPdfGet,
  authorizeCourseBillDeletion,
} = require('./preHandlers/courseBills');
const { requiredDateToISOString } = require('./validations/utils');

exports.plugin = {
  name: 'routes-course-bills',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['coursebills:read'] },
        validate: {
          query: Joi.object({
            action: Joi.string().required().valid(LIST, BALANCE),
            course: Joi.objectId().when('action', { is: LIST, then: Joi.required(), otherwise: Joi.forbidden() }),
            company: Joi.objectId().when('action', { is: BALANCE, then: Joi.required(), otherwise: Joi.forbidden() }),
          }),
        },
        pre: [{ method: authorizeCourseBillGet }],
      },
      handler: list,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          payload: Joi.object({
            course: Joi.objectId().required(),
            mainFee: Joi.object({
              price: Joi.number().positive().required(),
              count: Joi.number().positive().integer().required(),
              countUnit: Joi.string().required().valid(GROUP, TRAINEE),
              description: Joi.string().allow(''),
            }).required(),
            companies: Joi.array().items(Joi.objectId()).required().min(1),
            payer: Joi.object({
              company: Joi.objectId(),
              fundingOrganisation: Joi.objectId(),
            }).xor('company', 'fundingOrganisation').required(),
          }),
        },
        pre: [{ method: authorizeCourseBillCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.alternatives().try(
            Joi.object({
              payer: Joi.object({
                company: Joi.objectId(),
                fundingOrganisation: Joi.objectId(),
              }).oxor('company', 'fundingOrganisation'),
              mainFee: Joi.object({
                price: Joi.number().positive(),
                count: Joi.number().positive().integer(),
                countUnit: Joi.string().valid(GROUP, TRAINEE),
                description: Joi.string().allow(''),
              }),
            }),
            Joi.object({ billedAt: requiredDateToISOString })
          ),
        },
        pre: [{ method: authorizeCourseBillUpdate }],
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/billingpurchases',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            billingItem: Joi.objectId().required(),
            price: Joi.number().positive().required(),
            count: Joi.number().positive().integer().required(),
            description: Joi.string().allow(''),
          }),
        },
        pre: [{ method: authorizeCourseBillingPurchaseAddition }],
      },
      handler: addBillingPurchase,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/billingpurchases/{billingPurchaseId}',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required(), billingPurchaseId: Joi.objectId().required() }),
          payload: Joi.object({
            price: Joi.number().positive().required(),
            count: Joi.number().positive().integer().required(),
            description: Joi.string().allow(''),
          }),
        },
        pre: [{ method: authorizeCourseBillingPurchaseUpdate }],
      },
      handler: updateBillingPurchase,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/billingpurchases/{billingPurchaseId}',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required(), billingPurchaseId: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeCourseBillingPurchaseDelete }],
      },
      handler: deleteBillingPurchase,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/pdfs',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['coursebills:read'] },
        pre: [{ method: authorizeBillPdfGet, assign: 'companies' }],
      },
      handler: generateBillPdf,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeCourseBillDeletion }],
      },
      handler: deleteBill,
    });
  },
};
