const Boom = require('@hapi/boom');
const translate = require('../helpers/translate');
const EmailHelper = require('../helpers/email');

const { language } = translate;

const sendWelcome = async (req) => {
  try {
    const mailInfo = await EmailHelper.sendWelcome(req.payload.type, req.payload.email);

    return { message: translate[language].emailSent, data: { mailInfo } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const sendBillEmail = async (req) => {
  try {
    const { type, content, recipientEmails } = req.payload;
    const mailInfo = await EmailHelper
      .sendBillEmail(req.pre.courseBills, type, content, recipientEmails, req.auth.credentials);

    return { message: translate[language].emailSent, data: { mailInfo } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { sendWelcome, sendBillEmail };
