'use strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { sendWelcome, sendBillEmail } = require('../controllers/emailController');
const { authorizeSendEmail, authorizeSendEmailBillList } = require('./preHandlers/email');
const {
  HELPER,
  TRAINER,
  COACH,
  CLIENT_ADMIN,
  TRAINEE,
  VAEI,
  START_COURSE,
  MIDDLE_COURSE,
  END_COURSE,
} = require('../helpers/constants');

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
      path: '/send-coursebill-list',
      options: {
        auth: { scope: ['coursebills:edit'] },
        validate: {
          payload: Joi.object().keys({
            bills: Joi.array().items(Joi.objectId()).min(1).required(),
            content: Joi.string().required(),
            type: Joi.string().valid(VAEI, START_COURSE, MIDDLE_COURSE, END_COURSE).required(),
            recipientEmails: Joi.array().items(Joi.string().email()).min(1).required(),
          }),
        },
        pre: [{ method: authorizeSendEmailBillList, assign: 'courseBills' }],
      },
      handler: sendBillEmail,
    });
  },
};
