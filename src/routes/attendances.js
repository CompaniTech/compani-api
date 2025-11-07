'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { list, listUnsubscribed, create, remove, update } = require('../controllers/attendanceController');
const {
  authorizeAttendancesGet,
  authorizeAttendanceCreation,
  authorizeAttendanceDeletion,
  authorizeUnsubscribedAttendancesGet,
  authorizeAttendanceEdition,
} = require('./preHandlers/attendances');

exports.plugin = {
  name: 'routes-attendances',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        validate: {
          query: Joi.alternatives().try(
            Joi.object({ courseSlot: Joi.objectId().required() }),
            Joi.object({ course: Joi.objectId().required() })
          ),
        },
        auth: { scope: ['attendances:read'] },
        pre: [{ method: authorizeAttendancesGet, assign: 'attendancesInfos' }],
      },
      handler: list,
    });

    server.route({
      method: 'GET',
      path: '/unsubscribed',
      options: {
        auth: { scope: ['attendances:read'] },
        validate: {
          query: Joi.alternatives().try(
            Joi.object({
              course: Joi.objectId().required(),
              company: Joi.objectId(),
              holding: Joi.objectId(),
            }).oxor('company', 'holding'),
            Joi.object({ trainee: Joi.objectId().required() })
          ),
        },
        pre: [{ method: authorizeUnsubscribedAttendancesGet }],
      },
      handler: listUnsubscribed,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({ trainee: Joi.objectId(), courseSlot: Joi.objectId().required() }),
        },
        auth: { scope: ['attendances:edit'] },
        pre: [{ method: authorizeAttendanceCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'PUT',
      path: '/',
      options: {
        validate: { query: Joi.object({ trainee: Joi.objectId(), courseSlot: Joi.objectId().required() }) },
        auth: { scope: ['attendances:edit'] },
        pre: [{ method: authorizeAttendanceEdition }],
      },
      handler: update,
    });

    server.route({
      method: 'DELETE',
      path: '/',
      options: {
        validate: { query: Joi.object({ trainee: Joi.objectId(), courseSlot: Joi.objectId().required() }) },
        auth: { scope: ['attendances:edit'] },
        pre: [{ method: authorizeAttendanceDeletion }],
      },
      handler: remove,
    });
  },
};
