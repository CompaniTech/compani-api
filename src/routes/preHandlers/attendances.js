const Boom = require('@hapi/boom');
const get = require('lodash/get');
const has = require('lodash/has');
const CourseSlot = require('../../models/CourseSlot');
const Course = require('../../models/Course');
const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const UserCompany = require('../../models/UserCompany');
const {
  TRAINER,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  CLIENT_ADMIN,
  COACH,
} = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const { CompaniDate } = require('../../helpers/dates/companiDates');

const isTrainerAuthorized = (loggedUserId, trainer) => {
  if (!UtilsHelper.areObjectIdsEquals(loggedUserId, trainer)) throw Boom.forbidden();

  return null;
};

const checkPermissionOnCourse = (course, credentials) => {
  const loggedUserVendorRole = get(credentials, 'role.vendor.name');
  const loggedUserClientRole = get(credentials, 'role.client.name');

  const isCourseTrainer = loggedUserVendorRole === TRAINER &&
    UtilsHelper.areObjectIdsEquals(credentials._id, course.trainer);
  const isAdminVendor = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(loggedUserVendorRole);

  const isClientOrHoldingAndAuthorized = [COACH, CLIENT_ADMIN].includes(loggedUserClientRole) &&
    course.companies.some(company => UtilsHelper.hasUserAccessToCompany(credentials, company));

  if (!isClientOrHoldingAndAuthorized && !isAdminVendor && !isCourseTrainer) throw Boom.forbidden();

  return null;
};

exports.authorizeAttendancesGet = async (req) => {
  const courseSlotsQuery = req.query.courseSlot ? { _id: req.query.courseSlot } : { course: req.query.course };
  const courseSlots = await CourseSlot.find(courseSlotsQuery, { course: 1 })
    .populate({ path: 'course', select: 'trainer companies' })
    .lean();

  if (!courseSlots.length) throw Boom.notFound();

  const { credentials } = req.auth;
  const { course } = courseSlots[0];

  checkPermissionOnCourse(course, credentials);

  return { courseSlotsIds: courseSlots.map(cs => cs._id) };
};

exports.authorizeUnsubscribedAttendancesGet = async (req) => {
  const { course: courseId, trainee: traineeId, company: companyId, holding: holdingId } = req.query;
  const { credentials } = req.auth;
  const loggedUserHasVendorRole = has(credentials, 'role.vendor');
  const loggedUserClientRole = get(credentials, 'role.client.name');
  const loggedUserVendorRole = get(credentials, 'role.vendor.name');
  const loggedUserCompany = get(credentials, 'company._id');

  if (courseId) {
    if (!loggedUserHasVendorRole && [COACH, CLIENT_ADMIN].includes(loggedUserClientRole) &&
      !(req.query.company || req.query.holding)) {
      throw Boom.badRequest();
    }

    const course = await Course.findOne({ _id: courseId }, { trainer: 1, companies: 1 }).lean();
    if (!course) throw Boom.notFound();

    checkPermissionOnCourse(course, credentials);
  }
  if (traineeId) {
    const trainee = await User.findOne({ _id: traineeId }).populate({ path: 'company' }).lean();
    if (!trainee) throw Boom.notFound();

    if (!UtilsHelper.hasUserAccessToCompany(credentials, trainee.company)) {
      if (!loggedUserVendorRole) throw Boom.notFound();
      if (loggedUserVendorRole === TRAINER) throw Boom.forbidden();
    }
  }
  if (companyId && !loggedUserHasVendorRole && !UtilsHelper.areObjectIdsEquals(loggedUserCompany, companyId)) {
    throw Boom.notFound();
  }
  if (holdingId && !UtilsHelper.areObjectIdsEquals(get(credentials, 'holding._id'), holdingId)) throw Boom.notFound();

  return null;
};

exports.authorizeAttendanceCreation = async (req) => {
  const courseSlot = await CourseSlot.findOne({ _id: req.payload.courseSlot }, { course: 1 })
    .populate({ path: 'course', select: 'trainer companies archivedAt trainees' })
    .lean();
  if (!courseSlot) throw Boom.notFound();

  const { credentials } = req.auth;
  if (get(credentials, 'role.vendor.name') === TRAINER) isTrainerAuthorized(credentials._id, courseSlot.course.trainer);

  const { course } = courseSlot;
  if (course.archivedAt) throw Boom.forbidden();
  if (!course.companies.length) throw Boom.badData();

  if (req.payload.trainee) {
    const attendance = await Attendance.countDocuments(req.payload);
    if (attendance) throw Boom.conflict();

    const isTraineeRegistered = UtilsHelper.doesArrayIncludeId(course.trainees, req.payload.trainee);

    const doesTraineeBelongToCompany = await UserCompany.countDocuments({
      user: req.payload.trainee,
      company: { $in: course.companies },
      startDate: { $lte: CompaniDate().toISO() },
      $or: [{ endDate: { $exists: false } }, { endDate: { $gte: CompaniDate().toISO() } }],
    });

    if (!isTraineeRegistered && !doesTraineeBelongToCompany) throw Boom.forbidden();
  }

  return null;
};

exports.authorizeAttendanceDeletion = async (req) => {
  const { courseSlot: courseSlotId, trainee: traineeId } = req.query;

  if (traineeId) {
    const attendance = await Attendance.countDocuments(req.query);
    if (!attendance) throw Boom.notFound();
  }

  const courseSlot = await CourseSlot.findById(courseSlotId)
    .populate({ path: 'course', select: 'trainer archivedAt' })
    .lean();
  const { course } = courseSlot;
  if (course.archivedAt) throw Boom.forbidden();

  const { credentials } = req.auth;
  if (get(credentials, 'role.vendor.name') === TRAINER) {
    isTrainerAuthorized(credentials._id, courseSlot.course.trainer);
  }

  return null;
};
