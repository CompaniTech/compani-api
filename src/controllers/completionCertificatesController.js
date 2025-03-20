const Boom = require('@hapi/boom');
const translate = require('../helpers/translate');
const CompletionCertificatesHelper = require('../helpers/completionCertificates');

const { language } = translate;

const list = async (req) => {
  try {
    const completionCertificates = await CompletionCertificatesHelper.list(req.query);

    return { message: translate[language].completionCertificatesFound, data: { completionCertificates } };
  } catch (e) {
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await CompletionCertificatesHelper.generate(req);

    return { message: translate[language].completionCertificateUpdated };
  } catch (e) {
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { list, update };
