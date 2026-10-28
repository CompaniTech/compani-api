const get = require('lodash/get');
const omit = require('lodash/omit');
const CourseBill = require('../models/CourseBill');
const CoursePayment = require('../models/CoursePayment');
const CoursePaymentNumber = require('../models/CoursePaymentNumber');
const { PAYMENT, PENDING, CHECK, DIRECT_DEBIT, RECEIVED } = require('./constants');

exports.createCoursePayment = async (payload) => {
  const lastPaymentNumber = await CoursePaymentNumber
    .findOneAndUpdate(
      { nature: payload.nature },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    .lean();

  const courseBill = await CourseBill.findOne({ _id: payload.courseBill }, { companies: 1 }).lean();

  const formattedPayload = {
    ...payload,
    companies: courseBill.companies,
    number: `${payload.nature === PAYMENT ? 'REG' : 'REMB'}-${lastPaymentNumber.seq.toString().padStart(5, '0')}`,
    status: [CHECK, DIRECT_DEBIT].includes(payload.type) ? PENDING : RECEIVED,
  };

  await CoursePayment.create(formattedPayload);
};

exports.updateCoursePayment = async (coursePaymentId, payload) => {
  await CoursePayment.updateOne({ _id: coursePaymentId }, { $set: payload });
};

exports.list = async (query) => {
  const coursePayments = await CoursePayment
    .find({ status: { $in: Array.isArray(query.status) ? query.status : [query.status] }, nature: PAYMENT })
    .populate({
      path: 'courseBill',
      select: 'number payer course',
      populate: [
        {
          path: 'payer.company',
          select: 'name bic iban debitMandates',
          populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
        },
        { path: 'payer.fundingOrganisation', select: 'name' },
        { path: 'course', select: 'type' },
      ],
    })
    .populate({ path: 'xmlSEPAFileInfos', select: 'name', options: { isVendorUser: true } })
    .setOptions({ isVendorUser: true })
    .sort({ updatedAt: -1 })
    .lean();

  return coursePayments.map((payment) => {
    const payer = get(payment, 'courseBill.payer');
    if (!payer) return payment;

    const formattedPayer = { ...omit(payer, ['bic', 'iban']), hasBankDetails: !!(payer.bic && payer.iban) };

    return { ...payment, courseBill: { ...payment.courseBill, payer: formattedPayer } };
  });
};

exports.updateList = async payload => CoursePayment
  .updateMany({ _id: { $in: payload._ids } }, { $set: { status: payload.status } });
