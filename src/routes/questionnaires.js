'use-strict';

const Joi = require('joi');
const { QUESTIONNAIRE_TYPES } = require('../models/Questionnaire');
const {
  list,
  create,
  getById,
  update,
  addCard,
  removeCard,
  getUserQuestionnaires,
} = require('../controllers/questionnaireController');
const {
  authorizeQuestionnaireGet,
  authorizeQuestionnaireCreation,
  authorizeQuestionnaireEdit,
  authorizeCardDeletion,
  authorizeUserQuestionnairesGet,
} = require('./preHandlers/questionnaires');
const { CARD_TEMPLATES } = require('../models/Card');
const { PUBLISHED } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-questionnaires',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['questionnaires:read'] },
      },
      handler: list,
    });

    server.route({
      method: 'GET',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { mode: 'required' },
        pre: [{ method: authorizeQuestionnaireGet }],
      },
      handler: getById,
    });

    server.route({
      method: 'GET',
      path: '/user',
      options: {
        validate: {
          query: Joi.object({ course: Joi.objectId().required() }),
        },
        auth: { mode: 'required' },
        pre: [{ method: authorizeUserQuestionnairesGet, assign: 'course' }],
      },
      handler: getUserQuestionnaires,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            name: Joi.string().required(),
            type: Joi.string().required().valid(...QUESTIONNAIRE_TYPES),
          }),
        },
        auth: { scope: ['questionnaires:edit'] },
        pre: [{ method: authorizeQuestionnaireCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/cards',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ template: Joi.string().required().valid(...CARD_TEMPLATES) }),

        },
        auth: { scope: ['questionnaires:edit'] },
        pre: [{ method: authorizeQuestionnaireEdit }],
      },
      handler: addCard,
    });

    server.route({
      method: 'DELETE',
      path: '/cards/{cardId}',
      options: {
        validate: { params: Joi.object({ cardId: Joi.objectId().required() }) },
        auth: { scope: ['questionnaires:edit'] },
        pre: [{ method: authorizeCardDeletion }],
      },
      handler: removeCard,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            name: Joi.string(),
            cards: Joi.array().items(Joi.objectId()),
            status: Joi.string().valid(PUBLISHED),
          }),
        },
        auth: { scope: ['questionnaires:edit'] },
        pre: [{ method: authorizeQuestionnaireEdit }],
      },
      handler: update,
    });
  },
};
