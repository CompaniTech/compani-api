const get = require('lodash/get');
const flat = require('flat');
const omit = require('lodash/omit');
const NumbersHelper = require('./numbers');
const CourseBill = require('../models/CourseBill');
const CourseBillsNumber = require('../models/CourseBillsNumber');
const BalanceHelper = require('./balances');
const UtilsHelper = require('./utils');
const VendorCompaniesHelper = require('./vendorCompanies');
const CourseBillPdf = require('../data/pdf/courseBilling/courseBill');
const { LIST, TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN, DD_MM_YYYY } = require('./constants');
const { CompaniDate } = require('./dates/companiDates');

exports.getNetInclTaxes = (bill) => {
  const mainFeeTotal = NumbersHelper.oldMultiply(bill.mainFee.price, bill.mainFee.count);
  const billingPurchaseTotal = bill.billingPurchaseList
    ? bill.billingPurchaseList.map(p => NumbersHelper.oldMultiply(p.price, p.count)).reduce((acc, val) => acc + val, 0)
    : 0;

  return NumbersHelper.oldAdd(mainFeeTotal, billingPurchaseTotal);
};

const getTimeProgress = (course) => {
  const pastSlotsCount = course.slots.filter(slot => CompaniDate().isAfter(slot.startDate)).length;

  return pastSlotsCount / (course.slots.length + course.slotsToPlan.length);
};

exports.computeAmounts = (courseBill) => {
  if (!courseBill) return { netInclTaxes: 0, paid: 0, total: 0 };

  const netInclTaxes = exports.getNetInclTaxes(courseBill);
  const totalPayments = BalanceHelper.computePayments(courseBill.coursePayments);
  const creditNote = courseBill.courseCreditNote ? netInclTaxes : 0;
  const paid = totalPayments + creditNote;

  return { netInclTaxes, paid, total: paid - netInclTaxes };
};

exports.formatCourseBill = (courseBill) => {
  const { netInclTaxes, paid, total } = this.computeAmounts(courseBill);

  return {
    progress: getTimeProgress(courseBill.course),
    netInclTaxes,
    ...omit(courseBill, ['course.slots', 'course.slotsToPlan']),
    paid,
    total,
  };
};

const balance = async (company, credentials) => {
  const courseBills = await CourseBill
    .find({ $or: [{ companies: company }, { 'payer.company': company }], billedAt: { $exists: true, $type: 'date' } })
    .populate({
      path: 'course',
      select: 'misc slots slotsToPlan subProgram companies',
      populate: [
        { path: 'slots' },
        { path: 'slotsToPlan' },
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
      ],
    })
    .populate({ path: 'companies', select: 'name' })
    .populate({ path: 'payer.company', select: 'name' })
    .populate({ path: 'payer.fundingOrganisation', select: 'name' })
    .populate({
      path: 'courseCreditNote',
      options: {
        isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
        requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company),
      },
    })
    .populate({
      path: 'coursePayments',
      options: {
        isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
        requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company),
      },
    })
    .setOptions({
      isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
      requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company),
    })
    .lean();

  return courseBills.map(bill => exports.formatCourseBill(bill));
};

exports.list = async (query, credentials) => {
  if (query.action === LIST) {
    const courseBills = await CourseBill
      .find({ course: query.course })
      .populate({ path: 'companies', select: 'name' })
      .populate({ path: 'payer.fundingOrganisation', select: 'name' })
      .populate({ path: 'payer.company', select: 'name' })
      .populate({ path: 'courseCreditNote', options: { isVendorUser: !!get(credentials, 'role.vendor') } })
      .setOptions({ isVendorUser: !!get(credentials, 'role.vendor') })
      .lean();

    return courseBills.map(bill => ({ ...bill, netInclTaxes: exports.getNetInclTaxes(bill) }));
  }

  return balance(query.company, credentials);
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
    const payloadToUnset = {};
    if (get(payload, 'mainFee.description') === '') {
      payloadToSet = omit(payloadToSet, 'mainFee.description');
      payloadToUnset['mainFee.description'] = '';
    }

    if (get(payload, 'payer.company')) payloadToUnset['payer.fundingOrganisation'] = '';
    else if (get(payload, 'payer.fundingOrganisation')) payloadToUnset['payer.company'] = '';

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

exports.deleteBillingPurchase = async (courseBillId, billingPurchaseId) => CourseBill.updateOne(
  { _id: courseBillId },
  { $pull: { billingPurchaseList: { _id: billingPurchaseId } } }
);

const formatDataForPdf = (bill, vendorCompany) => {
  const { billedAt, payer } = bill;

  return {
    ...omit(bill, ['_id', 'billedAt']),
    date: CompaniDate(billedAt).format(DD_MM_YYYY),
    vendorCompany,
    payer: { name: payer.name, address: get(payer, 'address.fullAddress') || payer.address },
  };
};

exports.generateBillPdf = async (billId, companies, credentials) => {
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));
  const requestingOwnInfos = companies.some(company => UtilsHelper.hasUserAccessToCompany(credentials, company));

  const vendorCompany = await VendorCompaniesHelper.get();

  const bill = await CourseBill
    .findOne({ _id: billId }, { number: 1, companies: 1, course: 1, mainFee: 1, billingPurchaseList: 1, billedAt: 1 })
    .populate({
      path: 'course',
      select: 'subProgram',
      populate: { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
    })
    .populate({ path: 'billingPurchaseList', select: 'billingItem', populate: { path: 'billingItem', select: 'name' } })
    .populate({ path: 'companies', select: 'name address' })
    .populate({ path: 'payer.fundingOrganisation', select: 'name address' })
    .populate({ path: 'payer.company', select: 'name address' })
    .populate({
      path: 'coursePayments',
      select: 'nature netInclTaxes date',
      options: { sort: { date: -1 }, isVendorUser, requestingOwnInfos },
    })
    .populate({ path: 'courseCreditNote', options: { isVendorUser, requestingOwnInfos } })
    .lean();

  const data = formatDataForPdf(bill, vendorCompany);

  const pdf = await CourseBillPdf.getPdf(data);

  return { pdf, billNumber: bill.number };
};

exports.deleteBill = async courseBillId => CourseBill.deleteOne({ _id: courseBillId });
