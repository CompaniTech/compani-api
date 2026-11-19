const get = require('lodash/get');
const groupBy = require('lodash/groupBy');
const mapValues = require('lodash/mapValues');
const omit = require('lodash/omit');
const CourseSlot = require('../models/CourseSlot');
const TrainerBill = require('../models/TrainerBill');
const TrainerPayment = require('../models/TrainerPayment');
const GCloudStorageHelper = require('./gCloudStorage');
const CoursesHelper = require('./courses');
const NumbersHelper = require('./numbers');

const getTotalPaymentsAmountByCourseAndTrainer = async (courseIds) => {
  if (!courseIds.length) return {};

  const trainerBills = await TrainerBill
    .find({ course: { $in: courseIds } }, { course: 1, trainer: 1 })
    .populate({ path: 'payment', select: 'amount' })
    .lean();

  const billsWithPayment = trainerBills.filter(bill => bill.payment);
  const billsWithPaymentByCourseAndTrainer = groupBy(billsWithPayment, bill => `${bill.course}-${bill.trainer}`);

  return mapValues(billsWithPaymentByCourseAndTrainer, (bills) => {
    const paymentAmounts = bills.map(bill => bill.payment.amount);

    return NumbersHelper.toNumber(NumbersHelper.add(...paymentAmounts));
  });
};

exports.list = async (query) => {
  const status = Array.isArray(query.status) ? query.status : [query.status];

  const trainerPayments = await TrainerPayment
    .find({ status: { $in: status } })
    .populate({
      path: 'trainerBill',
      select: 'number file course',
      populate: [
        { path: 'trainer', select: 'identity bic iban' },
        {
          path: 'course',
          select: 'trainers billingPurchaseList subProgram',
          populate: [
            { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } },
            { path: 'billingPurchaseList.billingItem', select: 'type' },
          ],
        },
      ],
    })
    .populate({ path: 'trainerPaymentsXmlFileInfos', select: 'name', options: { isVendorUser: true } })
    .sort({ date: -1 })
    .lean();

  const courseIds = trainerPayments
    .map(p => get(p, 'trainerBill.course'))
    .filter(course => course && CoursesHelper.getCourseTrainerSalary(course))
    .map(course => course._id);
  const totalPaymentsAmounts = await getTotalPaymentsAmountByCourseAndTrainer(courseIds);

  const formattedPayments = trainerPayments.map((payment) => {
    const { trainer, course } = payment.trainerBill || {};
    if (!trainer) return payment;

    const formattedTrainer = { ...omit(trainer, ['bic', 'iban']), hasBankDetails: !!(trainer.bic && trainer.iban) };
    if (!course) return { ...payment, trainerBill: { ...payment.trainerBill, trainer: formattedTrainer } };

    const plannedSalary = CoursesHelper.getCourseTrainerSalary(course);
    const formattedCourse = {
      _id: course._id,
      ...(plannedSalary && {
        plannedSalary,
        totalPaymentsAmount: totalPaymentsAmounts[`${course._id}-${trainer._id}`] || 0,
      }),
    };

    return {
      ...payment,
      trainerBill: {
        ...payment.trainerBill,
        trainer: formattedTrainer,
        course: formattedCourse,
      },
    };
  });

  return formattedPayments;
};

exports.update = async (trainerPaymentId, payload) => TrainerPayment
  .updateOne({ _id: trainerPaymentId }, { $set: { status: payload.status } });

exports.remove = async (trainerPaymentId) => {
  const { trainerBill: trainerBillId } = await TrainerPayment.findOne({ _id: trainerPaymentId }, { trainerBill: 1 })
    .lean();
  const trainerBill = await TrainerBill.findOne({ _id: trainerBillId }, { file: 1 }).lean();

  await CourseSlot.updateMany(
    { 'trainerBillings.trainerBill': trainerBillId },
    { $pull: { trainerBillings: { trainerBill: trainerBillId } } }
  );

  await TrainerPayment.deleteOne({ _id: trainerPaymentId });
  await TrainerBill.deleteOne({ _id: trainerBillId });

  if (get(trainerBill, 'file.publicId')) await GCloudStorageHelper.deleteCourseFile(trainerBill.file.publicId);
};
