'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { list, create, remove } = require('../controllers/courseBillingItemController');
const {
  authorizeCourseBillingItemCreation,
  authorizeBillingItemsDeletion,
} = require('./preHandlers/courseBillingItems');

exports.plugin = {
  name: 'routes-course-billing-items',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: { auth: { scope: ['vendorcompanies:edit'] } },
      handler: list,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            name: Joi.string().required(),
          }),
        },
        auth: { scope: ['vendorcompanies:edit'] },
        pre: [{ method: authorizeCourseBillingItemCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['vendorcompanies:edit'] },
        pre: [{ method: authorizeBillingItemsDeletion }],
      },
      handler: remove,
    });
  },
};
