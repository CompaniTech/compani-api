const uniqBy = require('lodash/uniqBy');
const Boom = require('@hapi/boom');
const CourseSlot = require('../models/CourseSlot');
const TrainerBill = require('../models/TrainerBill');
const TrainerPayment = require('../models/TrainerPayment');
const CoursePaymentNumber = require('../models/CoursePaymentNumber');
const CourseSlotsHelper = require('./courseSlots');
const GCloudStorageHelper = require('./gCloudStorage');
const NumbersHelper = require('./numbers');
const UtilsHelper = require('./utils');
const translate = require('./translate');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');
const { MINUTE, PAYMENT, PENDING } = require('./constants');

const { language } = translate;

const computeAmount = (courseSlots, trainerId) => {
  // A collective session is stored as one course slot document per attending trainee, all sharing
  // the same startDate/endDate : it must be counted once, not once per trainee, when summing the amount.
  const uniqueDateSlots = uniqBy(courseSlots, slot => `${slot.startDate.toISOString()}_${slot.endDate.toISOString()}`);

  return uniqueDateSlots.reduce((acc, slot) => {
    const hourlyAmount = CourseSlotsHelper.getHourlyAmount(slot, trainerId);
    if (hourlyAmount === null) throw Boom.badData(translate[language].trainerBillHourlyAmountNotFound);

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
    .populate({
      path: 'course',
      select: 'subProgram rolesPerTrainer',
      populate: { path: 'subProgram', select: 'priceVersions' },
    })
    .sort({ startDate: 1 })
    .lean();

  const amount = computeAmount(courseSlots, credentials._id);

  const trainerName = UtilsHelper.formatIdentity(credentials.identity, 'FL');
  const fileUploaded = await GCloudStorageHelper.uploadCourseFile({
    fileName: `facture ${trainerName} ${payload.number}`,
    file: payload.file,
    contentType: 'application/pdf',
  });

  const trainerBill = await TrainerBill.create({
    trainer: credentials._id,
    number: payload.number,
    courseSlots: courseSlotIds,
    amount,
    submittedAt: CompaniDate().toISO(),
    file: fileUploaded,
  });

  await CourseSlot.updateMany(
    { _id: { $in: courseSlotIds } },
    { $push: { trainerBillings: { trainer: credentials._id, trainerBill: trainerBill._id } } }
  );

  const lastPaymentNumber = await CoursePaymentNumber
    .findOneAndUpdate(
      { nature: PAYMENT },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    .lean();

  await TrainerPayment.create({
    number: `REG-${lastPaymentNumber.seq.toString().padStart(5, '0')}`,
    trainerBill: trainerBill._id,
    amount,
    status: PENDING,
  });

  return trainerBill;
};
