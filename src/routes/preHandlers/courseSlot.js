const Boom = require('@hapi/boom');
const get = require('lodash/get');
const has = require('lodash/has');
const compact = require('lodash/compact');
const CourseSlot = require('../../models/CourseSlot');
const Course = require('../../models/Course');
const CompletionCertificate = require('../../models/CompletionCertificate');
const Step = require('../../models/Step');
const Attendance = require('../../models/Attendance');
const AttendanceSheet = require('../../models/AttendanceSheet');
const translate = require('../../helpers/translate');
const { checkAuthorization } = require('./courses');
const {
  E_LEARNING,
  ON_SITE,
  REMOTE,
  INTRA,
  INTRA_HOLDING,
  MM_YYYY,
  TRAINER,
  SINGLE,
} = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const { CompaniDate } = require('../../helpers/dates/companiDates');

const { language } = translate;

exports.authorizeCreate = async (req) => {
  try {
    const { course: courseId, step: stepId } = req.payload;

    const course = await Course.findById(courseId, { subProgram: 1, archivedAt: 1, trainers: 1 })
      .populate({ path: 'subProgram', select: 'steps' })
      .lean();
    if (!course) throw Boom.notFound();
    if (course.archivedAt) throw Boom.forbidden();

    const { credentials } = req.auth;
    const isTrainer = get(credentials, 'role.vendor.name') === TRAINER;
    if (isTrainer && !UtilsHelper.doesArrayIncludeId(course.trainers, credentials._id)) throw Boom.forbidden();

    const isStepElearning = await Step.countDocuments({ _id: stepId, type: E_LEARNING }).lean();

    if (isStepElearning || !UtilsHelper.doesArrayIncludeId(course.subProgram.steps, stepId)) throw Boom.badRequest();

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const checkPayload = async (courseSlot, payload) => {
  const { course: courseId, step } = courseSlot;
  const { startDate, endDate } = payload;
  const hasBothDates = !!(startDate && endDate);
  const hasOneDate = !!(startDate || endDate);

  const attendanceSheets = await AttendanceSheet.countDocuments({ 'slots.slotId': courseSlot._id });
  if (attendanceSheets) throw Boom.forbidden(translate[language].courseSlotWithAttendances);

  const slotMonth = courseSlot.startDate ? CompaniDate(courseSlot.startDate).format(MM_YYYY) : '';
  const payloadMonth = startDate ? CompaniDate(startDate).format(MM_YYYY) : '';
  const slotsMonths = compact([slotMonth, payloadMonth]);
  const completionCertificates = await CompletionCertificate.countDocuments({
    course: courseId,
    month: { $in: slotsMonths },
    file: { $exists: true },
  });
  if (completionCertificates) throw Boom.forbidden(translate[language].courseSlotDateInCompletionCertificate);

  if (!hasOneDate) {
    const attendances = await Attendance.countDocuments({ courseSlot: courseSlot._id });
    if (attendances) throw Boom.forbidden(translate[language].courseSlotWithAttendances);
  }

  if (hasOneDate) {
    if (!hasBothDates) throw Boom.badRequest();
    const sameDay = CompaniDate(startDate).isSame(endDate, 'day');
    const startDateBeforeEndDate = CompaniDate(startDate).isSameOrBefore(endDate);
    if (!(sameDay && startDateBeforeEndDate)) throw Boom.badRequest();
  }

  const course = await Course.findById(courseId, { subProgram: 1 })
    .populate({ path: 'subProgram', select: 'steps' })
    .lean();

  if (step.type === E_LEARNING) throw Boom.badRequest();
  if (!UtilsHelper.doesArrayIncludeId(course.subProgram.steps, step._id)) throw Boom.badRequest();
  if ((payload.address && step.type !== ON_SITE) || (payload.meetingLink && step.type !== REMOTE)) {
    throw Boom.badRequest();
  }
};

exports.authorizeUpdate = async (req) => {
  try {
    const courseSlot = await CourseSlot
      .findOne({ _id: req.params._id }, { course: 1, step: 1, startDate: 1 })
      .populate({ path: 'step', select: 'type' })
      .lean();
    if (!courseSlot) throw Boom.notFound(translate[language].courseSlotNotFound);

    const courseId = get(courseSlot, 'course') || '';
    const course = await Course
      .findOne({ _id: courseId }, { archivedAt: 1, trainees: 1, trainers: 1, type: 1, companies: 1, holding: 1 })
      .lean();
    if (course.archivedAt) throw Boom.forbidden();
    if (has(req.payload, 'trainees')) {
      const userVendorRole = get(req.auth, 'credentials.role.vendor.name');
      if (!userVendorRole || course.type === SINGLE) throw Boom.forbidden();
      if (!req.payload.trainees.some(t => UtilsHelper.doesArrayIncludeId(course.trainees, t))) throw Boom.notFound();
    } else {
      const courseCompanies = [INTRA, INTRA_HOLDING].includes(course.type) ? course.companies : [];
      const courseHolding = course.type === INTRA_HOLDING ? course.holding : null;
      const courseTrainerIds = get(course, 'trainers', []);
      checkAuthorization(req.auth.credentials, courseTrainerIds, courseCompanies, courseHolding);
    }
    await checkPayload(courseSlot, req.payload);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeDeletion = async (req) => {
  try {
    const courseSlot = await CourseSlot
      .findOne({ _id: req.params._id }, { course: 1, step: 1 })
      .populate({ path: 'step', select: '_id type' })
      .lean();
    if (!courseSlot) throw Boom.notFound(translate[language].courseSlotNotFound);

    const course = await Course.findOne({ _id: courseSlot.course }, { archivedAt: 1, trainers: 1 }).lean();
    if (course.archivedAt) throw Boom.forbidden();

    const { credentials } = req.auth;
    const isTrainer = get(credentials, 'role.vendor.name') === TRAINER;
    if (isTrainer && !UtilsHelper.doesArrayIncludeId(course.trainers, credentials._id)) throw Boom.forbidden();

    const courseStepHasOtherSlots = await CourseSlot.countDocuments(
      { _id: { $nin: [courseSlot._id] }, course: courseSlot.course, step: courseSlot.step._id },
      { limit: 1 }
    );
    if (!courseStepHasOtherSlots) throw Boom.forbidden();

    const attendanceExists = await Attendance.countDocuments({ courseSlot: courseSlot._id });
    if (attendanceExists) throw Boom.conflict(translate[language].attendanceExists);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
