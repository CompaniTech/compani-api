const Boom = require('@hapi/boom');
const CourseBillingItemHelper = require('../helpers/courseBillingItems');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const courseBillingItems = await CourseBillingItemHelper.list(req.auth.credentials);

    return {
      message: courseBillingItems.length
        ? translate[language].courseBillingItemsFound
        : translate[language].courseBillingItemsNotFound,
      data: { courseBillingItems },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    const courseBillingItem = await CourseBillingItemHelper.create(req.payload);

    return {
      message: translate[language].courseBillingItemCreated,
      data: { courseBillingItem },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    await CourseBillingItemHelper.delete(req.params);

    return {
      message: translate[language].courseBillingItemDeleted,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { list, create, remove };
