'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { list, create, remove } = require('../controllers/courseFundingOrganisationController');
const {
  authorizeCourseFundingOrganisationCreation,
  authorizeCourseFundingOrganisationDeletion,
} = require('./preHandlers/courseFundingOrganisation');

exports.plugin = {
  name: 'routes-course-funding-organisations',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: { auth: { scope: ['coursebills:edit'] } },
      handler: list,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            name: Joi.string().required(),
            address: Joi.string().required(),
          }),
        },
        auth: { scope: ['vendorcompanies:edit'] },
        pre: [{ method: authorizeCourseFundingOrganisationCreation }],
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
        pre: [{ method: authorizeCourseFundingOrganisationDeletion }],
      },
      handler: remove,
    });
  },
};
