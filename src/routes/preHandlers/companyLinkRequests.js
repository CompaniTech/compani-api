const get = require('lodash/get');
const Boom = require('@hapi/boom');
const UserCompany = require('../../models/UserCompany');
const Company = require('../../models/Company');
const CompanyLinkRequest = require('../../models/CompanyLinkRequest');

exports.authorizeCompanyLinkRequestCreation = async (req) => {
  const userId = get(req, 'auth.credentials._id', null);
  const hasCompany = await UserCompany.countDocuments({ user: userId });
  if (hasCompany) throw Boom.forbidden();

  const { company } = req.payload;
  const companyExists = await Company.countDocuments({ _id: company });
  if (!companyExists) throw Boom.notFound();

  const companyLinkRequestAlreadyExists = await CompanyLinkRequest.countDocuments({ user: userId });
  if (companyLinkRequestAlreadyExists) throw Boom.forbidden();

  return null;
};
