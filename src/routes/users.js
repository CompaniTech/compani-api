'use strict';

const Joi = require('@hapi/joi');
Joi.objectId = require('joi-objectid')(Joi);

const {
  authenticate,
  create,
  createPasswordToken,
  list,
  listWithSectorHistories,
  activeList,
  show,
  exists,
  update,
  remove,
  refreshToken,
  forgotPassword,
  checkResetPasswordToken,
  updateCertificates,
  updateTask,
  getUserTasks,
  uploadFile,
  uploadImage,
  createDriveFolder,
  updatePassword,
} = require('../controllers/userController');
const { CIVILITY_OPTIONS } = require('../models/schemaDefinitions/identity');
const {
  getUser,
  authorizeUserUpdate,
  authorizeUserGetById,
  authorizeUserGet,
  authorizeUserCreation,
  authorizeUserUpdateWithoutCompany,
  authorizeUserDeletion,
} = require('./preHandlers/users');
const { addressValidation, objectIdOrArray, phoneNumberValidation } = require('./validations/utils');

const driveUploadKeys = [
  'idCardRecto',
  'idCardVerso',
  'passport',
  'residencePermitRecto',
  'residencePermitVerso',
  'healthAttest',
  'certificates',
  'phoneInvoice',
  'navigoInvoice',
  'transportInvoice',
  'mutualFund',
  'vitalCard',
  'medicalCertificate',
];

exports.plugin = {
  name: 'routes-users',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/authenticate',
      options: {
        validate: {
          payload: Joi.object().keys({
            email: Joi.string().email().required(),
            password: Joi.string().required(),
          }).required(),
        },
        auth: false,
      },
      handler: authenticate,
    });

    server.route({
      method: 'POST',
      path: '/',
      options: {
        auth: { scope: ['users:edit'] },
        validate: {
          payload: Joi.object().keys({
            company: Joi.objectId(),
            sector: Joi.objectId(),
            local: Joi.object().keys({ email: Joi.string().email().required() }).required(),
            role: Joi.objectId().required(),
            identity: Joi.object().keys({
              firstname: Joi.string().allow('', null),
              lastname: Joi.string(),
              title: Joi.string().valid(...CIVILITY_OPTIONS),
            }),
            contact: Joi.object().keys({
              phone: phoneNumberValidation.allow('', null),
              address: addressValidation,
            }),
            administrative: Joi.object().keys({
              transportInvoice: Joi.object().keys({
                transportType: Joi.string(),
              }),
            }),
            customers: Joi.array(),
          }).required(),
        },
        pre: [{ method: authorizeUserCreation }],
      },
      handler: create,
    });

    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: { scope: ['users:list'] },
        validate: {
          query: Joi.object({
            role: [Joi.array(), Joi.string()],
            email: Joi.string().email(),
            customers: objectIdOrArray,
            company: Joi.objectId(),
          }),
        },
        pre: [{ method: authorizeUserGet }],
      },
      handler: list,
    });

    server.route({
      method: 'GET',
      path: '/sector-histories',
      options: {
        auth: { scope: ['users:list'] },
        validate: { query: Joi.object({ company: Joi.objectId() }) },
        pre: [{ method: authorizeUserGet }],
      },
      handler: listWithSectorHistories,
    });

    server.route({
      method: 'GET',
      path: '/active',
      options: {
        auth: { scope: ['users:list'] },
        validate: {
          query: Joi.object({
            role: [Joi.array(), Joi.string()],
            email: Joi.string().email(),
            company: Joi.objectId(),
          }),
        },
        pre: [{ method: authorizeUserGet }],
      },
      handler: activeList,
    });

    server.route({
      method: 'GET',
      path: '/{_id}',
      options: {
        auth: { scope: ['users:edit', 'user:read-{params._id}'] },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserGetById },
        ],
      },
      handler: show,
    });

    server.route({
      method: 'GET',
      path: '/exists',
      options: {
        auth: { scope: ['users:exists'] },
        validate: {
          query: Joi.object({ email: Joi.string().email().required() }),
        },
      },
      handler: exists,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        auth: { scope: ['users:edit', 'user:edit-{params._id}'] },
        validate: {
          payload: Joi.object().keys({
            emergencyPhone: Joi.string(),
            sector: Joi.objectId(),
            'local.email': Joi.string().email(), // bot special case
            local: Joi.object().keys({
              email: Joi.string().email(),
            }),
            role: Joi.objectId(),
            picture: Joi.object().keys({
              link: Joi.string().allow(null),
              publicId: Joi.string().allow(null),
            }),
            mentor: Joi.string().allow('', null),
            identity: Joi.object().keys({
              firstname: Joi.string().allow('', null),
              lastname: Joi.string(),
              nationality: Joi.string(),
              birthDate: Joi.date(),
              birthCountry: Joi.string(),
              birthState: Joi.string(),
              birthCity: Joi.string(),
              socialSecurityNumber: Joi.number(),
            }),
            contact: Joi.object().keys({
              phone: phoneNumberValidation.allow('', null),
              address: addressValidation,
            }),
            administrative: Joi.object().keys({
              signup: Joi.object().keys({
                step: Joi.string(),
                complete: Joi.boolean(),
              }),
              identityDocs: Joi.string().valid('pp', 'cni', 'ts'),
              mutualFund: Joi.object().keys({
                has: Joi.boolean(),
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              navigoInvoice: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              transportInvoice: Joi.object().keys({
                transportType: Joi.string(),
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              phoneInvoice: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              healthAttest: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              idCardRecto: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              idCardVerso: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              passport: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              residencePermitRecto: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              residencePermitVerso: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              medicalCertificate: Joi.object().keys({
                driveId: Joi.string().allow(null),
                link: Joi.string().allow(null),
              }),
              socialSecurityNumber: Joi.number(),
              payment: Joi.object().keys({
                rib: Joi.object().keys({
                  iban: Joi.string(),
                  bic: Joi.string(),
                }),
              }),
              emergencyContact: Joi.object().keys({
                name: Joi.string(),
                phoneNumber: Joi.string(),
              }),
            }),
            procedure: Joi.object().keys({
              _id: Joi.objectId(),
              name: Joi.string(),
              isDone: Joi.boolean(),
            }),
            isActive: Joi.boolean(),
            establishment: Joi.objectId(),
            biography: Joi.string().allow(''),
            customers: Joi.array(),
            company: Joi.objectId(),
          }).required(),
        },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserUpdate },
          { method: authorizeUserUpdateWithoutCompany, assign: 'canEditWithoutCompany' },
        ],
      },
      handler: update,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/create-password-token',
      options: {
        auth: { scope: ['users:edit', 'user:edit-{params._id}'] },
        validate: {
          payload: Joi.object().keys({
            email: Joi.string().email().required(),
          }),
        },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserUpdate },
        ],
      },
      handler: createPasswordToken,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/password',
      options: {
        auth: { scope: ['user:edit-{params._id}'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
          payload: Joi.object().keys({
            local: Joi.object().keys({ password: Joi.string().min(6).required() }),
            isConfirmed: Joi.boolean(),
          }),
        },
      },
      handler: updatePassword,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/certificates',
      options: {
        auth: { scope: ['users:edit', 'user:edit-{params._id}'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
          payload: Joi.object().keys({
            certificates: Joi.object().keys({ driveId: Joi.string() }),
          }),
        },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserUpdate },
        ],
      },
      handler: updateCertificates,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/tasks/{task_id}',
      options: {
        auth: { scope: ['users:edit'] },
        validate: {
          params: Joi.object({
            _id: Joi.objectId(),
            task_id: Joi.objectId(),
          }),
          payload: Joi.object().keys({ isDone: Joi.boolean() }),
        },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserUpdate },
        ],
      },
      handler: updateTask,
    });

    server.route({
      method: 'GET',
      path: '/{_id}/tasks',
      options: {
        auth: { scope: ['users:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
        },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserGetById },
        ],
      },
      handler: getUserTasks,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        auth: { scope: ['users:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
        },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserDeletion },
        ],
      },
      handler: remove,
    });

    server.route({
      method: 'POST',
      path: '/refreshToken',
      options: {
        validate: {
          payload: Joi.object({ refreshToken: Joi.string().required() }),
        },
        auth: false,
      },
      handler: refreshToken,
    });

    server.route({
      method: 'POST',
      path: '/forgot-password',
      options: {
        validate: {
          payload: Joi.object().keys({
            email: Joi.string().email().required(),
          }),
        },
        auth: false,
      },
      handler: forgotPassword,
    });

    server.route({
      method: 'GET',
      path: '/check-reset-password/{token}',
      options: {
        validate: {
          params: Joi.object().keys({ token: Joi.string().required() }),
        },
        auth: false,
      },
      handler: checkResetPasswordToken,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/gdrive/{driveId}/upload',
      handler: uploadFile,
      options: {
        auth: { scope: ['users:edit', 'user:edit-{params._id}'] },
        payload: {
          output: 'stream',
          parse: true,
          allow: 'multipart/form-data',
          maxBytes: 5242880,
        },
        validate: {
          payload: Joi.object({
            date: Joi.date(),
            fileName: Joi.string().required(),
            type: Joi.string().required().valid(...driveUploadKeys),
            file: Joi.any().required(),
          }),
          params: Joi.object({
            _id: Joi.objectId().required(),
            driveId: Joi.string().required(),
          }),
        },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserUpdate },
        ],
      },
    });

    server.route({
      method: 'POST',
      path: '/{_id}/drivefolder',
      options: {
        auth: { scope: ['users:edit'] },
        validate: {
          params: Joi.object({ _id: Joi.objectId() }),
          payload: Joi.object().keys({
            parentFolderId: Joi.string().required(),
          }),
        },
        pre: [
          { method: getUser, assign: 'user' },
          { method: authorizeUserUpdate },
        ],
      },
      handler: createDriveFolder,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/cloudinary/upload',
      handler: uploadImage,
      options: {
        auth: { scope: ['users:edit', 'user:edit-{params._id}'] },
        payload: {
          output: 'stream',
          parse: true,
          allow: 'multipart/form-data',
          maxBytes: 5242880,
        },
      },
    });
  },
};
