'use-strict';

const Joi = require('@hapi/joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  list,
  create,
  getById,
  update,
  addTrainee,
  removeTrainee,
  downloadAttendanceSheets,
} = require('../controllers/courseController');
const { phoneNumberValidation } = require('./validations/utils');
const { getCourseTrainee } = require('./preHandlers/courses');

exports.plugin = {
  name: 'routes-courses',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: { auth: { scope: ['courses:read'] } },
      handler: list,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            name: Joi.string().required(),
            type: Joi.string().required(),
            program: Joi.objectId().required(),
            companies: Joi.array().items(Joi.objectId()).required().min(1),
          }),
        },
        auth: { scope: ['courses:edit'] },
      },
      handler: create,
    });

    server.route({
      method: 'GET',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
        },
        auth: false,
      },
      handler: getById,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
          payload: Joi.object({
            name: Joi.string(),
            trainer: Joi.objectId(),
          }),
        },
        auth: { scope: ['courses:edit'] },
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/trainees',
      options: {
        validate: {
          payload: Joi.object({
            identity: Joi.object().keys({
              firstname: Joi.string(),
              lastname: Joi.string().required(),
            }).required(),
            local: Joi.object().keys({ email: Joi.string().email().required() }).required(),
            contact: Joi.object().keys({ phone: phoneNumberValidation }),
            company: Joi.objectId().required(),
          }),
        },
        pre: [{ method: getCourseTrainee, assign: 'trainee' }],
        auth: { scope: ['courses:edit'] },
      },
      handler: addTrainee,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/trainees/{traineeId}',
      options: {
        auth: { scope: ['courses:edit'] },
      },
      handler: removeTrainee,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/attendancesheets',
      options: {
        auth: { scope: ['courses:edit'] },
      },
      handler: downloadAttendanceSheets,
    });
  },
};
