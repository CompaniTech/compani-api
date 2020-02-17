const Boom = require('boom');
const moment = require('moment');
const has = require('lodash/has');
const Customer = require('../models/Customer');
const { populateService } = require('./subscriptions');
const UtilsHelper = require('./utils');
const translate = require('./translate');

const { language } = translate;

exports.checkSubscriptionFunding = async (customerId, checkedFunding) => {
  const customer = await Customer.findOne({ _id: customerId }).lean();
  if (!customer) throw Boom.notFound('Error while checking subscription funding: customer not found.');

  if (!customer.fundings || customer.fundings.length === 0) return true;

  /* We allow two fundings to have the same subscription only if :
  *     - the 2 fundings are not on the same period
  *     - or the 2 fundings are on the same period but not the same days
  */
  return customer.fundings
    .filter(fund => checkedFunding.subscription === fund.subscription.toHexString() &&
      checkedFunding._id !== fund._id.toHexString())
    .every((fund) => {
      const lastVersion = UtilsHelper.getLastVersion(fund.versions, 'createdAt');

      const checkedFundingIsAfter = !!lastVersion.endDate &&
        moment(checkedFunding.versions[0].startDate).isAfter(lastVersion.endDate, 'day');
      const noCareDaysInCommon = checkedFunding.versions[0].careDays.every(day => !lastVersion.careDays.includes(day));
      const checkedFundingIsBefore = !!checkedFunding.versions[0].endDate &&
        moment(checkedFunding.versions[0].endDate).isBefore(lastVersion.startDate, 'day');

      return checkedFundingIsAfter || checkedFundingIsBefore || noCareDaysInCommon;
    });
};

exports.populateFundingsList = (customer) => {
  if (!customer.fundings) return customer;

  return {
    ...customer,
    fundings: customer.fundings.map(fund => exports.populateFunding(fund, customer.subscriptions)),
  };
};

exports.populateFunding = (funding, subscriptions) => {
  if (!funding) return false;

  const sub = subscriptions.find(sb => sb._id.toHexString() === funding.subscription.toHexString());
  if (has(sub, 'service.versions')) funding.subscription = { ...sub, service: populateService(sub.service) };
  else funding.subscription = { ...sub };

  return funding;
};

exports.createFunding = async (customerId, payload) => {
  const check = await exports.checkSubscriptionFunding(customerId, payload);
  if (!check) throw Boom.conflict(translate[language].customerFundingConflict);

  const customer = await Customer.findOneAndUpdate(
    { _id: customerId },
    { $push: { fundings: payload } },
    { new: true, select: { identity: 1, fundings: 1, subscriptions: 1 }, autopopulate: false }
  )
    .populate({ path: 'subscriptions.service' })
    .populate({ path: 'fundings.thirdPartyPayer' })
    .lean();

  return exports.populateFundingsList(customer);
};

exports.updateFunding = async (customerId, fundingId, payload) => {
  const checkFundingPayload = { _id: fundingId, subscription: payload.subscription, versions: [payload] };
  const check = await exports.checkSubscriptionFunding(customerId, checkFundingPayload);
  if (!check) return Boom.conflict(translate[language].customerFundingConflict);

  const customer = await Customer.findOneAndUpdate(
    { _id: customerId, 'fundings._id': fundingId },
    { $push: { 'fundings.$.versions': payload } },
    { new: true, select: { identity: 1, fundings: 1, subscriptions: 1 }, autopopulate: false }
  )
    .populate({ path: 'subscriptions.service' })
    .populate({ path: 'fundings.thirdPartyPayer' })
    .lean();

  return exports.populateFundingsList(customer);
};

exports.deleteFunding = async (customerId, fundingId) => Customer.updateOne(
  { _id: customerId },
  { $pull: { fundings: { _id: fundingId } } }
);
