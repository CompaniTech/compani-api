'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { payValidation } = require('./validations/pay');
const {
  draftPayList,
  createList,
  getHoursBalanceDetails,
  getHoursToWork,
} = require('../controllers/payController');
const { MONTH_VALIDATION, objectIdOrArray } = require('./validations/utils');
const { authorizePayCreation, authorizeGetDetails, authorizeGetHoursToWork } = require('./preHandlers/pay');


exports.plugin = {
  name: 'routes-pay',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/draft',
      options: {
        auth: { scope: ['pay:edit'] },
        validate: {
          query: {
            endDate: Joi.date(),
            startDate: Joi.date(),
          },
        },
      },
      handler: draftPayList,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['pay:edit'] },
        validate: {
          payload: Joi.array().items(Joi.object({
            ...payValidation,
          })),
        },
        pre: [{ method: authorizePayCreation }],
      },
      handler: createList,
    });

    server.route({
      method: 'GET',
      path: '/hours-balance-details',
      options: {
        auth: { scope: ['events:read'] },
        validate: {
          query: Joi.object().keys({
            sector: objectIdOrArray,
            auxiliary: Joi.objectId(),
            month: Joi.string().regex(new RegExp(MONTH_VALIDATION)).required(),
          }).xor('sector', 'auxiliary'),
        },
        pre: [{ method: authorizeGetDetails }],
      },
      handler: getHoursBalanceDetails,
    });

    server.route({
      method: 'GET',
      path: '/hours-to-work',
      options: {
        auth: { scope: ['pay:read'] },
        validate: {
          query: {
            sector: objectIdOrArray.required(),
            month: Joi.string().regex(new RegExp(MONTH_VALIDATION)).required(),
          },
        },
        pre: [{ method: authorizeGetHoursToWork }],
      },
      handler: getHoursToWork,
    });
  },
};
