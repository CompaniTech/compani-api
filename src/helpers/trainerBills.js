const uniqBy = require('lodash/uniqBy');
const CourseSlot = require('../models/CourseSlot');
const TrainerBill = require('../models/TrainerBill');
const CourseSlotsHelper = require('./courseSlots');
const EmailHelper = require('./email');
const NumbersHelper = require('./numbers');
const UtilsHelper = require('./utils');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');
const { MINUTE, INVOICED } = require('./constants');

const computeAmount = (courseSlots) => {
  // A collective session is stored as one course slot document per attending trainee, all sharing
  // the same startDate/endDate : it must be counted once, not once per trainee, when summing the amount.
  const uniqueDateSlots = uniqBy(courseSlots, slot => `${slot.startDate.toISOString()}_${slot.endDate.toISOString()}`);

  return uniqueDateSlots.reduce((acc, slot) => {
    const hourlyAmount = CourseSlotsHelper.getHourlyAmount(slot);
    const duration = CompaniDate(slot.endDate).diff(slot.startDate, MINUTE);
    const slotAmount = NumbersHelper.toFixedToFloat(
      NumbersHelper.multiply(hourlyAmount, CompaniDuration(duration).asHours())
    );

    return NumbersHelper.add(acc, slotAmount);
  }, 0);
};

exports.createBill = async (payload, credentials) => {
  const courseSlotIds = Array.isArray(payload.courseSlots) ? payload.courseSlots : [payload.courseSlots];

  const courseSlots = await CourseSlot
    .find({ _id: { $in: courseSlotIds } })
    .populate({ path: 'step', select: '_id' })
    .populate({ path: 'course', select: 'subProgram', populate: { path: 'subProgram', select: 'priceVersions' } })
    .sort({ startDate: 1 })
    .lean();

  const amount = computeAmount(courseSlots);

  const trainerBill = await TrainerBill.create({
    trainer: credentials._id,
    number: payload.number,
    status: INVOICED,
    courseSlots: courseSlotIds,
    amount,
    submittedAt: CompaniDate().toISO(),
  });

  await CourseSlot.updateMany(
    { _id: { $in: courseSlotIds } },
    { $push: { trainerBills: { trainer: credentials._id, trainerBillId: trainerBill._id } } }
  );

  await EmailHelper.sendTrainerBillEmail(
    payload.number,
    amount,
    UtilsHelper.formatIdentity(credentials.identity, 'FL'),
    courseSlots,
    payload.file
  );

  return trainerBill;
};

exports.update = async (trainerBillId, payload) => TrainerBill
  .updateOne({ _id: trainerBillId }, { $set: payload });

exports.remove = async (trainerBillId) => {
  await CourseSlot.updateMany(
    { 'trainerBills.trainerBillId': trainerBillId },
    { $pull: { trainerBills: { trainerBillId } } }
  );

  await TrainerBill.deleteOne({ _id: trainerBillId });
};
