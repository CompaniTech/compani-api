const Boom = require('@hapi/boom');
const get = require('lodash/get');
const translate = require('../helpers/translate');
const CompanyHelper = require('../helpers/companies');

const { language } = translate;

const update = async (req) => {
  try {
    const company = await CompanyHelper.updateCompany(req.params._id, req.payload);
    if (!company) return Boom.notFound(translate[language].companyNotFound);

    return {
      message: translate[language].companyUpdated,
      data: { company },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const uploadFile = async (req) => {
  try {
    const company = await CompanyHelper.uploadFile(req.payload, req.params);
    return { message: translate[language].fileCreated, data: { company } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    const newCompany = await CompanyHelper.createCompany(req.payload);

    return {
      message: translate[language].companyCreated,
      data: { company: newCompany },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const list = async (req) => {
  try {
    const companies = await CompanyHelper.list(req.query.hasHolding);

    return {
      message: translate[language].companiesFound,
      data: { companies },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const show = async (req) => {
  try {
    const company = await CompanyHelper.getCompany(req.params._id);

    return {
      message: translate[language].companyFound,
      data: { company },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getFirstIntervention = async (req) => {
  try {
    req.log('companyController - getFirstIntervention - company', get(req, 'auth.credentials.company._id'));
    const firstIntervention = await CompanyHelper.getFirstIntervention(req.auth.credentials);

    return {
      message: firstIntervention.length
        ? translate[language].companyFirstInterventionFound
        : translate[language].companyFirstInterventionNotFound,
      data: { firstIntervention: firstIntervention[0] },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  update,
  uploadFile,
  create,
  list,
  show,
  getFirstIntervention,
};
