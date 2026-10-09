const Boom = require('@hapi/boom');
const TrainerPaymentsHelper = require('../helpers/trainerPayments');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const trainerPayments = await TrainerPaymentsHelper.list(req.query);

    return { data: { trainerPayments } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await TrainerPaymentsHelper.update(req.params._id, req.payload);

    return { message: translate[language].trainerPaymentUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    await TrainerPaymentsHelper.remove(req.params._id);

    return { message: translate[language].trainerPaymentRemoved };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { list, update, remove };
