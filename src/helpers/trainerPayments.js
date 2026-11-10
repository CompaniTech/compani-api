const get = require('lodash/get');
const omit = require('lodash/omit');
const CourseSlot = require('../models/CourseSlot');
const TrainerBill = require('../models/TrainerBill');
const TrainerPayment = require('../models/TrainerPayment');
const GCloudStorageHelper = require('./gCloudStorage');
const CoursesHelper = require('./courses');

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

  const formattedPayments = trainerPayments.map((payment) => {
    const { trainer, course } = payment.trainerBill || {};
    if (!trainer) return payment;

    const formattedTrainer = { ...omit(trainer, ['bic', 'iban']), hasBankDetails: !!(trainer.bic && trainer.iban) };
    if (!course) return { ...payment, trainerBill: { ...payment.trainerBill, trainer: formattedTrainer } };

    const plannedSalary = CoursesHelper.getCourseTrainerSalary(course);
    const formattedCourse = { _id: course._id, ...(plannedSalary && { plannedSalary }) };

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
