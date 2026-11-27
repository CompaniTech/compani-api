'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { studyTracksDurationsValidation } = require('./validations/utils');
const { create } = require('../controllers/studyTrackController');
const { MILESTONE_TARGETS, STEP_TARGETS } = require('../helpers/constants');
const { authorizeStudyTrackCreation } = require('./preHandlers/studyTracks');

exports.plugin = {
  name: 'routes-study-tracks',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            name: Joi.string(),
            subProgram: Joi.objectId().required(),
            detailsPerStep: Joi.array()
              .items(Joi.object({
                step: Joi.objectId().required(),
                durations: studyTracksDurationsValidation.required(),
                targets: Joi.array().items(Joi.string().valid(...STEP_TARGETS)).min(1),
              }))
              .min(1),
            eLearningDurations: studyTracksDurationsValidation,
            milestones: Joi.array()
              .items(Joi.object({
                month: Joi.number().integer().min(0).required(),
                label: Joi.string().required(),
                targets: Joi.array().items(Joi.string().valid(...MILESTONE_TARGETS)).min(1).required(),
              }))
              .min(1),
          }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeStudyTrackCreation }],
      },
      handler: create,
    });
  },
};
