'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  checkProgramExists,
  getProgramImagePublicId,
  checkCategoryExists,
  authorizeTesterAddition,
  checkTesterInProgram,
} = require('./preHandlers/programs');
const {
  list,
  listELearning,
  create,
  getById,
  update,
  uploadImage,
  addSubProgram,
  deleteImage,
  addCategory,
  removeCategory,
  addTester,
  removeTester,
} = require('../controllers/programController');
const { formDataPayload, phoneNumberValidation, countryCodeValidation } = require('./validations/utils');

exports.plugin = {
  name: 'routes-programs',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['programs:read'] },
      },
      handler: list,
    });

    server.route({
      method: 'GET',
      path: '/e-learning',
      options: {
        auth: { mode: 'required' },
        validate: {
          query: Joi.object({ _id: Joi.objectId() }),
        },
      },
      handler: listELearning,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        validate: {
          payload: Joi.object({
            name: Joi.string().required(),
            categories: Joi.array().items(Joi.objectId()).length(1).required(),
          }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: checkCategoryExists }],
      },
      handler: create,
    });

    server.route({
      method: 'GET',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:read'] },
        pre: [{ method: checkProgramExists }],
      },
      handler: getById,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            name: Joi.string(),
            description: Joi.string(),
            learningGoals: Joi.string(),
            image: Joi.object().keys({ link: Joi.string().allow(null), publicId: Joi.string().allow(null) }),
          }).min(1),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: checkProgramExists }],
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/categories',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ categoryId: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: checkProgramExists }, { method: checkCategoryExists }],
      },
      handler: addCategory,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/categories/{categoryId}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required(), categoryId: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: checkProgramExists }, { method: checkCategoryExists }],
      },
      handler: removeCategory,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/subprograms',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ name: Joi.string().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: checkProgramExists }],
      },
      handler: addSubProgram,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/upload',
      handler: uploadImage,
      options: {
        payload: formDataPayload(),
        validate: {
          payload: Joi.object({ fileName: Joi.string().required(), file: Joi.any().required() }),
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: checkProgramExists }],
      },
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/upload',
      handler: deleteImage,
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: getProgramImagePublicId, assign: 'publicId' }],
      },
    });

    server.route({
      method: 'POST',
      path: '/{_id}/testers',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            identity: Joi.object().keys({ firstname: Joi.string().allow(''), lastname: Joi.string() }),
            local: Joi.object().keys({ email: Joi.string().email().required() }).required(),
            contact: Joi
              .object()
              .keys({ phone: phoneNumberValidation, countryCode: countryCodeValidation })
              .and('phone', 'countryCode'),
          }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: checkProgramExists }, { method: authorizeTesterAddition }],
      },
      handler: addTester,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/testers/{testerId}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required(), testerId: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: checkProgramExists }, { method: checkTesterInProgram }],
      },
      handler: removeTester,
    });
  },
};
