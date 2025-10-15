'use strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { create, update, list, updatePaymentList } = require('../controllers/coursePaymentController');
const {
  authorizeCoursePaymentCreation,
  authorizeCoursePaymentUpdate,
  authorizeCoursePaymentListEdition,
} = require('./preHandlers/coursePayments');
const { PAYMENT_NATURES } = require('../models/Payment');
const { COURSE_PAYMENT_TYPES, COURSE_PAYMENT_STATUS } = require('../models/CoursePayment');
const { XML_GENERATED } = require('../helpers/constants');
const { requiredDateToISOString } = require('./validations/utils');

exports.plugin = {
  name: 'routes-course-payments',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          payload: Joi.object({
            date: requiredDateToISOString.required(),
            courseBill: Joi.objectId().required(),
            netInclTaxes: Joi.number().min(0).required(),
            nature: Joi.string().valid(...PAYMENT_NATURES).required(),
            type: Joi.string().valid(...COURSE_PAYMENT_TYPES).required(),
          }),
        },
        pre: [{ method: authorizeCoursePaymentCreation }],
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
          payload: Joi.object({
            netInclTaxes: Joi.number().min(0).required(),
            type: Joi.string().valid(...COURSE_PAYMENT_TYPES).required(),
            date: requiredDateToISOString,
            status: Joi.string().valid(...COURSE_PAYMENT_STATUS).required(),
          }),
        },
        pre: [{ method: authorizeCoursePaymentUpdate }],
      },
      handler: update,
    });

    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['coursepayments:read'] },
        validate: {
          query: Joi.object({
            status: Joi
              .alternatives()
              .try(
                Joi.string().valid(...COURSE_PAYMENT_STATUS),
                Joi.array().items(Joi.string().valid(...COURSE_PAYMENT_STATUS)).min(1)
              )
              .required(),
          }),
        },
      },
      handler: list,
    });

    server.route({
      method: 'POST',
      path: '/list-edition',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          payload: Joi.object({
            _ids: Joi.array().items(Joi.objectId()).min(1).required(),
            status: Joi.string().valid(...COURSE_PAYMENT_STATUS.filter(s => s !== XML_GENERATED)).required(),
          }),
        },
        pre: [{ method: authorizeCoursePaymentListEdition }],
      },
      handler: updatePaymentList,
    });
  },
};
