'use-strict';

const Joi = require('@hapi/joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  list,
  create,
  getById,
  getPublicInfosById,
  update,
  addTrainee,
  removeTrainee,
  downloadAttendanceSheets,
  downloadCompletionCertificates,
  sendSMS,
  getSMSHistory,
} = require('../controllers/courseController');
const { MESSAGE_TYPE } = require('../models/CourseSmsHistory');
const { phoneNumberValidation } = require('./validations/utils');
const { getCourseTrainee, authorizeCourseEdit, authorizeGetCourseList } = require('./preHandlers/courses');
const { INTRA } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-courses',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['courses:read'] },
        validate: { query: Joi.object({ trainer: Joi.objectId(), company: Joi.objectId() }) },
        pre: [{ method: authorizeGetCourseList }],
      },
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
            company: Joi.objectId().when('type', { is: INTRA, then: Joi.required(), otherwise: Joi.forbidden() }),
          }),
        },
        auth: { scope: ['courses:create'] },
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
        auth: { scope: ['courses:read'] },
      },
      handler: getById,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/public-infos',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
        },
        auth: { mode: 'optional' },
      },
      handler: getPublicInfosById,
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
            contact: Joi.object({
              name: Joi.string(),
              phone: phoneNumberValidation,
              email: Joi.string().allow('', null),
            }).min(1),
          }),
        },
        pre: [{ method: authorizeCourseEdit }],
        auth: { scope: ['courses:edit'] },
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/sms',
      options: {
        auth: { scope: ['courses:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
          payload: Joi.object().keys({
            body: Joi.string().required(),
            type: Joi.string().required().valid(...MESSAGE_TYPE),
          }).required(),
        },
        pre: [{ method: authorizeCourseEdit }],
      },
      handler: sendSMS,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/sms',
      options: {
        auth: { scope: ['courses:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
        },
        pre: [{ method: authorizeCourseEdit }],
      },
      handler: getSMSHistory,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/trainees',
      options: {
        validate: {
          payload: Joi.object({
            identity: Joi.object().keys({
              firstname: Joi.string(),
              lastname: Joi.string(),
            }).min(1),
            local: Joi.object().keys({ email: Joi.string().email().required() }).required(),
            contact: Joi.object().keys({ phone: phoneNumberValidation }),
            company: Joi.objectId(),
          }),
        },
        pre: [{ method: getCourseTrainee, assign: 'trainee' }, { method: authorizeCourseEdit }],
        auth: { scope: ['courses:edit'] },
      },
      handler: addTrainee,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/trainees/{traineeId}',
      options: {
        auth: { scope: ['courses:edit'] },
        pre: [{ method: authorizeCourseEdit }],
      },
      handler: removeTrainee,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/attendance-sheets',
      options: {
        auth: { scope: ['courses:edit'] },
        pre: [{ method: authorizeCourseEdit }],
      },
      handler: downloadAttendanceSheets,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/completion-certificates',
      options: {
        auth: { scope: ['courses:edit'] },
        pre: [{ method: authorizeCourseEdit }],
      },
      handler: downloadCompletionCertificates,
    });
  },
};
