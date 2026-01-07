const Boom = require('@hapi/boom');
const get = require('lodash/get');
const has = require('lodash/has');
const Attendance = require('../../models/Attendance');
const Course = require('../../models/Course');
const CourseSlot = require('../../models/CourseSlot');
const CompletionCertificate = require('../../models/CompletionCertificate');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
const { CompaniDate } = require('../../helpers/dates/companiDates');
const { MM_YYYY, MONTH } = require('../../helpers/constants');

const { language } = translate;

exports.authorizeGetCompletionCertificates = async (req) => {
  const { course, companies: queryCompanies } = req.query;
  const { credentials } = req.auth;

  if (course) {
    const courseExists = await Course.countDocuments({ _id: course });
    if (!courseExists) throw Boom.notFound();
  }

  if (queryCompanies) {
    const companies = Array.isArray(queryCompanies) ? queryCompanies : [queryCompanies];
    if (companies.length) {
      const loggedUserHasClientRole = has(credentials, 'role.client');
      const hasAccessToCompany = companies.every(company => UtilsHelper.hasUserAccessToCompany(credentials, company));
      if (!loggedUserHasClientRole || !hasAccessToCompany) throw Boom.forbidden();
    }
  }

  return null;
};

exports.authorizeCompletionCertificateEdit = async (req) => {
  const { _id: completionCertificateId } = req.params;

  const completionCertificate = await CompletionCertificate.findOne({ _id: completionCertificateId }).lean();
  if (!completionCertificate) throw Boom.notFound();

  if (get(completionCertificate, 'file.link')) {
    throw Boom.conflict(translate[language].completionCertificateAlreadyGenerated);
  }

  const startOfMonth = CompaniDate(completionCertificate.month, MM_YYYY).startOf(MONTH).toDate();
  const endOfMonth = CompaniDate(completionCertificate.month, MM_YYYY).endOf(MONTH).toDate();

  const courseSlots = await CourseSlot
    .find({ course: completionCertificate.course, endDate: { $lte: endOfMonth }, startDate: { $gte: startOfMonth } })
    .lean();

  const expectedAttendances = courseSlots.reduce((acc, slot) => {
    if (slot.trainees && !UtilsHelper.doesArrayIncludeId(slot.trainees, completionCertificate.trainee)) return acc;
    return acc + 1;
  }, 0);

  const attendances = await Attendance
    .countDocuments({ courseSlot: { $in: courseSlots.map(s => s._id) }, trainee: completionCertificate.trainee });

  if (attendances !== expectedAttendances) throw Boom.forbidden(translate[language].someAttendancesAreEmpty);

  return null;
};

exports.authorizeCompletionCertificateCreation = async (req) => {
  const { trainee, course: courseId, month } = req.payload;

  const startOfMonth = CompaniDate(month, MM_YYYY).startOf(MONTH).toISO();
  const endOfMonth = CompaniDate(month, MM_YYYY).endOf(MONTH).toISO();

  const course = await Course.findOne({ _id: courseId })
    .populate({
      path: 'slots',
      select: 'startDate endDate',
      match: { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
      populate: { path: 'attendances', options: { isVendorUser: true }, match: { trainee } },
    })
    .populate({
      path: 'subProgram',
      select: 'steps',
      populate: {
        path: 'steps',
        select: 'type activities',
        populate: {
          path: 'activities',
          populate: {
            path: 'activityHistories',
            match: { user: trainee, date: { $gte: startOfMonth, $lte: endOfMonth } },
          },
        },
      },
    })
    .lean();
  if (!course) throw Boom.notFound();

  if (!course.trainees.some(t => UtilsHelper.areObjectIdsEquals(t, trainee))) throw Boom.forbidden();

  const completionCertificate = await CompletionCertificate.countDocuments({ trainee, course: courseId, month });
  if (completionCertificate) throw Boom.conflict(translate[language].completionCertificatesAlreadyExist);

  const hasSlotsWithAttendance = course.slots.some(s => s.attendances.length);
  const hasActivityHistories = course.subProgram.steps.some(s => s.activities.some(a => a.activityHistories.length));

  if (!hasSlotsWithAttendance && !hasActivityHistories) {
    throw Boom.forbidden(translate[language].completionCertificateError);
  }

  return null;
};

exports.authorizeCompletionCertificateFileDeletion = async (req) => {
  const completionCertificate = await CompletionCertificate
    .findOne({ _id: req.params._id })
    .populate({ path: 'course', select: 'archivedAt' })
    .lean();

  if (!completionCertificate) throw Boom.notFound();

  if (completionCertificate.course.archivedAt) throw Boom.forbidden();

  if (!has(completionCertificate, 'file.publicId')) throw Boom.forbidden();

  return null;
};
