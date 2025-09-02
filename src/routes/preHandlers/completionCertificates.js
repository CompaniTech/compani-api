const Boom = require('@hapi/boom');
const get = require('lodash/get');
const has = require('lodash/has');
const Course = require('../../models/Course');
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
