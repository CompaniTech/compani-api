const uniqBy = require('lodash/uniqBy');
const CourseSlot = require('../models/CourseSlot');
const TrainerInvoice = require('../models/TrainerInvoice');
const CourseSlotsHelper = require('./courseSlots');
const NumbersHelper = require('./numbers');
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

exports.createInvoice = async (payload, credentials) => {
  const courseSlotIds = Array.isArray(payload.courseSlots) ? payload.courseSlots : [payload.courseSlots];

  const courseSlots = await CourseSlot
    .find({ _id: { $in: courseSlotIds } })
    .populate({ path: 'step', select: '_id' })
    .populate({ path: 'course', select: 'subProgram', populate: { path: 'subProgram', select: 'priceVersions' } })
    .lean();

  const amount = computeAmount(courseSlots);

  const trainerInvoice = await TrainerInvoice.create({
    trainer: credentials._id,
    number: payload.number,
    status: INVOICED,
    courseSlots: courseSlotIds,
    amount,
    submittedAt: CompaniDate().toISO(),
  });

  await CourseSlot.updateMany(
    { _id: { $in: courseSlotIds } },
    { $push: { trainerBills: { trainer: credentials._id, trainerInvoice: trainerInvoice._id } } }
  );

  return trainerInvoice;
};
