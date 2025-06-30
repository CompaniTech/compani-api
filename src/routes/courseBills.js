'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  list,
  update,
  addBillingPurchase,
  updateBillingPurchase,
  deleteBillingPurchase,
  generateBillPdf,
  deleteBillList,
  updateBillList,
  createBillList,
} = require('../controllers/courseBillController');
const { LIST, BALANCE, GROUP, TRAINEE, DASHBOARD } = require('../helpers/constants');
const {
  authorizeCourseBillListCreation,
  authorizeCourseBillGet,
  authorizeCourseBillUpdate,
  authorizeCourseBillingPurchaseAddition,
  authorizeCourseBillingPurchaseUpdate,
  authorizeCourseBillingPurchaseDelete,
  authorizeBillPdfGet,
  authorizeCourseBillListDeletion,
  authorizeCourseBillListEdition,
} = require('./preHandlers/courseBills');
const { requiredDateToISOString, dateToISOString } = require('./validations/utils');

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
            action: Joi.string().required().valid(LIST, BALANCE, DASHBOARD),
            course: Joi.objectId().when('action', { is: LIST, then: Joi.required(), otherwise: Joi.forbidden() }),
            company: Joi.objectId().when('action', { is: BALANCE, then: Joi.required(), otherwise: Joi.forbidden() }),
            startDate: Joi.when('action', { is: DASHBOARD, then: dateToISOString, otherwise: Joi.forbidden() }),
            endDate: Joi.when(
              'startDate',
              {
                is: Joi.exist(),
                then: dateToISOString && Joi.date().required().min(Joi.ref('startDate')),
                otherwise: Joi.forbidden(),
              }
            ),
            isValidated: Joi.boolean(),
          }),
        },
        pre: [{ method: authorizeCourseBillGet }],
      },
      handler: list,
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
                percentage: Joi.number().positive().integer().max(100),
                count: Joi.number().positive().integer(),
                countUnit: Joi.string().valid(GROUP, TRAINEE),
                description: Joi.string().allow(''),
              }),
              maturityDate: dateToISOString,
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
      path: '/list-edition',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          payload: Joi.object({ _ids: Joi.array().items(Joi.objectId()).min(1), billedAt: requiredDateToISOString }),
        },
        pre: [{ method: authorizeCourseBillListEdition }],
      },
      handler: updateBillList,
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
      method: 'POST',
      path: '/list-deletion',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          payload: Joi.object({ _ids: Joi.array().items(Joi.objectId()).min(1) }),
        },
        pre: [{ method: authorizeCourseBillListDeletion }],
      },
      handler: deleteBillList,
    });

    server.route({
      method: 'POST',
      path: '/list-creation',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          payload: Joi.object({
            quantity: Joi.number().positive().required(),
            course: Joi.objectId().required(),
            mainFee: Joi.object({
              price: Joi.number().positive(),
              percentage: Joi.number().positive().integer().max(100),
              count: Joi.number().positive().integer().required(),
              countUnit: Joi.string().required().valid(GROUP, TRAINEE),
              description: Joi.string().allow(''),
            }).required()
              .when(
                'quantity',
                {
                  is: 1,
                  then: Joi.object({ price: Joi.required() }),
                  otherwise: Joi.object({ price: Joi.forbidden() }),
                }
              ),
            companies: Joi.array().items(Joi.objectId()).min(1),
            payer: Joi.object({
              company: Joi.objectId(),
              fundingOrganisation: Joi.objectId(),
            }).xor('company', 'fundingOrganisation').required(),
            maturityDate: Joi.when('quantity', { is: 1, then: requiredDateToISOString }),
          }),
        },
        pre: [{ method: authorizeCourseBillListCreation }],
      },
      handler: createBillList,
    });
  },
};
