const Boom = require('@hapi/boom');
const translate = require('../helpers/translate');
const CompletionCertificatesHelper = require('../helpers/completionCertificates');

const { language } = translate;

const getCompletionCertificates = async (req) => {
  try {
    const completionCertificates = await CompletionCertificatesHelper.getCompletionCertificates(req.query);

    return { message: translate[language].completionCertificateDone, data: { completionCertificates } };
  } catch (e) {
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { getCompletionCertificates };
