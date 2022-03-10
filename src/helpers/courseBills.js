const get = require('lodash/get');
const flat = require('flat');
const has = require('lodash/has');
const omit = require('lodash/omit');
const pick = require('lodash/pick');
const NumbersHelper = require('./numbers');
const CourseBill = require('../models/CourseBill');
const CourseBillsNumber = require('../models/CourseBillsNumber');
const PdfHelper = require('./pdf');
const CourseBillPdf = require('../data/pdf/courseBilling/courseBill');

exports.list = async (course, credentials) => {
  const courseBills = await CourseBill
    .find({ course })
    .populate({ path: 'company', select: 'name' })
    .populate({ path: 'courseFundingOrganisation', select: 'name' })
    .setOptions({ isVendorUser: has(credentials, 'role.vendor') })
    .lean();

  return courseBills.map((bill) => {
    const mainFeeTotal = NumbersHelper.multiply(bill.mainFee.price, bill.mainFee.count);
    const billingPurchaseTotal = bill.billingPurchaseList
      ? bill.billingPurchaseList.map(p => NumbersHelper.multiply(p.price, p.count)).reduce((acc, val) => acc + val, 0)
      : 0;

    return { ...bill, netInclTaxes: mainFeeTotal + billingPurchaseTotal };
  });
};

exports.create = async payload => CourseBill.create(payload);

exports.updateCourseBill = async (courseBillId, payload) => {
  let formattedPayload = {};

  if (payload.billedAt) {
    const lastBillNumber = await CourseBillsNumber
      .findOneAndUpdate({}, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true })
      .lean();

    formattedPayload = {
      $set: { billedAt: payload.billedAt, number: `FACT-${lastBillNumber.seq.toString().padStart(5, '0')}` },
    };
  } else {
    let payloadToSet = payload;
    let payloadToUnset = {};

    for (const key of ['courseFundingOrganisation', 'mainFee.description']) {
      if (get(payload, key) === '') {
        payloadToSet = omit(payloadToSet, key);
        payloadToUnset = { ...payloadToUnset, [key]: '' };
      }
    }

    formattedPayload = {
      ...(Object.keys(payloadToSet).length && { $set: flat(payloadToSet, { safe: true }) }),
      ...(Object.keys(payloadToUnset).length && { $unset: payloadToUnset }),
    };
  }

  await CourseBill.updateOne({ _id: courseBillId }, formattedPayload);
};

exports.addBillingPurchase = async (courseBillId, payload) =>
  CourseBill.updateOne({ _id: courseBillId }, { $push: { billingPurchaseList: payload } });

exports.updateBillingPurchase = async (courseBillId, billingPurchaseId, payload) => CourseBill.updateOne(
  { _id: courseBillId, 'billingPurchaseList._id': billingPurchaseId },
  {
    $set: {
      'billingPurchaseList.$.price': payload.price,
      'billingPurchaseList.$.count': payload.count,
      ...(!!payload.description && { 'billingPurchaseList.$.description': payload.description }),
    },
    ...(get(payload, 'description') === '' && { $unset: { 'billingPurchaseList.$.description': '' } }),
  }
);

const formatPdf = bill => ({
  ...pick(bill, ['course']),
  feeList: [
    bill.mainFee,
    bill.billingPurchaseList,
  ].flat(),
});

exports.generateBillPdf = async (billId) => {
  const bill = await CourseBill.findOne({ _id: billId })
    .populate({
      path: 'course',
      select: 'subProgram',
      populate: { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
    })
    .populate({ path: 'billingPurchaseList', select: 'billingItem', populate: { path: 'billingItem', select: 'name' } })
    .lean();

  const data = formatPdf(bill);
  const template = await CourseBillPdf.getPdfContent(data);
  const pdf = await PdfHelper.generatePdf(template);

  return { pdf, billNumber: bill.number };
};
