const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { create, list, update } = require('../controllers/trainerMissionController');
const {
  authorizeTrainerMissionCreation,
  authorizeTrainerMissionGet,
  authorizeTrainerMissionEdit,
} = require('./preHandlers/trainerMissions');
const {
  formDataPayload,
  requiredDateToISOString,
  trainerMissionCoursesValidation,
} = require('./validations/utils');

exports.plugin = {
  name: 'routes-trainermissions',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['trainermissions:edit'] },
        payload: formDataPayload(),
        validate: {
          payload: Joi.object({
            trainer: Joi.objectId().required(),
            courses: trainerMissionCoursesValidation.required(),
            file: Joi.any(),
          }),
        },
        pre: [{ method: authorizeTrainerMissionCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['trainermissions:read', 'user:read-{query.trainer}'] },
        validate: {
          query: Joi.object({ trainer: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeTrainerMissionGet }],
      },
      handler: list,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['trainermissions:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ cancelledAt: requiredDateToISOString }),
        },
        pre: [{ method: authorizeTrainerMissionEdit }],
      },
      handler: update,
    });
  },
};
