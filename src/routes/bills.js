'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const {
  draftBillsList,
  createBills,
  generateBillPdf,
} = require('../controllers/billsController');
const { getBill, authorizeGetBill, authorizeGetBillPdf, authorizeBillsCreation } = require('./preHandlers/bills');
const { COMPANY_BILLING_PERIODS } = require('../models/Company');

exports.plugin = {
  name: 'routes-bill',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/drafts',
      options: {
        auth: { scope: ['bills:edit'] },
        validate: {
          query: {
            endDate: Joi.date().required(),
            startDate: Joi.date(),
            billingStartDate: Joi.date().required(),
            billingPeriod: Joi.string().valid(COMPANY_BILLING_PERIODS).required(),
            customer: Joi.objectId(),
          },
        },
        pre: [{ method: authorizeGetBill }],
      },
      handler: draftBillsList,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/pdfs',
      options: {
        validate: {
          params: { _id: Joi.objectId() },
        },
        pre: [
          { method: getBill, assign: 'bill' },
          { method: authorizeGetBillPdf },
        ],
      },
      handler: generateBillPdf,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['bills:edit'] },
        validate: {
          payload: {
            bills: Joi.array().items(Joi.object({
              customer: Joi.object().required(),
              endDate: Joi.date().required(),
              customerBills: Joi.object({
                bills: Joi.array().items(Joi.object({
                  _id: Joi.objectId(),
                  subscription: Joi.object().required(),
                  discount: Joi.number().required(),
                  startDate: Joi.date().required(),
                  endDate: Joi.date().required(),
                  unitExclTaxes: Joi.number().required(),
                  unitInclTaxes: Joi.number().required(),
                  eventsList: Joi.array().items(Joi.object({
                    event: Joi.objectId().required(),
                    startDate: Joi.date().required(),
                    endDate: Joi.date().required(),
                    auxiliary: Joi.objectId().required(),
                    inclTaxesCustomer: Joi.number().required(),
                    exclTaxesCustomer: Joi.number().required(),
                    inclTaxesTpp: Joi.number(),
                    exclTaxesTpp: Joi.number(),
                    thirdPartyPayer: Joi.objectId(),
                    surcharges: Joi.array().items(Joi.object({
                      percentage: Joi.number().required(),
                      name: Joi.string().required(),
                      startHour: Joi.date(),
                      endHour: Joi.date(),
                    })),
                  })).required(),
                  hours: Joi.number().required(),
                  inclTaxes: Joi.number().required(),
                  exclTaxes: Joi.number().required(),
                  vat: Joi.number().required(),
                  discountEdition: Joi.boolean(),
                })),
                shouldBeSent: Joi.boolean(),
                total: Joi.number(),
              }),
              thirdPartyPayerBills: Joi.array().items(Joi.object({
                bills: Joi.array().items(Joi.object({
                  _id: Joi.objectId(),
                  subscription: Joi.object().required(),
                  thirdPartyPayer: Joi.object().required(),
                  discount: Joi.number().required(),
                  startDate: Joi.date().required(),
                  endDate: Joi.date().required(),
                  unitExclTaxes: Joi.number().required(),
                  unitInclTaxes: Joi.number().required(),
                  eventsList: Joi.array().items(Joi.object({
                    event: Joi.objectId().required(),
                    startDate: Joi.date().required(),
                    endDate: Joi.date().required(),
                    auxiliary: Joi.objectId().required(),
                    inclTaxesCustomer: Joi.number().required(),
                    exclTaxesCustomer: Joi.number().required(),
                    inclTaxesTpp: Joi.number().required(),
                    exclTaxesTpp: Joi.number().required(),
                    thirdPartyPayer: Joi.objectId().required(),
                    history: Joi.object().required(),
                    fundingId: Joi.objectId(),
                    nature: Joi.string(),
                  })).required(),
                  hours: Joi.number().required(),
                  inclTaxes: Joi.number().required(),
                  exclTaxes: Joi.number().required(),
                  vat: Joi.number().required(),
                  discountEdition: Joi.boolean(),
                  externalBilling: Joi.boolean(),
                })),
                total: Joi.number(),
              })),
            })),
          },
        },
        pre: [{ method: authorizeBillsCreation }],
      },
      handler: createBills,
    });
  },
};
