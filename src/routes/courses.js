'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  list,
  create,
  getById,
  getFollowUp,
  getQuestionnaireAnswers,
  update,
  deleteCourse,
  addTrainee,
  registerToELearningCourse,
  removeTrainee,
  downloadAttendanceSheets,
  downloadCompletionCertificates,
  sendSMS,
  getSMSHistory,
  addAccessRule,
  generateConvocationPdf,
  deleteAccessRule,
  getQuestionnaires,
  addCompany,
  removeCompany,
  generateTrainingContract,
} = require('../controllers/courseController');
const { MESSAGE_TYPE } = require('../models/CourseSmsHistory');
const { COURSE_TYPES, COURSE_FORMATS } = require('../models/Course');
const {
  authorizeTraineeAddition,
  authorizeTraineeDeletion,
  authorizeCourseEdit,
  authorizeCourseDeletion,
  authorizeGetList,
  authorizeRegisterToELearning,
  authorizeGetConvocationPdf,
  authorizeAccessRuleAddition,
  authorizeAccessRuleDeletion,
  authorizeGetCourse,
  authorizeGetFollowUp,
  authorizeCourseCreation,
  authorizeGetQuestionnaires,
  authorizeGetAttendanceSheets,
  authorizeGetDocuments,
  authorizeSmsSending,
  authorizeSmsGet,
  authorizeCourseCompanyAddition,
  authorizeCourseCompanyDeletion,
  authorizeGenerateTrainingContract,
  authorizeGetCompletionCertificates,
} = require('./preHandlers/courses');
const {
  INTRA,
  OPERATIONS,
  MOBILE,
  WEBAPP,
  PEDAGOGY,
  ORIGIN_OPTIONS,
  QUESTIONNAIRE,
  INTRA_HOLDING,
  FORMAT_OPTIONS,
  CUSTOM,
  TYPE_OPTIONS,
} = require('../helpers/constants');
const { dateToISOString } = require('./validations/utils');

exports.plugin = {
  name: 'routes-courses',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { mode: 'required' },
        validate: {
          query: Joi.object({
            action: Joi.string().required().valid(OPERATIONS, PEDAGOGY),
            origin: Joi.string().required().valid(...ORIGIN_OPTIONS),
            trainer: Joi.objectId().when(
              'action',
              {
                is: OPERATIONS,
                then: Joi.when('origin', { is: MOBILE, then: Joi.required() }),
                otherwise: Joi.forbidden(),
              }),
            trainee: Joi.objectId().when(
              'action',
              {
                is: PEDAGOGY,
                then: Joi.when('origin', { is: WEBAPP, then: Joi.required(), otherwise: Joi.forbidden() }),
                otherwise: Joi.forbidden(),
              }),
            company: Joi.objectId().when('origin', { is: MOBILE, then: Joi.forbidden() }),
            holding: Joi.objectId().when('origin', { is: MOBILE, then: Joi.forbidden() }),
            format: Joi.string().valid(...COURSE_FORMATS),
            isArchived: Joi.boolean(),
          }).oxor('company', 'holding'),
        },
        pre: [{ method: authorizeGetList }],
      },
      handler: list,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            type: Joi.string().required().valid(...COURSE_TYPES),
            subProgram: Joi.objectId().required(),
            misc: Joi.string().allow('', null),
            company: Joi.objectId().when('type', { is: INTRA, then: Joi.required(), otherwise: Joi.forbidden() }),
            operationsRepresentative: Joi.objectId().required(),
            estimatedStartDate: dateToISOString,
            maxTrainees: Joi
              .number()
              .when(
                'type',
                { is: Joi.valid(INTRA, INTRA_HOLDING), then: Joi.required(), otherwise: Joi.forbidden() }
              ),
            expectedBillsCount: Joi
              .number()
              .integer()
              .min(0)
              .when('type', { is: INTRA, then: Joi.required(), otherwise: Joi.forbidden() }),
            holding: Joi
              .objectId()
              .when('type', { is: INTRA_HOLDING, then: Joi.required(), otherwise: Joi.forbidden() }),
            hasCertifyingTest: Joi.boolean().required(),
            salesRepresentative: Joi.objectId(),
          }),
        },
        auth: { scope: ['courses:create'] },
        pre: [{ method: authorizeCourseCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'GET',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          query: Joi.object({
            action: Joi.string().required().valid(OPERATIONS, PEDAGOGY, QUESTIONNAIRE),
            origin: Joi.string()
              .when('action', { is: OPERATIONS, then: Joi.required(), otherwise: Joi.forbidden() })
              .valid(...ORIGIN_OPTIONS),
          }),
        },
        auth: { mode: 'optional' },
        pre: [{ method: authorizeGetCourse }],
      },
      handler: getById,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/follow-up',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          query: Joi.object({ company: Joi.objectId(), holding: Joi.objectId() }).oxor('company', 'holding'),
        },
        auth: { scope: ['courses:read'] },
        pre: [{ method: authorizeGetCourse }, { method: authorizeGetFollowUp }],
      },
      handler: getFollowUp,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/activities',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['courses:read'] },
        pre: [{ method: authorizeGetFollowUp }],
      },
      handler: getQuestionnaireAnswers,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/questionnaires',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['questionnaires:read'] },
        pre: [{ method: authorizeGetQuestionnaires }],
      },
      handler: getQuestionnaires,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            misc: Joi.string().allow('', null),
            trainer: Joi.objectId(),
            contact: Joi.objectId().allow(''),
            operationsRepresentative: Joi.objectId(),
            companyRepresentative: Joi.objectId(),
            archivedAt: Joi.date().allow(''),
            estimatedStartDate: dateToISOString,
            maxTrainees: Joi.number().positive().integer(),
            expectedBillsCount: Joi.number().min(0).integer(),
            hasCertifyingTest: Joi.boolean(),
            certifiedTrainees: Joi.array().items(Joi.objectId()),
          }),
        },
        pre: [{ method: authorizeCourseEdit }],
        auth: { scope: ['courses:edit'] },
      },
      handler: update,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['courses:create'] },
        pre: [{ method: authorizeCourseDeletion }],
      },
      handler: deleteCourse,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/sms',
      options: {
        auth: { scope: ['courses:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object().keys({
            content: Joi.string().required(),
            type: Joi.string().required().valid(...MESSAGE_TYPE),
          }).required(),
        },
        pre: [{ method: authorizeSmsSending }],
      },
      handler: sendSMS,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/sms',
      options: {
        auth: { scope: ['courses:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeSmsGet }],
      },
      handler: getSMSHistory,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/trainees',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            trainee: Joi.objectId().required(),
            company: Joi.objectId(),
            isCertified: Joi.boolean(),
          }),
        },
        pre: [{ method: authorizeCourseEdit }, { method: authorizeTraineeAddition }],
        auth: { scope: ['courses:edit'] },
      },
      handler: addTrainee,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/register-e-learning',
      options: {
        validate: { params: Joi.object({ _id: Joi.objectId().required() }) },
        pre: [{ method: authorizeRegisterToELearning }],
        auth: { mode: 'required' },
      },
      handler: registerToELearningCourse,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/trainees/{traineeId}',
      options: {
        auth: { scope: ['courses:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required(), traineeId: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeCourseEdit }, { method: authorizeTraineeDeletion }],
      },
      handler: removeTrainee,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/attendance-sheets',
      options: {
        auth: { scope: ['courses:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeGetDocuments }, { method: authorizeGetAttendanceSheets }],
      },
      handler: downloadAttendanceSheets,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/completion-certificates',
      options: {
        auth: { mode: 'required' },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          query: Joi.object({
            format: Joi.string().valid(...FORMAT_OPTIONS).required(),
            type: Joi.string().valid(...TYPE_OPTIONS).default(CUSTOM),
          }),
        },
        pre: [{ method: authorizeGetDocuments }, { method: authorizeGetCompletionCertificates }],
      },
      handler: downloadCompletionCertificates,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/accessrules',
      options: {
        validate: {
          payload: Joi.object({ company: Joi.string().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeAccessRuleAddition }],
      },
      handler: addAccessRule,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/accessrules/{accessRuleId}',
      options: {
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeAccessRuleDeletion }],
      },
      handler: deleteAccessRule,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/convocations',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { mode: 'optional' },
        pre: [{ method: authorizeGetConvocationPdf }],
      },
      handler: generateConvocationPdf,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/companies',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ company: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeCourseEdit }, { method: authorizeCourseCompanyAddition }],
        auth: { scope: ['courses:edit'] },
      },
      handler: addCompany,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/companies/{companyId}',
      options: {
        auth: { scope: ['courses:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required(), companyId: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeCourseEdit }, { method: authorizeCourseCompanyDeletion }],
      },
      handler: removeCompany,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/trainingcontracts',
      options: {
        auth: { scope: ['courses:create'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ price: Joi.number().positive().required(), company: Joi.objectId().required() }),
        },
        pre: [{ method: authorizeGenerateTrainingContract }],
      },
      handler: generateTrainingContract,
    });
  },
};
