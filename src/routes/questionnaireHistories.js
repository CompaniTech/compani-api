'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { addQuestionnaireHistory, update } = require('../controllers/questionnaireHistoryController');
const { WEBAPP, START_COURSE, END_COURSE } = require('../helpers/constants');
const {
  authorizeAddQuestionnaireHistory,
  authorizeQuestionnaireHistoryUpdate,
} = require('./preHandlers/questionnaireHistories');

exports.plugin = {
  name: 'routes-questionnaire-histories',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            course: Joi.objectId().required(),
            user: Joi.objectId().required(),
            questionnaire: Joi.objectId().required(),
            questionnaireAnswersList: Joi.array().items(Joi.object({
              card: Joi.objectId().required(),
              answerList: Joi.array().items(Joi.string()).min(1).required(),
            })),
            origin: Joi.string().valid(WEBAPP),
            timeline: Joi
              .string()
              .valid(START_COURSE, END_COURSE)
              .when('origin', { is: Joi.exist(), then: Joi.required(), otherwise: Joi.forbidden() }),
          }),
        },
        auth: { mode: 'optional' },
        pre: [{ method: authorizeAddQuestionnaireHistory }],
      },
      handler: addQuestionnaireHistory,
    });
    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            trainerAnswers: Joi.array().items(Joi.object({ card: Joi.objectId(), answer: Joi.string() })),
            trainerComment: Joi.string(),
          }),
        },
        auth: { scope: ['questionnairehistories:edit'] },
        pre: [{ method: authorizeQuestionnaireHistoryUpdate }],
      },
      handler: update,
    });
  },
};
