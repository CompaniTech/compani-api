const omit = require('lodash/omit');
const get = require('lodash/get');
const cloneDeep = require('lodash/cloneDeep');
const AttendanceSheet = require('../models/AttendanceSheet');
const Attendance = require('../models/Attendance');
const InterAttendanceSheet = require('../data/pdf/attendanceSheet/interAttendanceSheet');
const IntraAttendanceSheet = require('../data/pdf/attendanceSheet/intraAttendanceSheet');
const User = require('../models/User');
const Course = require('../models/Course');
const AttendanceHelper = require('./attendances');
const CourseHistoriesHelper = require('./courseHistories');
const CoursesHelper = require('./courses');
const GCloudStorageHelper = require('./gCloudStorage');
const NotificationHelper = require('./notifications');
const UtilsHelper = require('./utils');
const { CompaniDate } = require('./dates/companiDates');
const { DAY_MONTH_YEAR, COURSE, TRAINEE, INTER_B2B, SINGLE, INTRA_HOLDING } = require('./constants');

exports.create = async (payload, credentials) => {
  let fileName;
  let companies;
  let slots = [];
  let fileUploaded = {};
  const formationExpoTokens = {};

  const course = await Course.findOne({ _id: payload.course }, { companies: 1, type: 1 }).lean();

  const promises = [];
  if (payload.date) {
    fileName = CompaniDate(payload.date).format(DAY_MONTH_YEAR);
    companies = course.companies;
    if (payload.signature) {
      const signature = await GCloudStorageHelper.uploadCourseFile({
        fileName: `trainer_signature_${fileName}`,
        file: payload.signature,
      });

      const slotList = Array.isArray(payload.slots) ? payload.slots : [payload.slots];
      const tempCompanies = [];
      for (const slot of slotList) {
        const trainees = Array.isArray(slot.trainees) ? slot.trainees : [slot.trainees];
        for (const trainee of trainees) {
          if (!formationExpoTokens[trainee]) {
            const { formationExpoTokenList } = await User
              .findOne({ _id: trainee }, { formationExpoTokenList: 1 })
              .lean();
            if (get(formationExpoTokenList, 'length')) formationExpoTokens[trainee] = formationExpoTokenList;
            if (course.type === INTRA_HOLDING) {
              const traineeCompanyAtCourseRegistration = await CourseHistoriesHelper
                .getCompanyAtCourseRegistrationList(
                  { key: COURSE, value: payload.course }, { key: TRAINEE, value: [trainee] }
                );
              const company = get(traineeCompanyAtCourseRegistration[0], 'company');
              if (!UtilsHelper.doesArrayIncludeId(tempCompanies, company)) tempCompanies.push(company);
            }
          }
        }
        const formattedSlot = {
          slotId: slot.slotId,
          trainerSignature: { trainerId: payload.trainer, signature: signature.link },
          traineesSignature: trainees.map(t => ({ traineeId: t })),
        };
        slots.push(formattedSlot);
      }
      if (course.type === INTRA_HOLDING) companies = tempCompanies;
      promises.push(AttendanceSheet.create({ ...omit(payload, 'signature'), companies, slots }));
    }
  } else {
    const trainees = Array.isArray(payload.trainees) ? payload.trainees : [payload.trainees];
    for (const trainee of trainees) {
      const { identity, formationExpoTokenList } = await User
        .findOne({ _id: trainee }, { identity: 1, formationExpoTokenList: 1 })
        .lean();
      fileName = UtilsHelper.formatIdentity(identity, 'FL');

      const traineeCompanyAtCourseRegistration = await CourseHistoriesHelper
        .getCompanyAtCourseRegistrationList(
          { key: COURSE, value: payload.course }, { key: TRAINEE, value: [trainee] }
        );
      companies = [get(traineeCompanyAtCourseRegistration[0], 'company')];

      if (payload.signature) {
        const signatureCopy = cloneDeep(payload.signature);
        if (get(formationExpoTokenList, 'length')) formationExpoTokens[trainee] = formationExpoTokenList;
        const attendanceSheet = await AttendanceSheet
          .findOne({ trainee, course: payload.course, slots: { $exists: true }, file: { $exists: false } }).lean();
        let slotWithTrainerSignature = null;
        if (attendanceSheet && course.type === INTER_B2B) {
          slotWithTrainerSignature = attendanceSheet.slots
            .find(s => UtilsHelper.areObjectIdsEquals(s.trainerSignature.trainerId, payload.trainer));
        }

        let trainerSignature = '';
        if (slotWithTrainerSignature) trainerSignature = slotWithTrainerSignature.trainerSignature.signature;
        else {
          fileName = `${credentials._id}_course_${payload.course}_${trainee}`;
          const signature = await GCloudStorageHelper.uploadCourseFile({
            fileName: `trainer_signature_${fileName}`,
            file: signatureCopy,
          });
          trainerSignature = signature.link;
        }
        slots = (Array.isArray(payload.slots) ? payload.slots : [payload.slots]).map(s => ({
          slotId: s,
          trainerSignature: { trainerId: payload.trainer, signature: trainerSignature },
        }));
        if (attendanceSheet && course.type === INTER_B2B) {
          promises.push(AttendanceSheet.findOneAndUpdate({ _id: attendanceSheet._id }, { $push: { slots } }));
        } else {
          promises.push(
            AttendanceSheet.create({ ...omit(payload, ['signature', 'trainees']), trainee, companies, slots })
          );
        }
      }
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

    promises.push(
      AttendanceSheet.create({
        ...omit(payload, 'trainees'),
        ...payload.trainees && { trainee: payload.trainees },
        companies,
        ...(Object.keys(fileUploaded).length && { file: fileUploaded }),
        ...(slots.length && { slots }),
      })
    );
  }

  const attendancesPromises = [];
  if (slots.length) {
    for (const slot of slots) {
      const trainees = [];
      if (payload.trainees) trainees.push(...(Array.isArray(payload.trainees) ? payload.trainees : [payload.trainees]));
      else trainees.push(...slot.traineesSignature.map(signature => signature.traineeId));
      for (const trainee of trainees) {
        const attendance = await Attendance.countDocuments({ trainee, courseSlot: slot.slotId });
        if (!attendance) {
          attendancesPromises.push(AttendanceHelper.create({ trainee, courseSlot: slot.slotId }, credentials));
        }
      }
    }
  }
  const results = await Promise.all(promises);
  await Promise.all(attendancesPromises);
  if (Object.keys(formationExpoTokens).length) {
    for (const result of results) {
      const tokens = payload.date
        ? Object.values(formationExpoTokens).flat()
        : formationExpoTokens[result.trainee] || [];
      await NotificationHelper.sendAttendanceSheetSignatureRequestNotification(result._id, payload.trainer, tokens);
    }
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

  return attendanceSheets.map(as => ({
    ...as,
    ...as.slots && { slots: as.slots.map(s => ({ ...omit(s, 'slotId'), ...s.slotId })) },
  }));
};

exports.update = async (attendanceSheetId, payload) =>
  AttendanceSheet.updateOne({ _id: attendanceSheetId }, { $set: { slots: payload.slots.map(s => ({ slotId: s })) } });

exports.sign = async (attendanceSheetId, payload, credentials) => {
  const attendanceSheet = await AttendanceSheet
    .findOne({ _id: attendanceSheetId })
    .populate({ path: 'course', select: 'type' })
    .lean();

  let traineeSignature = '';
  const slotWithTraineeSignature = attendanceSheet.slots
    .find(s => (s.traineesSignature || [])
      .find(signature => UtilsHelper.areObjectIdsEquals(signature.traineeId, credentials._id) && !!signature.signature)
    );
  if (slotWithTraineeSignature) {
    traineeSignature = slotWithTraineeSignature.traineesSignature
      .find(signature => UtilsHelper.areObjectIdsEquals(signature.traineeId, credentials._id) && !!signature.signature)
      .signature;
  } else {
    const signature = await GCloudStorageHelper.uploadCourseFile({
      fileName: `trainee_signature_${credentials._id}`,
      file: payload.signature,
    });
    traineeSignature = signature.link;
  }

  const slots = attendanceSheet.slots.map((s) => {
    const noSignatureForTrainee = !(s.traineesSignature || [])
      .find(signature => UtilsHelper.areObjectIdsEquals(signature.traineeId, credentials._id));
    if (s.trainerSignature && noSignatureForTrainee) {
      return {
        ...s,
        traineesSignature: [
          ...(s.traineesSignature || []),
          { traineeId: credentials._id, signature: traineeSignature },
        ],
      };
    }
    return s;
  });

  if ([SINGLE, INTER_B2B].includes(attendanceSheet.course.type)) {
    return AttendanceSheet.updateOne({ _id: attendanceSheetId }, { $set: { slots } });
  }

  return AttendanceSheet.updateOne(
    {
      _id: attendanceSheetId,
      'slots.traineesSignature': { $elemMatch: { traineeId: credentials._id, signature: { $exists: false } } },
    },
    { $set: { 'slots.$[slot].traineesSignature.$[trainee].signature': traineeSignature } },
    {
      arrayFilters: [
        { 'slot.trainerSignature': { $exists: true } },
        { 'trainee.traineeId': credentials._id, 'trainee.signature': { $exists: false } },
      ],
    }
  );
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
      select: 'type misc companies subProgram slots trainees',
      populate: [
        { path: 'companies', select: 'name' },
        {
          path: 'trainees',
          select: 'identity',
          populate: { path: 'company', populate: { path: 'company', select: ' name' } },
        },
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
        { path: 'slots', select: 'step startDate endDate address' },
      ],
    })
    .lean();

  const formattedCourse = {
    ...attendanceSheet.course,
    slots: attendanceSheet.course.type === INTER_B2B
      ? attendanceSheet.course.slots
      : attendanceSheet.slots.map(s => s.slotId),
    ...attendanceSheet.trainee && { trainees: [attendanceSheet.trainee] },
    trainers: [attendanceSheet.trainer],
  };
  let pdf;
  let fileName;
  const signedSlots = attendanceSheet.slots.map(s => ({ slotId: s.slotId._id, ...omit(s, 'slotId') }));

  if ([INTER_B2B, SINGLE].includes(attendanceSheet.course.type)) {
    const formattedCourseForInter = await CoursesHelper.formatInterCourseForPdf(formattedCourse);
    pdf = await InterAttendanceSheet.getPdf({ ...formattedCourseForInter, signedSlots });
    const slotsDates = [...new Set(formattedCourseForInter.trainees[0].course.slots.map(slot => slot.date))].join(', ');
    fileName = `emargements_${formattedCourseForInter.trainees[0].traineeName}_${slotsDates}`
      .replaceAll(/ - | |'/g, '_');
  } else {
    if (formattedCourse.type === INTRA_HOLDING) {
      formattedCourse.companies = formattedCourse.companies
        .filter(c => UtilsHelper.doesArrayIncludeId(attendanceSheet.companies, c._id));
    }
    const formattedCourseForIntra = await CoursesHelper.formatIntraCourseForPdf(formattedCourse);
    const traineesWithSignature = signedSlots.flatMap(s => s.traineesSignature.map(t => t.traineeId));
    const trainees = attendanceSheet.course.trainees
      .filter(t => UtilsHelper.doesArrayIncludeId(traineesWithSignature, t._id));
    pdf = await IntraAttendanceSheet.getPdf({ ...formattedCourseForIntra, signedSlots, trainees });
    fileName = `emargements_${formattedCourseForIntra.dates[0].date}`;
  }
  const fileUploaded = await GCloudStorageHelper
    .uploadCourseFile({ fileName, file: pdf, contentType: 'application/pdf' });

  await AttendanceSheet.updateOne({ _id: attendanceSheetId }, { $set: { file: fileUploaded } });
};

exports.delete = async (attendanceSheetId, shouldDeleteAttendances) => {
  const attendanceSheet = await AttendanceSheet.findOne({ _id: attendanceSheetId }).lean();

  await AttendanceSheet.deleteOne({ _id: attendanceSheet._id });

  if (attendanceSheet.slots) {
    const promises = [];
    const { slots } = attendanceSheet;
    const signatures = [];
    const traineesIds = [];
    if (attendanceSheet.trainee && shouldDeleteAttendances) traineesIds.push(attendanceSheet.trainee);
    for (const slot of slots) {
      if (slot.trainerSignature) signatures.push(slot.trainerSignature.signature);
      if (slot.traineesSignature) {
        signatures.push(...slot.traineesSignature.filter(s => s.signature).map(s => s.signature));
      }
      if (!traineesIds.length && shouldDeleteAttendances) {
        traineesIds.push(...slot.traineesSignature.map(signature => signature.traineeId));
      }
    }

    if (shouldDeleteAttendances) {
      promises.push(
        Attendance.deleteMany({ courseSlot: { $in: slots.map(s => s.slotId) }, trainee: { $in: traineesIds } })
      );
    }
    for (const signature of [...new Set(signatures)]) {
      promises.push(GCloudStorageHelper.deleteCourseFile(signature.split('/').pop()));
    }

    await Promise.all(promises);
  }

  if (attendanceSheet.file) await GCloudStorageHelper.deleteCourseFile(attendanceSheet.file.publicId);
};
