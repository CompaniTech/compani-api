const { ObjectId } = require('mongodb');
const get = require('lodash/get');
const CompletionCertificatePdf = require('../data/pdf/completionCertificate');
const CompletionCertificate = require('../models/CompletionCertificate');
const Attendance = require('../models/Attendance');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');
const { MM_YYYY, MONTH, DD_MM_YYYY, E_LEARNING, SHORT_DURATION_H_MM, OFFICIAL } = require('./constants');
const UtilsHelper = require('./utils');
const CoursesHelper = require('./courses');
const GCloudStorageHelper = require('./gCloudStorage');

const VAEI_SUBPROGRAM_IDS = process.env.VAEI_SUBPROGRAM_IDS.split(';').map(id => new ObjectId(id));

exports.list = async (query) => {
  const { months, course } = query;

  const findQuery = course
    ? { course }
    : { month: { $in: Array.isArray(months) ? months : [months] } };

  const completionCertificates = await CompletionCertificate
    .find(findQuery, { course: 1, trainee: 1, month: 1 })
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
    .setOptions({ isVendorUser: true })
    .lean();

  return completionCertificates;
};

exports.generate = async (req) => {
  const { _id: completionCertificateId } = req.params;

  const completionCertificate = await CompletionCertificate
    .findOne({ _id: completionCertificateId })
    .populate([
      {
        path: 'course',
        select: 'companies subProgram slots',
        populate: [
          { path: 'slots', select: 'startDate endDate' },
          {
            path: 'subProgram',
            select: 'program steps',
            populate: [
              { path: 'program', select: 'name' },
              {
                path: 'steps',
                select: 'activities type theoreticalDuration',
                populate: { path: 'activities', populate: { path: 'activityHistories' } },
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

  const startOfMonth = CompaniDate(month, MM_YYYY).startOf(MONTH).format(DD_MM_YYYY);
  const endOfMonth = CompaniDate(month, MM_YYYY).endOf(MONTH).format(DD_MM_YYYY);

  const courseSlotIdsOnMonth = course.slots
    .filter(slot => CompaniDate(slot.startDate).isSameOrAfter(CompaniDate(startOfMonth, DD_MM_YYYY)) &&
      CompaniDate(slot.endDate).isSameOrBefore(CompaniDate(endOfMonth, DD_MM_YYYY)))
    .map(s => s._id);

  const attendances = await Attendance
    .find({ trainee: trainee._id, courseSlot: { $in: courseSlotIdsOnMonth } })
    .setOptions({ isVendorUser: true })
    .lean();

  const slotsWithAttendanceIds = attendances.map(a => a.courseSlot);

  const slotsWithAttendance = course.slots
    .filter(slot => UtilsHelper.doesArrayIncludeId(slotsWithAttendanceIds, slot._id));

  const traineePresence = UtilsHelper.getTotalDuration(slotsWithAttendance);

  const eLearningSteps = course.subProgram.steps.filter(step => step.type === E_LEARNING);
  const dates = {
    startDate: CompaniDate(startOfMonth, DD_MM_YYYY).toISO(),
    endDate: CompaniDate(endOfMonth, DD_MM_YYYY).toISO(),
  };

  const eLearningDuration = CoursesHelper.getELearningDuration(eLearningSteps, trainee._id, dates);

  const formattedELearningDuration = CompaniDuration(eLearningDuration).format(SHORT_DURATION_H_MM);

  const traineeIdentity = UtilsHelper.formatIdentity(trainee.identity, 'FL');
  const data = {
    trainee: {
      identity: traineeIdentity,
      attendanceDuration: traineePresence,
      eLearningDuration: formattedELearningDuration,
      companyName: trainee.company.name,
    },
    startDate: startOfMonth,
    endDate: endOfMonth,
    date: CompaniDate().format(DD_MM_YYYY),
    isVAEISubProgram: UtilsHelper.doesArrayIncludeId(VAEI_SUBPROGRAM_IDS, course.subProgram._id),
    certificateGenerationModeIsMonthly: true,
    programName: get(course, 'subProgram.program.name').toUpperCase() || '',
  };

  const pdf = await CompletionCertificatePdf.getPdf(data, OFFICIAL);
  const fileName = `certificat_realisation_${traineeIdentity}_${month}`;
  const fileUploaded = await GCloudStorageHelper.uploadCourseFile({ fileName, file: pdf });

  await CompletionCertificate.updateOne({ _id: completionCertificateId }, { file: fileUploaded });
};
