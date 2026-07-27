const Boom = require('@hapi/boom');
const TrainerInvoicesHelper = require('../helpers/trainerInvoices');
const translate = require('../helpers/translate');

const { language } = translate;

const create = async (req) => {
  try {
    const trainerInvoice = await TrainerInvoicesHelper.createInvoice(req.payload, req.auth.credentials);

    return {
      message: translate[language].trainerInvoiceCreated,
      data: { trainerInvoice },
    };
  } catch (e) {
    // Error code when there is a duplicate key, in this case : trainer + number (unique)
    if (e.code === 11000) {
      req.log(['error', 'db'], e);
      return Boom.conflict(translate[language].trainerInvoiceNumberAlreadyUsed);
    }
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { create };
