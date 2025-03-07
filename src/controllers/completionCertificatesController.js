const Boom = require('@hapi/boom');
const translate = require('../helpers/translate');
const CompletionCertificatesHelper = require('../helpers/completionCertificates');

const { language } = translate;

const getCompletionCertificates = async (req) => {
  try {
    console.log('req.query', req.query);

    await CompletionCertificatesHelper.getCompletionCertificates(req.query);

    return { message: translate[language].completionCertificateDone };
  } catch (e) {
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { getCompletionCertificates };
