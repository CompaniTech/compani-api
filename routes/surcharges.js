'use strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const {
  create,
  list,
  update,
  remove
} = require('../controllers/surchargeController');

exports.plugin = {
  name: 'routes-surcharges',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      handler: create,
      options: {
        auth: { scope: ['rhconfig:edit'] },
        validate: {
          payload: Joi.object().keys({
            name: Joi.string().required(),
            saturday: Joi.number().allow('', null),
            sunday: Joi.number().allow('', null),
            publicHoliday: Joi.number().allow('', null),
            twentyFifthOfDecember: Joi.number().allow('', null),
            firstOfMay: Joi.number().allow('', null),
            evening: Joi.number().allow('', null),
            eveningStartTime: Joi.string().allow('', null).when('evenings', { is: Joi.number().allow('', null), then: Joi.required() }),
            eveningEndTime: Joi.string().allow('', null).when('evenings', { is: Joi.number().allow('', null), then: Joi.required() }),
            custom: Joi.number().allow('', null),
            customStartTime: Joi.string().allow('', null).when('customs', { is: Joi.number().allow('', null), then: Joi.required() }),
            customEndTime: Joi.string().allow('', null).when('customs', { is: Joi.number().allow('', null), then: Joi.required() }),
            company: Joi.required(),
          }),
        },
      },
    });

    server.route({
      method: 'GET',
      path: '/',
      handler: list,
      options: {
        auth: { scope: ['rhconfig:edit'] },
        validate: {
          query: {
            company: Joi.objectId(),
          },
        },
      },
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      handler: remove,
      options: {
        auth: { scope: ['rhconfig:edit'] },
        validate: {
          params: {
            _id: Joi.objectId().required(),
          },
        },
      },
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      handler: update,
      options: {
        auth: { scope: ['rhconfig:edit'] },
        validate: {
          params: {
            _id: Joi.objectId().required(),
          },
          payload: Joi.object().keys({
            name: Joi.string(),
            saturday: Joi.number().allow('', null).default(null),
            sunday: Joi.number().allow('', null).default(null),
            publicHoliday: Joi.number().allow('', null).default(null),
            twentyFifthOfDecember: Joi.number().allow('', null).default(null),
            firstOfMay: Joi.number().allow('', null).default(null),
            evening: Joi.number().allow('', null).default(null),
            eveningStartTime: Joi.string().allow('', null).default('').when('evening', { is: Joi.number(), then: Joi.required() }),
            eveningEndTime: Joi.string().allow('', null).default('').when('evening', { is: Joi.number(), then: Joi.required() }),
            custom: Joi.number().allow('', null).default(null),
            customStartTime: Joi.string().allow('', null).default('').when('custom', { is: Joi.number(), then: Joi.required() }),
            customEndTime: Joi.string().allow('', null).default('').when('custom', { is: Joi.number(), then: Joi.required() }),
          }),
        },
      },
    });
  }
};
