const get = require('lodash/get');
const groupBy = require('lodash/groupBy');
const omit = require('lodash/omit');
const CourseSlot = require('../models/CourseSlot');
const TrainerBill = require('../models/TrainerBill');
const TrainerPayment = require('../models/TrainerPayment');
const CoursesHelper = require('./courses');
const GCloudStorageHelper = require('./gCloudStorage');
const NumbersHelper = require('./numbers');
const { TRAINER_SALARY } = require('./constants');

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
          select: 'trainers billingPurchaseList rolesPerTrainer subProgram createdAt',
          populate: [
            { path: 'subProgram', select: 'name trainerPriceVersions' },
            { path: 'billingPurchaseList.billingItem', select: 'type' },
          ],
        },
      ],
    })
    .populate({ path: 'trainerPaymentsXmlFileInfos', select: 'name', options: { isVendorUser: true } })
    .sort({ date: -1 })
    .lean();

  const courseIds = trainerPayments
    .filter(payment => payment.trainerBill?.course)
    .map(payment => payment.trainerBill.course._id);
  const courseSlots = await CourseSlot
    .find({ course: { $in: courseIds } }, { course: 1, step: 1, startDate: 1, endDate: 1, trainers: 1 })
    .lean();
  const courseSlotsByCourse = groupBy(courseSlots, slot => slot.course);

  const formattedPayments = trainerPayments.map((payment) => {
    const { trainer, course } = payment.trainerBill || {};
    if (!trainer) return payment;

    const formattedTrainer = { ...omit(trainer, ['bic', 'iban']), hasBankDetails: !!(trainer.bic && trainer.iban) };
    let plannedSalary;
    if (course) {
      const salaryItem = course.trainers.length === 1 &&
        (course.billingPurchaseList || []).find(item => item.billingItem?.type === TRAINER_SALARY);
      plannedSalary = salaryItem
        ? NumbersHelper.toNumber(NumbersHelper.multiply(salaryItem.price, salaryItem.count))
        : CoursesHelper.getCourseTrainerSalaryFromSlots(course, trainer._id, courseSlotsByCourse[course._id] || []);
    }

    return {
      ...payment,
      trainerBill: {
        ...payment.trainerBill,
        trainer: formattedTrainer,
        ...(course && { course: { _id: course._id, plannedSalary } }),
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
