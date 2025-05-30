'use strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { sendWelcome, sendBillEmail } = require('../controllers/emailController');
const { authorizeSendEmail } = require('./preHandlers/email');
const { HELPER, TRAINER, COACH, CLIENT_ADMIN, TRAINEE } = require('../helpers/constants');

exports.plugin = {
  name: 'routes-email',
  register: async (server) => {
    server.route({
      method: 'POST',
      path: '/send-welcome',
      options: {
        auth: { scope: ['email:send'] },
        validate: {
          payload: Joi.object().keys({
            email: Joi.string().email().required(),
            type: Joi.string().valid(HELPER, TRAINER, COACH, CLIENT_ADMIN, TRAINEE).required(),
          }),
        },
        pre: [
          { method: authorizeSendEmail },
        ],
      },
      handler: sendWelcome,
    });
    server.route({
      method: 'POST',
      path: '/bill',
      options: {
        auth: { scope: ['email:send'] },
        validate: {
          payload: Joi.object().keys({
            email: Joi.string().email().required(),
            pdf: Joi.object().required(),
            pdfName: Joi.string(),
          }),
        },
      },
      handler: sendBillEmail,
    });
  },
};
