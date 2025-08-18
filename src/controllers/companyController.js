const Boom = require('@hapi/boom');
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
    const companies = await CompanyHelper.list(req.query);

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

const generateDocxMandate = async (req, h) => {
  try {
    const file = await CompanyHelper.generateMandate(req.params._id, req.query.mandateId);

    return h.file(file, { confine: false })
      .header('content-disposition')
      .type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const updateMandate = async (req) => {
  try {
    await CompanyHelper.updateMandate(req.params._id, req.params.mandateId, req.payload);

    return { message: translate[language].companyMandateUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
module.exports = {
  update,
  create,
  list,
  show,
  generateDocxMandate,
  updateMandate,
};
