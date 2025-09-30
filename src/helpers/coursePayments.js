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

exports.list = async query => CoursePayment
  .find({ status: query.status, nature: PAYMENT })
  .populate({
    path: 'courseBill',
    select: 'number payer',
    populate: [{ path: 'payer.company', select: 'name' }, { path: 'payer.fundingOrganisation', select: 'name' }],
  })
  .setOptions({ isVendorUser: true })
  .lean();
