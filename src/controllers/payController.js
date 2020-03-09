const Boom = require('@hapi/boom');
const translate = require('../helpers/translate');
const { getDraftPay } = require('../helpers/draftPay');
const { createPayList, hoursBalanceDetail, getHoursToWorkBySector } = require('../helpers/pay');

const { language } = translate;

const draftPayList = async (req) => {
  try {
    const draftPay = await getDraftPay(req.query, req.auth.credentials);

    return {
      message: translate[language].draftPay,
      data: { draftPay },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const createList = async (req) => {
  try {
    await createPayList(req.payload, req.auth.credentials);

    return { message: translate[language].payListCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getHoursBalanceDetails = async (req) => {
  try {
    const { query, auth } = req;
    const detail = await hoursBalanceDetail(query, auth.credentials);
    return {
      message: translate[language].hoursBalanceDetail,
      data: { hoursBalanceDetail: detail },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getHoursToWork = async (req) => {
  try {
    const hoursToWork = await getHoursToWorkBySector(req.query, req.auth.credentials);

    return {
      message: translate[language].hoursToWorkFound,
      data: { hoursToWork },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  draftPayList,
  createList,
  getHoursBalanceDetails,
  getHoursToWork,
};
