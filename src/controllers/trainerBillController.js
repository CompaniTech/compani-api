const Boom = require('@hapi/boom');
const TrainerBillsHelper = require('../helpers/trainerBills');
const translate = require('../helpers/translate');

const { language } = translate;

const create = async (req) => {
  try {
    const trainerBill = await TrainerBillsHelper.createBill(req.payload, req.auth.credentials);

    return {
      message: translate[language].trainerBillCreated,
      data: { trainerBill },
    };
  } catch (e) {
    // Error code when there is a duplicate key, in this case : trainer + number (unique)
    if (e.code === 11000) {
      req.log(['error', 'db'], e);
      return Boom.conflict(translate[language].trainerBillNumberAlreadyUsed);
    }
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await TrainerBillsHelper.update(req.params._id, req.payload);

    return { message: translate[language].trainerBillUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    await TrainerBillsHelper.remove(req.params._id);

    return { message: translate[language].trainerBillRemoved };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { create, update, remove };
