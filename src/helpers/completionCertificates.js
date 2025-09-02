const { ObjectId } = require('mongodb');
const get = require('lodash/get');
const has = require('lodash/has');
const groupBy = require('lodash/groupBy');
const pick = require('lodash/pick');
const CompletionCertificatePdf = require('../data/pdf/completionCertificate');
const CompletionCertificate = require('../models/CompletionCertificate');
const ActivityHistory = require('../models/ActivityHistory');
const Attendance = require('../models/Attendance');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');
const { MM_YYYY, MONTH, DD_MM_YYYY, E_LEARNING, SHORT_DURATION_H_MM, OFFICIAL } = require('./constants');
const UtilsHelper = require('./utils');
const CoursesHelper = require('./courses');
const GCloudStorageHelper = require('./gCloudStorage');

exports.list = async (query, credentials) => {
  const { months, course } = query;

  let companies = [];

  if (query.companies) { companies = Array.isArray(query.companies) ? query.companies : [query.companies]; }

  const findQuery = course
    ? { course }
    : { month: { $in: Array.isArray(months) ? months : [months] } };

  const requestingOwnInfos = companies.some(company => UtilsHelper.hasUserAccessToCompany(credentials, company));
  const completionCertificates = await CompletionCertificate
    .find(findQuery)
    .populate([
      ...(months
        ? [{
          path: 'course',
          select: 'companies subProgram misc',
          populate: [
            {
              path: 'companies',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
            { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
          ],
        }]
        : []),
      { path: 'trainee', select: 'identity' }]
    )
    .setOptions({ isVendorUser: has(credentials, 'role.vendor.name'), ...(companies.length && { requestingOwnInfos }) })
    .lean();

  if (companies.length) {
    const filteredCertificates = completionCertificates.filter((certificate) => {
      const companyIds = get(certificate, 'course.companies', []).map(c => c._id);
      return !!certificate.file && companies.some(c => UtilsHelper.doesArrayIncludeId(companyIds, c));
    });

    return filteredCertificates;
  }

  return completionCertificates;
};

exports.generate = async (completionCertificateId) => {
  const VAEI_SUBPROGRAM_IDS = process.env.VAEI_SUBPROGRAM_IDS.split(',').map(id => new ObjectId(id));
  const REAL_ELEARNING_DURATION_SUBPROGRAM_IDS = process.env.REAL_ELEARNING_DURATION_SUBPROGRAM_IDS
    .split(',')
    .map(id => new ObjectId(id));

  const completionCertificate = await CompletionCertificate
    .findOne({ _id: completionCertificateId })
    .populate([
      {
        path: 'course',
        select: 'subProgram slots companies trainees',
        populate: [
          { path: 'slots', select: 'startDate endDate' },
          {
            path: 'subProgram',
            select: 'program steps',
            populate: [
              { path: 'program', select: 'name subPrograms' },
              {
                path: 'steps',
                select: 'activities type theoreticalDuration',
              },
            ],
          },
        ],
      },
      {
        path: 'trainee',
        select: 'identity',
        populate: { path: 'company', populate: { path: 'company', select: 'name' } },
      },
    ])
    .setOptions({ isVendorUser: true })
    .lean();

  const { course, month, trainee } = completionCertificate;

  const startOfMonth = CompaniDate(month, MM_YYYY).startOf(MONTH).toISO();
  const endOfMonth = CompaniDate(month, MM_YYYY).endOf(MONTH).toISO();

  const courseSlotIdsOnMonth = course.slots
    .filter(slot => CompaniDate(slot.startDate).isSameOrBetween(startOfMonth, endOfMonth)).map(s => s._id);

  const attendances = await Attendance
    .find({ trainee: trainee._id, courseSlot: { $in: courseSlotIdsOnMonth } })
    .setOptions({ isVendorUser: true })
    .lean();

  const slotsWithAttendanceIds = attendances.map(a => a.courseSlot);

  const slotsWithAttendance = course.slots
    .filter(slot => UtilsHelper.doesArrayIncludeId(slotsWithAttendanceIds, slot._id));

  const unsubscribedAttendances = await CoursesHelper.getUnsubscribedAttendances(
    { ...pick(course, ['_id', 'trainees', 'companies']), subPrograms: get(course, 'subProgram.program.subPrograms') },
    true
  );
  const slotsWithUnsubscribedAttendance = unsubscribedAttendances.map(a => a.courseSlot);

  const traineePresence = UtilsHelper.getTotalDuration([...slotsWithAttendance, ...slotsWithUnsubscribedAttendance]);

  const eLearningSteps = course.subProgram.steps.filter(step => step.type === E_LEARNING);

  const activitiesIds = eLearningSteps.flatMap(s => s.activities);
  const activityHistories = await ActivityHistory
    .find({ activity: { $in: activitiesIds }, user: trainee._id })
    .lean();
  const activityHistoriesGroupedByActivity = groupBy(activityHistories, 'activity');

  const dates = { startDate: startOfMonth, endDate: endOfMonth };

  let eLearningDuration = {};
  if (UtilsHelper.doesArrayIncludeId(REAL_ELEARNING_DURATION_SUBPROGRAM_IDS, course.subProgram._id)) {
    const filteredActivityHistories = activityHistories
      .filter(aH => (CompaniDate(aH.date).isSameOrBetween(dates.startDate, dates.endDate)));
    eLearningDuration = CoursesHelper.getRealELearningDuration(filteredActivityHistories);
  } else {
    const eLearningStepsWithAH = eLearningSteps
      .map(s => ({
        ...s,
        activities: s.activities
          .map(a => ({ _id: a, activityHistories: activityHistoriesGroupedByActivity[a] || [] })),
      }));
    eLearningDuration = CoursesHelper.getELearningDuration(eLearningStepsWithAH, trainee._id, dates);
  }

  const formattedELearningDuration = CompaniDuration(eLearningDuration).format(SHORT_DURATION_H_MM);

  const traineeIdentity = UtilsHelper.formatIdentity(trainee.identity, 'FL');
  const data = {
    trainee: {
      identity: traineeIdentity,
      attendanceDuration: traineePresence,
      eLearningDuration: formattedELearningDuration,
      companyName: trainee.company.name,
    },
    startDate: CompaniDate(startOfMonth).format(DD_MM_YYYY),
    endDate: CompaniDate(endOfMonth).format(DD_MM_YYYY),
    date: CompaniDate().format(DD_MM_YYYY),
    isVAEISubProgram: UtilsHelper.doesArrayIncludeId(VAEI_SUBPROGRAM_IDS, course.subProgram._id),
    certificateGenerationModeIsMonthly: true,
    programName: get(course, 'subProgram.program.name').toUpperCase() || '',
  };

  const pdf = await CompletionCertificatePdf.getPdf(data, OFFICIAL);
  const fileName = `certificat_realisation_${traineeIdentity}_${month}`;
  const fileUploaded = await GCloudStorageHelper
    .uploadCourseFile({ fileName, file: pdf, contentType: 'application/pdf' });

  await CompletionCertificate.updateOne({ _id: completionCertificateId }, { file: fileUploaded });
};

exports.create = async payload => CompletionCertificate.create(payload);

exports.deleteFile = async (completionCertificateId) => {
  const completionCertificate = await CompletionCertificate.findOne({ _id: completionCertificateId }).lean();
  await CompletionCertificate.updateOne({ _id: completionCertificateId }, { $unset: { file: '' } });

  await GCloudStorageHelper.deleteCourseFile(completionCertificate.file.publicId);
};
