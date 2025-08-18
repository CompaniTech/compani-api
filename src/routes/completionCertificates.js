'use-strict';

const Joi = require('joi');
const { list, update, create, removeFile } = require('../controllers/completionCertificatesController');
const { monthValidation } = require('./validations/utils');
const {
  authorizeGetCompletionCertificates,
  authorizeCompletionCertificateEdit,
  authorizeCompletionCertificateCreation,
  authorizeCompletionCertificateFileDeletion,
} = require('./preHandlers/completionCertificates');
const { GENERATION } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-completion-certificates',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['completioncertificates:read'] },
        validate: {
          query: Joi.object({
            months: Joi.alternatives().try(Joi.array().items(monthValidation).min(1), monthValidation),
            course: Joi.objectId(),
            company: Joi.objectId(),
          }).xor('months', 'course', 'company'),
        },
        pre: [{ method: authorizeGetCompletionCertificates }],
      },
      handler: list,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['completioncertificates:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({ action: Joi.string().valid(GENERATION).required() }),
        },
        pre: [{ method: authorizeCompletionCertificateEdit }],
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['completioncertificates:edit'] },
        validate: {
          payload: Joi.object({
            trainee: Joi.objectId().required(),
            course: Joi.objectId().required(),
            month: monthValidation.required(),
          }),
        },
        pre: [{ method: authorizeCompletionCertificateCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/file',
      options: {
        auth: { scope: ['completioncertificates:edit'] },
        validate: { params: Joi.object({ _id: Joi.objectId().required() }) },
        pre: [{ method: authorizeCompletionCertificateFileDeletion }],
      },
      handler: removeFile,
    });
  },
};
