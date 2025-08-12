const Boom = require('@hapi/boom');
const translate = require('../helpers/translate');
const VendorCompaniesHelper = require('../helpers/vendorCompanies');

const { language } = translate;

const get = async (req) => {
  try {
    const vendorCompany = await VendorCompaniesHelper.get();

    return {
      message: translate[language].vendorCompanyFound,
      data: { vendorCompany },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await VendorCompaniesHelper.update(req.payload);

    return {
      message: translate[language].vendorCompanyUpdated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const uploadTemplate = async (req) => {
  try {
    await VendorCompaniesHelper.uploadDebitMandateTemplate(req.payload);

    return { message: translate[language].vendorCompanyUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeTemplate = async (req) => {
  try {
    await VendorCompaniesHelper.removeDebitMandateTemplate();

    return { message: translate[language].vendorCompanyUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { get, update, uploadTemplate, removeTemplate };
