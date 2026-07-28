const Boom = require('@hapi/boom');
const CourseSlot = require('../../models/CourseSlot');
const TrainerInvoice = require('../../models/TrainerInvoice');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');
const { INVOICED, PAID } = require('../../helpers/constants');

const { language } = translate;

exports.authorizeTrainerInvoiceCreation = async (req) => {
  try {
    const { credentials } = req.auth;
    const courseSlotIds = Array.isArray(req.payload.courseSlots) ? req.payload.courseSlots : [req.payload.courseSlots];

    const courseSlots = await CourseSlot
      .find({ _id: { $in: courseSlotIds }, trainers: credentials._id })
      .lean();
    if (courseSlots.length !== courseSlotIds.length) throw Boom.notFound();

    const someSlotsAreAlreadyInvoiced = courseSlots.some(slot => (slot.trainerBills || []).some(
      bill => UtilsHelper.areObjectIdsEquals(bill.trainer, credentials._id)
    ));
    if (someSlotsAreAlreadyInvoiced) throw Boom.forbidden();

    const invoiceNumberAlreadyUsed = await TrainerInvoice
      .countDocuments({ trainer: credentials._id, number: req.payload.number });
    if (invoiceNumberAlreadyUsed) throw Boom.conflict(translate[language].trainerInvoiceNumberAlreadyUsed);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeTrainerInvoiceUpdate = async (req) => {
  try {
    const trainerInvoice = await TrainerInvoice.findOne({ _id: req.params._id }).lean();
    if (!trainerInvoice) throw Boom.notFound();

    const expectedPayloadStatus = trainerInvoice.status === PAID ? INVOICED : PAID;
    if (req.payload.status !== expectedPayloadStatus) {
      throw Boom.conflict(translate[language].trainerInvoiceStatusConflict);
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeTrainerInvoiceDeletion = async (req) => {
  try {
    const trainerInvoice = await TrainerInvoice.findOne({ _id: req.params._id }).lean();
    if (!trainerInvoice) throw Boom.notFound();

    if (trainerInvoice.status !== INVOICED) throw Boom.conflict(translate[language].trainerInvoiceStatusConflict);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
