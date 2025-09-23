const Boom = require('@hapi/boom');
const get = require('lodash/get');
const { CompaniDate } = require('../../helpers/dates/companiDates');
const UtilsHelper = require('../../helpers/utils');
const Course = require('../../models/Course');
const CourseSlot = require('../../models/CourseSlot');
const AttendanceSheet = require('../../models/AttendanceSheet');
const {
  INTRA,
  TRAINER,
  DAY,
  INTRA_HOLDING,
  VENDOR_ADMIN,
  TRAINING_ORGANISATION_MANAGER,
  SINGLE,
  INTER_B2B,
} = require('../../helpers/constants');
const DatesUtilsHelper = require('../../helpers/dates/utils');
const translate = require('../../helpers/translate');

const { language } = translate;

const isVendorAndAuthorized = (courseTrainers, credentials) => {
  const loggedUserId = get(credentials, '_id');
  const vendorRole = get(credentials, 'role.vendor');

  const isRofOrAdmin = [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(get(vendorRole, 'name'));
  if (isRofOrAdmin) return true;

  const loggedUserIsCourseTrainer = UtilsHelper.doesArrayIncludeId(courseTrainers, loggedUserId);

  return get(vendorRole, 'name') === TRAINER && loggedUserIsCourseTrainer;
};

exports.authorizeAttendanceSheetsGet = async (req) => {
  const course = await Course
    .findOne({ _id: req.query.course }, { type: 1, companies: 1, trainers: 1, holding: 1 })
    .lean();
  if (!course) throw Boom.notFound();

  const { credentials } = req.auth;

  if (isVendorAndAuthorized(course.trainers, credentials)) return null;

  if (get(req.query, 'company')) {
    const loggedUserCompany = get(credentials, 'company._id');
    const isCompanyInCourse = UtilsHelper.doesArrayIncludeId(course.companies, req.query.company);
    const isLoggedUserInCompany = UtilsHelper.areObjectIdsEquals(loggedUserCompany, req.query.company);

    if (!isCompanyInCourse || !isLoggedUserInCompany) throw Boom.forbidden();
  } else {
    const hasHoldingRole = !!get(credentials, 'role.holding');
    const isLoggedUserInHolding = UtilsHelper
      .areObjectIdsEquals(get(req.query, 'holding'), get(credentials, 'holding._id'));
    const hasHoldingAccessToCourse = course.companies
      .some(company => UtilsHelper.doesArrayIncludeId(get(credentials, 'holding.companies') || [], company)) ||
        UtilsHelper.areObjectIdsEquals(course.holding, get(credentials, 'holding._id'));
    if (!hasHoldingRole || !isLoggedUserInHolding || !hasHoldingAccessToCourse) throw Boom.forbidden();
  }

  return null;
};

exports.authorizeAttendanceSheetCreation = async (req) => {
  const course = await Course
    .findOne({ _id: req.payload.course }, { archivedAt: 1, type: 1, slots: 1, trainees: 1, trainers: 1, companies: 1 })
    .populate('slots')
    .lean();
  if (course.archivedAt) throw Boom.forbidden();
  if (!course.companies.length) throw Boom.forbidden();

  const { credentials } = req.auth;
  if (!isVendorAndAuthorized(course.trainers, credentials)) throw Boom.forbidden();

  if (!UtilsHelper.doesArrayIncludeId(course.trainers, req.payload.trainer)) throw Boom.forbidden();

  if ([INTRA, INTRA_HOLDING].includes(course.type)) {
    if (req.payload.trainees) throw Boom.badRequest();
    const isCourseSlotDate = course.slots.some(slot => CompaniDate(slot.startDate).isSame(req.payload.date, DAY));
    if (!isCourseSlotDate) throw Boom.forbidden();
    if (req.payload.signature) {
      const slots = Array.isArray(req.payload.slots) ? req.payload.slots : [req.payload.slots];
      const everySlotContainsGoodKeys = slots.every((s) => {
        const keys = Object.keys(s);
        return keys.includes('trainees') && keys.includes('slotId');
      });
      if (!everySlotContainsGoodKeys) throw Boom.badRequest();
      if (!slots.every(s => s.trainees.every(t => UtilsHelper.doesArrayIncludeId(course.trainees, t)))) {
        throw Boom.notFound();
      }
      const slotsIds = slots.map(s => s.slotId);
      const courseSlots = await CourseSlot.find({ _id: { $in: slotsIds }, course: course._id });
      if (courseSlots.length !== slotsIds.length) throw Boom.notFound();

      const attendanceSheetCount = await AttendanceSheet.countDocuments({ 'slots.slotId': { $in: slotsIds } });
      if (attendanceSheetCount) throw Boom.conflict(translate[language].courseSlotsAlreadyInAttendanceSheet);

      const areSlotsSameDateAsDate = courseSlots
        .every(slot => CompaniDate(slot.startDate).isSame(req.payload.date, DAY));
      if (!areSlotsSameDateAsDate) throw Boom.notFound();
    } else if (req.payload.slots) throw Boom.badRequest();

    return null;
  }
  const isSingleCourse = course.type === SINGLE;
  const traineesIds = Array.isArray(req.payload.trainees) ? req.payload.trainees : [req.payload.trainees];
  if (req.payload.date) throw Boom.badRequest();
  if (traineesIds.length > 1 && (!req.payload.signature || isSingleCourse)) throw Boom.badRequest();
  if (traineesIds.some(t => !UtilsHelper.doesArrayIncludeId(course.trainees, t))) throw Boom.forbidden();
  if (req.payload.signature && !req.payload.slots) throw Boom.badRequest();

  if (isSingleCourse && !(req.payload.slots && traineesIds)) throw Boom.badRequest();
  if (req.payload.slots) {
    const slots = Array.isArray(req.payload.slots) ? req.payload.slots : [req.payload.slots];
    const someSlotsContainWrongKeys = slots.some((s) => {
      const keys = Object.keys(s);
      return keys.includes('trainees') || keys.includes('slotId');
    });
    if (someSlotsContainWrongKeys) throw Boom.badRequest();
    const courseSlotCount = await CourseSlot.countDocuments({ _id: { $in: slots }, course: course._id });
    if (courseSlotCount !== slots.length) throw Boom.notFound();

    const attendanceSheetCount = await AttendanceSheet
      .countDocuments({ trainee: { $in: req.payload.trainees }, 'slots.slotId': { $in: slots } });
    if (attendanceSheetCount) throw Boom.conflict(translate[language].courseSlotsAlreadyInAttendanceSheet);
  }

  return null;
};

exports.authorizeAttendanceSheetEdit = async (req) => {
  const attendanceSheet = await AttendanceSheet
    .findOne({ _id: req.params._id })
    .populate({
      path: 'course',
      select: 'type trainers slots',
      populate: { path: 'slots', select: 'endDate' },
    })
    .lean();

  if (!attendanceSheet) throw Boom.notFound();

  const { credentials } = req.auth;
  if (!isVendorAndAuthorized(attendanceSheet.course.trainers, credentials)) throw Boom.forbidden();

  if (req.payload.action) {
    let canGenerate = attendanceSheet.slots
      .every(s => s.trainerSignature && s.traineesSignature.every(signature => signature.signature));
    if (attendanceSheet.file) canGenerate = false;
    if (attendanceSheet.course.type === INTER_B2B) {
      const lastSlot = [...attendanceSheet.course.slots.sort(DatesUtilsHelper.descendingSortBy('endDate'))][0];
      if (CompaniDate().isBefore(lastSlot.endDate)) canGenerate = false;
    }
    if (!canGenerate) throw Boom.forbidden();
  } else {
    if (attendanceSheet.course.type !== SINGLE) throw Boom.forbidden();

    const courseSlotCount = await CourseSlot
      .countDocuments({ _id: { $in: req.payload.slots }, course: attendanceSheet.course._id });
    if (courseSlotCount !== req.payload.slots.length) throw Boom.notFound();

    const slotAlreadyLinkedToAS = await AttendanceSheet
      .countDocuments({ _id: { $ne: attendanceSheet._id }, 'slots.slotId': { $in: req.payload.slots } });
    if (slotAlreadyLinkedToAS) throw Boom.conflict();
  }

  return null;
};

exports.authorizeAttendanceSheetSignature = async (req) => {
  const { credentials } = req.auth;
  const attendanceSheet = await AttendanceSheet
    .findOne({ _id: req.params._id })
    .populate({ path: 'course', select: 'type' })
    .lean();

  if (!attendanceSheet) throw Boom.notFound();
  if (attendanceSheet.slots.some(s => !s.trainerSignature)) throw Boom.notFound();

  const loggedUserId = get(credentials, '_id');
  const isTraineeInAttendanceSheet = UtilsHelper.areObjectIdsEquals(attendanceSheet.trainee, loggedUserId) ||
  attendanceSheet.slots
    .find(s => (s.traineesSignature || [])
      .find(signature => UtilsHelper.areObjectIdsEquals(signature.traineeId, loggedUserId)));
  if (!isTraineeInAttendanceSheet) throw Boom.forbidden();

  const hasTraineeSignedEverySlot = attendanceSheet.slots
    .every((s) => {
      const traineeSignatureMissing = [SINGLE, INTER_B2B].includes(attendanceSheet.course.type)
        ? !(s.traineesSignature || [])
          .find(signature => UtilsHelper.areObjectIdsEquals(signature.traineeId, loggedUserId) && !!signature.signature)
        : (s.traineesSignature || [])
          .find(signature => UtilsHelper.areObjectIdsEquals(signature.traineeId, loggedUserId) && !signature.signature);

      return !traineeSignatureMissing;
    });
  if (hasTraineeSignedEverySlot) throw Boom.notFound();
  return null;
};

exports.authorizeAttendanceSheetDeletion = async (req) => {
  const { credentials } = req.auth;

  const attendanceSheet = await AttendanceSheet
    .findOne({ _id: req.params._id })
    .populate({ path: 'course', select: 'archivedAt trainers' })
    .setOptions({ isVendorUser: !!get(credentials, 'role.vendor') })
    .lean();
  if (!attendanceSheet) throw Boom.notFound();

  if (get(attendanceSheet, 'course.archivedAt')) throw Boom.forbidden();

  if (!isVendorAndAuthorized(get(attendanceSheet, 'course.trainers'), credentials)) throw Boom.forbidden();

  if (req.query.shouldDeleteAttendances && !attendanceSheet.slots) throw Boom.badRequest();

  return null;
};
