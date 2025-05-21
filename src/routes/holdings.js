'use-strict';

const Joi = require('joi');
const { authorizeHoldingCreation, authorizeHoldingUpdate, authorizeHoldingGet } = require('./preHandlers/holdings');
const { create, list, update, getById } = require('../controllers/holdingController');

exports.plugin = {
  name: 'routes-holdings',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['holdings:edit'] },
        validate: {
          payload: Joi.object({
            name: Joi.string().required(),
            address: Joi.string(),
          }),
        },
        pre: [{ method: authorizeHoldingCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['holdings:read'] },
      },
      handler: list,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['holdings:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object().keys({ companies: Joi.array().items(Joi.objectId()).required().min(1) }),
        },
        pre: [{ method: authorizeHoldingUpdate }],
      },
      handler: update,
    });

    server.route({
      method: 'GET',
      path: '/{_id}',
      options: {
        auth: { scope: ['holdings:read'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeHoldingGet }],
      },
      handler: getById,
    });
  },
};
