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
} = require('../../helpers/constants');
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
    if (req.payload.trainee) throw Boom.badRequest();
    const isCourseSlotDate = course.slots.some(slot => CompaniDate(slot.startDate).isSame(req.payload.date, DAY));
    if (!isCourseSlotDate) throw Boom.forbidden();

    return null;
  }
  if (req.payload.date) throw Boom.badRequest();
  if (!course.trainees.some(t => UtilsHelper.areObjectIdsEquals(t, req.payload.trainee))) throw Boom.forbidden();

  const isSingleCourse = course.type === SINGLE;
  if (isSingleCourse && !(req.payload.slots && req.payload.trainee)) throw Boom.badRequest();
  if (req.payload.slots) {
    if (!isSingleCourse) throw Boom.badRequest();

    const slotsIds = Array.isArray(req.payload.slots) ? req.payload.slots : [req.payload.slots];
    const courseSlotCount = await CourseSlot.countDocuments({ _id: { $in: slotsIds }, course: course._id });
    if (courseSlotCount !== slotsIds.length) throw Boom.notFound();

    const attendanceSheetCount = await AttendanceSheet.countDocuments({ 'slots.slotId': { $in: slotsIds } });
    if (attendanceSheetCount) throw Boom.conflict(translate[language].courseSlotsAlreadyInAttendanceSheet);
  }

  return null;
};

exports.authorizeAttendanceSheetEdit = async (req) => {
  const attendanceSheet = await AttendanceSheet
    .findOne({ _id: req.params._id })
    .populate({ path: 'course', select: 'type trainers' })
    .lean();

  if (!attendanceSheet) throw Boom.notFound();

  const { credentials } = req.auth;
  if (!isVendorAndAuthorized(attendanceSheet.course.trainers, credentials)) throw Boom.forbidden();

  const isSingleCourse = attendanceSheet.course.type === SINGLE;
  if (!isSingleCourse) throw Boom.forbidden();

  if (req.payload.action) {
    const hasBothSignatures = attendanceSheet.slots.every(s => s.trainerSignature && s.traineesSignature);
    if (!hasBothSignatures) throw Boom.forbidden();
  } else {
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
  const attendanceSheet = await AttendanceSheet.findOne({ _id: req.params._id }).lean();

  if (!attendanceSheet) throw Boom.notFound();
  if (attendanceSheet.slots.some(s => !s.trainerSignature || s.traineesSignature)) throw Boom.notFound();

  const { credentials } = req.auth;
  const loggedUserId = get(credentials, '_id');
  if (!UtilsHelper.areObjectIdsEquals(attendanceSheet.trainee, loggedUserId)) throw Boom.forbidden();

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

  return null;
};
