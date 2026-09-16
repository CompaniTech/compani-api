'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  authorizeActivityAddition,
  authorizeActivityReuse,
  authorizeActivityDetachment,
  authorizeStepUpdate,
  authorizeGetStep,
} = require('./preHandlers/steps');
const { update, addActivity, detachActivity, reuseActivity, list } = require('../controllers/stepController');
const { ACTIVITY_TYPES } = require('../models/Activity');
const { durationStrictlyPositive } = require('./validations/utils');

const activityIdExists = { is: Joi.exist(), then: Joi.forbidden(), otherwise: Joi.required() };

exports.plugin = {
  name: 'routes-steps',
  register: async (server) => {
    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            name: Joi.string(),
            activities: Joi.array().items(Joi.objectId()),
            theoreticalDuration: durationStrictlyPositive,
            durationCountedPerTrainer: Joi.boolean(),
          }).min(1),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeStepUpdate }],
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/activities',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            name: Joi.string().when('activityId', activityIdExists),
            type: Joi.string().when('activityId', activityIdExists).valid(...ACTIVITY_TYPES),
            activityId: Joi.objectId(),
          }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeActivityAddition }],
      },
      handler: addActivity,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/activities',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ activities: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeActivityReuse }],
      },
      handler: reuseActivity,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/activities/{activityId}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required(), activityId: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeActivityDetachment }],
      },
      handler: detachActivity,
    });

    server.route({
      method: 'GET',
      path: '/',
      options: {
        validate: {
          query: Joi.object({ program: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeGetStep }],
      },
      handler: list,
    });
  },
};
