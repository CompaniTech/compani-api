const Boom = require('@hapi/boom');
const CourseSlot = require('../../models/CourseSlot');
const TrainerBill = require('../../models/TrainerBill');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.authorizeTrainerBillCreation = async (req) => {
  try {
    const { credentials } = req.auth;
    const courseSlotIds = Array.isArray(req.payload.courseSlots) ? req.payload.courseSlots : [req.payload.courseSlots];

    const courseSlots = await CourseSlot
      .find({ _id: { $in: courseSlotIds }, trainers: credentials._id })
      .lean();
    if (courseSlots.length !== courseSlotIds.length) throw Boom.notFound();

    const someSlotsAreAlreadyBilled = courseSlots.some(slot => (slot.trainerBillings || []).some(
      billing => UtilsHelper.areObjectIdsEquals(billing.trainer, credentials._id)
    ));
    if (someSlotsAreAlreadyBilled) throw Boom.forbidden();

    const billNumberAlreadyUsed = await TrainerBill
      .countDocuments({ trainer: credentials._id, number: req.payload.number });
    if (billNumberAlreadyUsed) throw Boom.conflict(translate[language].trainerBillNumberAlreadyUsed);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
