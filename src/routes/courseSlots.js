'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { create, update, remove } = require('../controllers/courseSlotController');
const { addressValidation, requiredDateToISOString } = require('./validations/utils');
const { authorizeCreate, authorizeUpdate, authorizeDeletion } = require('./preHandlers/courseSlot');

exports.plugin = {
  name: 'routes-course-slots',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            course: Joi.objectId().required(),
            step: Joi.objectId().required(),
            quantity: Joi.number().integer().positive().required(),
          }),
        },
        pre: [{ method: authorizeCreate }],
        auth: { scope: ['courseslots:create'] },
      },
      handler: create,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            startDate: requiredDateToISOString.allow(''),
            endDate: requiredDateToISOString.allow(''),
            address: Joi.alternatives().try(addressValidation, {}),
            meetingLink: Joi.string().allow(''),
          }),
        },
        pre: [{ method: authorizeUpdate }],
        auth: { scope: ['courses:edit'] },
      },
      handler: update,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeDeletion }],
        auth: { scope: ['courseslots:create'] },
      },
      handler: remove,
    });
  },
};
