const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Payment = require('../../models/Payment');
const Customer = require('../../models/Customer');
const ThirdPartyPayer = require('../../models/ThirdPartyPayer');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.getPayment = async (req) => {
  try {
    const payment = await Payment.findOne({ _id: req.params._id }).lean();
    if (!payment) throw Boom.notFound(translate[language].paymentNotFound);

    return payment;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizePaymentUpdate = (req) => {
  try {
    const { credentials } = req.auth;
    const { payment } = req.pre;
    if (payment.company.toHexString() === get(credentials, 'company._id', null).toHexString()) return null;

    throw Boom.forbidden();
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizePaymentsListCreation = async (req) => {
  try {
    const { credentials } = req.auth;

    const customersIds = [...new Set(req.payload.map(payment => payment.customer))];
    const customersCount = await Customer.countDocuments({
      _id: { $in: customersIds },
      company: get(credentials, 'company._id', null),
    });
    if (customersCount === customersIds.length) return null;

    throw Boom.forbidden();
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizePaymentCreation = async (req) => {
  try {
    const { credentials } = req.auth;
    const payment = req.payload;
    const companyId = get(credentials, 'company._id', null).toHexString();

    const customer = await Customer.findOne({ _id: payment.customer, company: companyId }).lean();
    if (!customer) throw Boom.forbidden();

    if (payment.thirdPartyPayer) {
      const tpp = await ThirdPartyPayer.findOne({ _id: payment.thirdPartyPayer, company: companyId }).lean();
      if (!tpp) throw Boom.forbidden();
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
