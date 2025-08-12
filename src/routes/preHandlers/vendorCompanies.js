const Boom = require('@hapi/boom');
const { get } = require('lodash');
const User = require('../../models/User');
const VendorCompany = require('../../models/VendorCompany');
const { VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER } = require('../../helpers/constants');

exports.authorizeVendorCompanyUpdate = async (req) => {
  const { payload } = req;

  if (payload.billingRepresentative) {
    const billingRepresentative = await User
      .findOne({ _id: payload.billingRepresentative }, { role: 1 })
      .lean({ autopopulate: true });

    if (![VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(get(billingRepresentative, 'role.vendor.name'))) {
      throw Boom.forbidden();
    }
  }
  return null;
};

exports.authorizeTemplateDeletion = async () => {
  const vendorCompany = await VendorCompany.findOne({ debitMandateTemplate: { $exists: true } }).lean();
  if (!vendorCompany) throw Boom.notFound();

  return null;
};
