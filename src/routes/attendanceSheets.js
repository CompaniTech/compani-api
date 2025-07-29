'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  list,
  create,
  deleteAttendanceSheet,
  updateAttendanceSheet,
  signAttendanceSheet,
} = require('../controllers/attendanceSheetController');
const { formDataPayload } = require('./validations/utils');
const {
  authorizeAttendanceSheetCreation,
  authorizeAttendanceSheetDeletion,
  authorizeAttendanceSheetsGet,
  authorizeAttendanceSheetEdit,
  authorizeAttendanceSheetSignature,
} = require('./preHandlers/attendanceSheets');
const { ORIGIN_OPTIONS, MOBILE, GENERATION } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-attendancesheets',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['attendances:read'] },
        validate: {
          query: Joi.object({
            course: Joi.objectId().required(),
            company: Joi.objectId(),
            holding: Joi.objectId(),
          }).oxor('company', 'holding'),
        },
        pre: [{ method: authorizeAttendanceSheetsGet }],
      },
      handler: list,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        payload: formDataPayload(),
        validate: {
          payload: Joi.object({
            course: Joi.objectId().required(),
            file: Joi.any(),
            trainees: Joi.alternatives().try(Joi.array().items(Joi.objectId()).min(1), Joi.objectId()),
            trainer: Joi.objectId().required(),
            date: Joi.date(),
            origin: Joi.string().valid(...ORIGIN_OPTIONS).default(MOBILE),
            slots: Joi
              .alternatives()
              .try(Joi.array().items(Joi.objectId()).min(1), Joi.objectId())
              .when('signature', { is: Joi.exist(), then: Joi.required() }),
            signature: Joi.any(),
          }).xor('trainees', 'date').xor('file', 'signature'),
        },
        auth: { scope: ['attendances:edit'] },
        pre: [{ method: authorizeAttendanceSheetCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['attendances:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            slots: Joi.array().items(Joi.objectId()).min(1),
            action: Joi.string().valid(GENERATION),
          }).xor('slots', 'action'),
        },
        pre: [{ method: authorizeAttendanceSheetEdit }],
      },
      handler: updateAttendanceSheet,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/signature',
      options: {
        auth: { mode: 'required' },
        payload: formDataPayload(),
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ signature: Joi.any().required() }),
        },
        pre: [{ method: authorizeAttendanceSheetSignature }],
      },
      handler: signAttendanceSheet,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['attendances:edit'] },
        pre: [{ method: authorizeAttendanceSheetDeletion }],
      },
      handler: deleteAttendanceSheet,
    });
  },
};
