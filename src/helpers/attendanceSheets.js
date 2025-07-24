const omit = require('lodash/omit');
const get = require('lodash/get');
const AttendanceSheet = require('../models/AttendanceSheet');
const InterAttendanceSheet = require('../data/pdf/attendanceSheet/interAttendanceSheet');
const User = require('../models/User');
const Course = require('../models/Course');
const CourseHistoriesHelper = require('./courseHistories');
const CoursesHelper = require('./courses');
const GCloudStorageHelper = require('./gCloudStorage');
const NotificationHelper = require('./notifications');
const UtilsHelper = require('./utils');
const { CompaniDate } = require('./dates/companiDates');
const { DAY_MONTH_YEAR, COURSE, TRAINEE } = require('./constants');

exports.create = async (payload, credentials) => {
  let fileName;
  let companies;
  let slots = [];
  let signature = {};
  let fileUploaded = {};
  const formationExpoTokens = [];

  const course = await Course.findOne({ _id: payload.course }, { companies: 1 }).lean();

  if (payload.date) {
    fileName = CompaniDate(payload.date).format(DAY_MONTH_YEAR);
    companies = course.companies;
  } else {
    const { identity, formationExpoTokenList } = await User
      .findOne({ _id: payload.trainee }, { identity: 1, formationExpoTokenList: 1 })
      .lean();
    fileName = UtilsHelper.formatIdentity(identity, 'FL');

    const traineeCompanyAtCourseRegistration = await CourseHistoriesHelper
      .getCompanyAtCourseRegistrationList(
        { key: COURSE, value: payload.course }, { key: TRAINEE, value: [payload.trainee] }
      );
    companies = [get(traineeCompanyAtCourseRegistration[0], 'company')];

    if (payload.slots) {
      if (get(formationExpoTokenList, 'length')) formationExpoTokens.push(...formationExpoTokenList);
    }
  }

  if (payload.file) {
    fileUploaded = await GCloudStorageHelper.uploadCourseFile({
      fileName: `emargement_${fileName}`,
      file: payload.file,
    });
    if (payload.slots) {
      slots = Array.isArray(payload.slots) ? payload.slots.map(s => ({ slotId: s })) : [{ slotId: payload.slots }];
    }
  } else {
    fileName = `${credentials._id}_course_${payload.course}`;
    signature = await GCloudStorageHelper.uploadCourseFile({
      fileName: `trainer_signature_${fileName}`,
      file: payload.signature,
    });
    slots = (Array.isArray(payload.slots) ? payload.slots : [payload.slots]).map(s => ({
      slotId: s,
      trainerSignature: { trainerId: payload.trainer, signature: signature.link },
    }));
  }

  const attendanceSheet = await AttendanceSheet.create({
    ...omit(payload, 'signature'),
    companies,
    ...(Object.keys(fileUploaded).length && { file: fileUploaded }),
    ...(slots.length && { slots }),
  });

  if (get(attendanceSheet, 'slots[0].trainerSignature')) {
    await NotificationHelper.sendAttendanceSheetSignatureRequestNotification(attendanceSheet._id, formationExpoTokens);
  }
};

exports.list = async (query, credentials) => {
  const isVendorUser = !!get(credentials, 'role.vendor');
  const companies = [];
  if (query.holding) companies.push(...credentials.holding.companies);
  if (query.company) companies.push(query.company);

  const attendanceSheets = await AttendanceSheet
    .find({ course: query.course, ...(companies.length && { companies: { $in: companies } }) })
    .populate({ path: 'trainee', select: 'identity' })
    .populate({ path: 'slots.slotId', select: 'startDate endDate step' })
    .setOptions({ isVendorUser })
    .lean();

  return attendanceSheets;
};

exports.update = async (attendanceSheetId, payload) =>
  AttendanceSheet.updateOne({ _id: attendanceSheetId }, { $set: { slots: payload.slots.map(s => ({ slotId: s })) } });

exports.sign = async (attendanceSheetId, payload, credentials) => {
  const signature = await GCloudStorageHelper.uploadCourseFile({
    fileName: `trainee_signature_${credentials._id}`,
    file: payload.signature,
  });

  const attendanceSheet = await AttendanceSheet.findOne({ _id: attendanceSheetId }).lean();
  const slots = attendanceSheet.slots
    .map(s => ({ ...s, traineesSignature: [{ traineeId: credentials._id, signature: signature.link }] }));

  return AttendanceSheet.updateOne({ _id: attendanceSheetId }, { $set: { slots } });
};

exports.generate = async (attendanceSheetId) => {
  const attendanceSheet = await AttendanceSheet
    .findOne({ _id: attendanceSheetId })
    .populate({
      path: 'slots.slotId',
      select: 'step startDate endDate address',
      populate: { path: 'step', select: 'type' },
    })
    .populate({ path: 'trainee', select: 'identity' })
    .populate({ path: 'trainer', select: 'identity' })
    .populate({
      path: 'course',
      select: 'type misc companies subProgram',
      populate: [
        { path: 'companies', select: 'name' },
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
      ],
    })
    .lean();

  const formattedCourse = {
    ...attendanceSheet.course,
    slots: attendanceSheet.slots.map(s => s.slotId),
    trainees: [attendanceSheet.trainee],
    trainers: [attendanceSheet.trainer],
  };
  const formattedCourseForInter = await CoursesHelper.formatInterCourseForPdf(formattedCourse);
  const signedSlots = attendanceSheet.slots.map(s => ({ slotId: s.slotId._id, ...omit(s, 'slotId') }));
  const pdf = await InterAttendanceSheet.getPdf({ ...formattedCourseForInter, signedSlots });
  const slotsDates = [...new Set(formattedCourseForInter.trainees[0].course.slots.map(slot => slot.date))].join(', ');
  const fileName = `emargements_${formattedCourseForInter.trainees[0].traineeName}_${slotsDates}`
    .replaceAll(/ - | |'/g, '_');
  const fileUploaded = await GCloudStorageHelper
    .uploadCourseFile({ fileName, file: pdf, contentType: 'application/pdf' });

  await AttendanceSheet.updateOne({ _id: attendanceSheetId }, { $set: { file: fileUploaded } });
};

exports.delete = async (attendanceSheetId) => {
  const attendanceSheet = await AttendanceSheet.findOne({ _id: attendanceSheetId }).lean();

  await AttendanceSheet.deleteOne({ _id: attendanceSheet._id });

  if (attendanceSheet.slots) {
    const promises = [];
    const { slots } = attendanceSheet;
    const signatures = [];
    for (const slot of slots) {
      if (slot.trainerSignature) signatures.push(slot.trainerSignature.signature);
      if (slot.traineesSignature) signatures.push(...slot.traineesSignature.map(s => s.signature));
    }

    for (const signature of [...new Set(signatures)]) {
      promises.push(GCloudStorageHelper.deleteCourseFile(signature.split('/').pop()));
    }

    await Promise.all(promises);
  }

  if (attendanceSheet.file) await GCloudStorageHelper.deleteCourseFile(attendanceSheet.file.publicId);
};
