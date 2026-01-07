const Boom = require('@hapi/boom');
const get = require('lodash/get');
const has = require('lodash/has');
const CourseSlot = require('../../models/CourseSlot');
const Course = require('../../models/Course');
const CompletionCertificate = require('../../models/CompletionCertificate');
const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const AttendanceSheet = require('../../models/AttendanceSheet');
const UserCompany = require('../../models/UserCompany');
const {
  TRAINER,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  CLIENT_ADMIN,
  COACH,
  INTRA_HOLDING,
  BLENDED,
  SINGLE,
  MM_YYYY,
  PRESENT,
  MISSING,
} = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');
const { CompaniDate } = require('../../helpers/dates/companiDates');

const { language } = translate;

const isTrainerAuthorized = (loggedUserId, trainersIds) => {
  if (!UtilsHelper.doesArrayIncludeId(trainersIds, loggedUserId)) throw Boom.forbidden();

  return null;
};

const checkPermissionOnCourse = (course, credentials) => {
  const loggedUserVendorRole = get(credentials, 'role.vendor.name');
  const loggedUserClientRole = get(credentials, 'role.client.name');

  const isCourseTrainer = loggedUserVendorRole === TRAINER &&
    UtilsHelper.doesArrayIncludeId(course.trainers, credentials._id);
  const isAdminVendor = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(loggedUserVendorRole);

  const isClientOrHoldingAndAuthorized = [COACH, CLIENT_ADMIN].includes(loggedUserClientRole) &&
    (course.companies.some(company => UtilsHelper.hasUserAccessToCompany(credentials, company)) ||
    UtilsHelper.areObjectIdsEquals(course.holding, get(credentials, 'holding._id')));

  if (!isClientOrHoldingAndAuthorized && !isAdminVendor && !isCourseTrainer) throw Boom.forbidden();

  return null;
};

exports.authorizeAttendancesGet = async (req) => {
  const courseSlotsQuery = req.query.courseSlot ? { _id: req.query.courseSlot } : { course: req.query.course };
  const courseSlots = await CourseSlot.find(courseSlotsQuery, { course: 1 })
    .populate({ path: 'course', select: 'trainers companies holding' })
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

    const course = await Course.findOne({ _id: courseId }, { trainers: 1, companies: 1, holding: 1 }).lean();
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
  const courseSlot = await CourseSlot.findOne({ _id: req.payload.courseSlot }, { course: 1, startDate: 1, trainees: 1 })
    .populate({
      path: 'course',
      select: 'trainers companies archivedAt trainees type holding subProgram',
      populate: [
        { path: 'holding', populate: { path: 'companies' } },
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'subPrograms' } },
      ],
    })
    .lean();
  if (!courseSlot) throw Boom.notFound();

  const { credentials } = req.auth;
  const trainersIds = courseSlot.course.trainers;
  if (get(credentials, 'role.vendor.name') === TRAINER) isTrainerAuthorized(credentials._id, trainersIds);

  const { course } = courseSlot;
  if (course.archivedAt) throw Boom.forbidden();

  const companies = course.type === INTRA_HOLDING ? course.holding.companies : course.companies;
  if (!companies.length) throw Boom.badData();

  if (req.payload.trainee) {
    const attendance = await Attendance.countDocuments(req.payload);
    if (attendance) throw Boom.conflict();

    const isTraineeRegistered = UtilsHelper.doesArrayIncludeId(course.trainees, req.payload.trainee);

    if (course.type === SINGLE && !isTraineeRegistered) throw Boom.forbidden();

    const traineeUserCompany = await UserCompany
      .findOne({
        user: req.payload.trainee,
        company: { $in: companies },
        startDate: { $lte: CompaniDate().toISO() },
        $or: [{ endDate: { $exists: false } }, { endDate: { $gte: CompaniDate().toISO() } }],
      })
      .lean();
    if (!traineeUserCompany) throw Boom.forbidden();

    const isTraineeCompanyInCourse = UtilsHelper.doesArrayIncludeId(course.companies, traineeUserCompany.company);
    if (course.type === INTRA_HOLDING && !isTraineeRegistered && !isTraineeCompanyInCourse) {
      const coursesWithTraineeCount = await Course
        .countDocuments({
          format: BLENDED,
          trainees: req.payload.trainee,
          subProgram: { $in: get(course, 'subProgram.program.subPrograms') },
        });

      if (!coursesWithTraineeCount) throw Boom.forbidden(translate[language].traineeMustBeRegisteredInAnotherGroup);
    }

    const isTraineeConcerned = !courseSlot.trainees ||
      UtilsHelper.doesArrayIncludeId(courseSlot.trainees, req.payload.trainee);
    if (isTraineeRegistered && !isTraineeConcerned) {
      throw Boom.forbidden(translate[language].traineeNotConcernedBySlot);
    }
  }

  const isLinkedToCompletionCertificate = await CompletionCertificate.countDocuments({
    course: course._id,
    month: CompaniDate(courseSlot.startDate).format(MM_YYYY),
    ...req.payload.trainee && { trainee: req.payload.trainee },
    file: { $exists: true },
  });
  if (isLinkedToCompletionCertificate) {
    throw Boom.forbidden(translate[language].attendanceIsLinkedToCompletionCertificate);
  }

  return null;
};

const authorizeAttendanceUpdate = async (req, status, courseTrainees = []) => {
  const { courseSlot: courseSlotId, trainee: traineeId } = req.query;
  if (traineeId) {
    const attendance = await Attendance.countDocuments({ ...req.query, status });
    if (!attendance) throw Boom.notFound();
  } else {
    const attendancesWithWrongStatus = await Attendance.countDocuments({
      ...req.query,
      ...courseTrainees.length && { trainee: { $in: courseTrainees } },
      status: { $ne: status },
    });
    if (attendancesWithWrongStatus) throw Boom.conflict();
  }

  const courseSlot = await CourseSlot.findById(courseSlotId)
    .populate({ path: 'course', select: 'trainers archivedAt' })
    .lean();
  const { course } = courseSlot;
  if (course.archivedAt) throw Boom.forbidden();

  const { credentials } = req.auth;
  const trainersIds = courseSlot.course.trainers;
  if (get(credentials, 'role.vendor.name') === TRAINER) isTrainerAuthorized(credentials._id, trainersIds);

  const isLinkedToAttendanceSheet = await AttendanceSheet.countDocuments(
    {
      'slots.slotId': courseSlot._id,
      ...(traineeId && {
        $or: [
          { trainee: traineeId },
          { slots: { $elemMatch: { slotId: courseSlot._id, 'traineesSignature.traineeId': traineeId } } },
        ],
      }),
    }
  );
  if (isLinkedToAttendanceSheet) throw Boom.forbidden(translate[language].attendanceIsLinkedToAttendanceSheet);

  const isLinkedToCompletionCertificate = await CompletionCertificate.countDocuments({
    course: course._id,
    month: CompaniDate(courseSlot.startDate).format(MM_YYYY),
    ...traineeId && { trainee: traineeId },
    file: { $exists: true },
  });
  if (isLinkedToCompletionCertificate) {
    throw Boom.forbidden(translate[language].attendanceIsLinkedToCompletionCertificate);
  }

  return null;
};

exports.authorizeAttendanceEdition = async req => authorizeAttendanceUpdate(req, PRESENT);

exports.authorizeAttendanceDeletion = async (req) => {
  const { courseSlot: courseSlotId, trainee: traineeId } = req.query;
  let status = MISSING;
  const courseSlot = await CourseSlot.findById(courseSlotId)
    .populate({ path: 'course', select: 'trainees' })
    .lean();
  const { course } = courseSlot;
  if (traineeId) {
    if (!UtilsHelper.doesArrayIncludeId(course.trainees, traineeId)) status = PRESENT;
  }
  return authorizeAttendanceUpdate(req, status, !traineeId ? course.trainees : []);
};
