const Boom = require('@hapi/boom');
const CourseSlot = require('../../models/CourseSlot');
const TrainerBill = require('../../models/TrainerBill');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');
const { INVOICED, PAID } = require('../../helpers/constants');

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

exports.authorizeTrainerBillUpdate = async (req) => {
  try {
    const trainerBill = await TrainerBill.findOne({ _id: req.params._id }).lean();
    if (!trainerBill) throw Boom.notFound();

    const expectedPayloadStatus = trainerBill.status === PAID ? INVOICED : PAID;
    if (req.payload.status !== expectedPayloadStatus) {
      throw Boom.conflict(translate[language].trainerBillStatusConflict);
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeTrainerBillDeletion = async (req) => {
  try {
    const trainerBill = await TrainerBill.findOne({ _id: req.params._id }).lean();
    if (!trainerBill) throw Boom.notFound();

    if (trainerBill.status !== INVOICED) throw Boom.conflict(translate[language].trainerBillStatusConflict);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
