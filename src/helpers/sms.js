const axios = require('axios');
const Boom = require('@hapi/boom');
const get = require('lodash/get');
const UtilsHelper = require('./utils');
const { PASSWORD_SMS } = require('./constants');

exports.sendVerificationCodeSms = async (contact, code) => {
  await exports.send({
    tag: PASSWORD_SMS,
    content: `Votre code Compani : ${code}.`
      + ' Veuillez utiliser ce code, valable une heure, pour confirmer votre identité.',
    recipient: `${UtilsHelper.formatPhone(contact)}`,
    sender: 'Compani',
  });

  return contact;
};

/**
 * @param data { tag: string, content: string, recipient: string }
 */
exports.send = async (data) => {
  try {
    await axios({
      method: 'POST',
      url: 'https://api.sendinblue.com/v3/transactionalSMS/sms',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.SENDINBLUE_API_KEY,
      },
      data: {
        type: 'transactional',
        ...data,
        tag: process.env.NODE_ENV !== 'production' ? `Test - ${data.tag}` : data.tag,
        content: process.env.NODE_ENV !== 'production'
          ? `Sms de Test - ${data.content.substring(0, 100)}`
          : data.content,
      },
      json: true,
    });
  } catch (e) {
    throw Boom.badRequest(`SendinBlue - ${get(e, 'response.data.message')}`);
  }
};
