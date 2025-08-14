const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Company = require('../../models/Company');
const CompanyHolding = require('../../models/CompanyHolding');
const Holding = require('../../models/Holding');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
const { TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN, CLIENT_ADMIN, HOLDING_ADMIN } = require('../../helpers/constants');
const User = require('../../models/User');
const { checkVendorUserExistsAndHasRightRole } = require('./utils');
const VendorCompany = require('../../models/VendorCompany');

const { language } = translate;

exports.doesCompanyExist = async (req) => {
  try {
    const company = await Company.countDocuments({ _id: req.params._id });
    if (!company) throw Boom.notFound(translate[language].CompanyNotFound);

    return true;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeCompanyUpdate = async (req) => {
  const { params, payload } = req;
  const updatedCompanyId = params._id;
  const { credentials } = req.auth;
  const vendorRole = get(req, 'auth.credentials.role.vendor.name');

  const isVendorAdmin = !!vendorRole && [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(vendorRole);
  if (!isVendorAdmin && !UtilsHelper.hasUserAccessToCompany(credentials, updatedCompanyId)) throw Boom.forbidden();

  const nameAlreadyExists = await Company
    .countDocuments({ _id: { $ne: updatedCompanyId }, name: payload.name }, { limit: 1 })
    .collation({ locale: 'fr', strength: 1 });
  if (nameAlreadyExists) throw Boom.conflict(translate[language].companyExists);

  if (payload.billingRepresentative) {
    const billingRepresentative = await User
      .findOne({ _id: payload.billingRepresentative }, { role: 1 })
      .populate({ path: 'company' })
      .populate({ path: 'holding' })
      .lean({ autopopulate: true });

    if (!billingRepresentative) throw Boom.notFound();

    const isClientAdminOfUpdatedCompany = get(billingRepresentative, 'role.client.name') === CLIENT_ADMIN &&
      UtilsHelper.areObjectIdsEquals(billingRepresentative.company, updatedCompanyId);

    if (!isClientAdminOfUpdatedCompany) {
      const companyHoldingExists = await CompanyHolding
        .countDocuments({ company: updatedCompanyId, holding: billingRepresentative.holding });
      const isHoldingAdminOfUpdatedCompanyHolding = get(billingRepresentative, 'role.holding.name') === HOLDING_ADMIN &&
        companyHoldingExists;
      if (!isHoldingAdminOfUpdatedCompanyHolding) throw Boom.notFound();
    }
  }

  if (payload.salesRepresentative) {
    await checkVendorUserExistsAndHasRightRole(payload.salesRepresentative, true);
  }

  return null;
};

exports.authorizeCompanyCreation = async (req) => {
  const { name, salesRepresentative, holding } = req.payload;
  const nameAlreadyExists = await Company
    .countDocuments({ name }, { limit: 1 })
    .collation({ locale: 'fr', strength: 1 });
  if (nameAlreadyExists) throw Boom.conflict(translate[language].companyExists);

  if (salesRepresentative) {
    await checkVendorUserExistsAndHasRightRole(salesRepresentative, true);
  }

  if (holding) {
    const holdingExists = await Holding.countDocuments({ _id: holding });
    if (!holdingExists) throw Boom.notFound();
  }

  return null;
};

exports.authorizeGetCompanies = async (req) => {
  const { holding } = req.query;

  if (holding) {
    const holdingExist = await Holding.countDocuments({ _id: holding });
    if (!holdingExist) throw Boom.notFound();

    const vendorRole = get(req, 'auth.credentials.role.vendor.name');

    if ([TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(vendorRole)) return null;

    const holdingRole = get(req, 'auth.credentials.role.holding.name');
    const userHolding = get(req, 'auth.credentials.holding._id');
    if (!(holdingRole === HOLDING_ADMIN && UtilsHelper.areObjectIdsEquals(holding, userHolding))) {
      throw Boom.forbidden();
    }
  }

  return null;
};

exports.authorizeGetCompany = async (req) => {
  const { credentials } = req.auth;
  const vendorRole = get(credentials, 'role.vendor.name');

  if ([TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(vendorRole)) return null;
  if (!UtilsHelper.hasUserAccessToCompany(credentials, req.params._id)) throw Boom.forbidden();

  return null;
};

exports.authorizeGetMandate = async (req) => {
  const company = await Company.findOne({ _id: req.params._id }).lean();
  if (!company) throw Boom.notFound();

  const mandateExist = company.debitMandates.find(dm => UtilsHelper.areObjectIdsEquals(dm._id, req.query.mandateId));
  if (!mandateExist) throw Boom.notFound();

  const vendorCompany = await VendorCompany.findOne().lean();
  if (!vendorCompany.bic || !vendorCompany.iban || !vendorCompany.ics) throw Boom.forbidden();

  return null;
};
