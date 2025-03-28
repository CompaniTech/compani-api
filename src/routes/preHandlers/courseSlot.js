const Boom = require('@hapi/boom');
const get = require('lodash/get');
const CourseSlot = require('../../models/CourseSlot');
const Course = require('../../models/Course');
const Step = require('../../models/Step');
const Attendance = require('../../models/Attendance');
const AttendanceSheet = require('../../models/AttendanceSheet');
const translate = require('../../helpers/translate');
const { checkAuthorization } = require('./courses');
const { E_LEARNING, ON_SITE, REMOTE, INTRA, INTRA_HOLDING } = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const { CompaniDate } = require('../../helpers/dates/companiDates');

const { language } = translate;

exports.authorizeCreate = async (req) => {
  try {
    const { course: courseId, step: stepId } = req.payload;

    const course = await Course.findById(courseId, { subProgram: 1, archivedAt: 1 })
      .populate({ path: 'subProgram', select: 'steps' })
      .lean();
    if (!course) throw Boom.notFound();
    if (course.archivedAt) throw Boom.forbidden();

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

  if (!hasOneDate) {
    const attendances = await Attendance.countDocuments({ courseSlot: courseSlot._id });
    const attendanceSheets = await AttendanceSheet.countDocuments({ slots: courseSlot._id });
    if (attendances || attendanceSheets) throw Boom.forbidden(translate[language].courseSlotWithAttendances);
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
      .findOne({ _id: req.params._id }, { course: 1, step: 1 })
      .populate({ path: 'step', select: 'type' })
      .lean();
    if (!courseSlot) throw Boom.notFound(translate[language].courseSlotNotFound);

    const courseId = get(courseSlot, 'course') || '';
    const course = await Course
      .findOne({ _id: courseId }, { archivedAt: 1, trainers: 1, type: 1, companies: 1, holding: 1 })
      .lean();
    if (course.archivedAt) throw Boom.forbidden();

    const courseCompanies = [INTRA, INTRA_HOLDING].includes(course.type) ? course.companies : [];
    const courseHolding = course.type === INTRA_HOLDING ? course.holding : null;
    const courseTrainerIds = get(course, 'trainers', []);
    checkAuthorization(req.auth.credentials, courseTrainerIds, courseCompanies, courseHolding);
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

    const course = await Course.findOne({ _id: courseSlot.course }, { archivedAt: 1 }).lean();
    if (course.archivedAt) throw Boom.forbidden();

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
