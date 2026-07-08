const get = require('lodash/get');
const GCloudStorageHelper = require('./gCloudStorage');
const UtilsHelper = require('./utils');
const CourseSlotsHelper = require('./courseSlots');
const StepsHelper = require('./steps');
const CourseHelper = require('./courses');
const { GENERATION, UPLOAD, TRAINER } = require('./constants');
const Course = require('../models/Course');
const CourseBillingItem = require('../models/CourseBillingItem');
const TrainerMission = require('../models/TrainerMission');
const TrainerMissionPdf = require('../data/pdf/trainerMission');

const getFileName = (programName, trainerIdentity) =>
  `ordre mission ${programName} ${UtilsHelper.formatIdentity(trainerIdentity, 'FL')}`;

const uploadDocument = async (payload, course, file, method, credentials, trainerIdentity) => {
  const fileName = getFileName(course.subProgram.program.name, trainerIdentity);
  const fileUploaded = await GCloudStorageHelper
    .uploadCourseFile({ fileName, file, ...(method === GENERATION && { contentType: 'application/pdf' }) });

  const courses = Array.isArray(payload.courses) ? payload.courses : [payload.courses];
  const fee = courses.reduce((acc, c) => acc + (c.fee || 0), 0);
  const courseIds = courses.map(c => c.courseId);

  await TrainerMission.create({
    ...payload,
    courses: courseIds,
    fee,
    file: fileUploaded,
    createdBy: credentials._id,
    creationMethod: method,
  });

  const coursesWithFee = courses.filter(c => c.fee);
  if (coursesWithFee.length) {
    const billingItem = await CourseBillingItem.findOne({ type: TRAINER }, { _id: 1 }).lean();

    await Promise.all(coursesWithFee.map(c => CourseHelper.addBillingPurchase(
      c.courseId,
      { billingItem: billingItem._id, price: c.fee, count: 1 }
    )));
  }
};
exports.upload = async (payload, credentials) => {
  const courseId = Array.isArray(payload.courses) ? payload.courses[0].courseId : payload.courses.courseId;
  const course = await Course
    .findOne({ _id: courseId }, { trainers: 1, subProgram: 1 })
    .populate([
      { path: 'trainers', select: 'identity' },
      { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
    ])
    .lean();
  const trainer = course.trainers.find(t => UtilsHelper.areObjectIdsEquals(t._id, payload.trainer));

  return uploadDocument(payload, course, payload.file, UPLOAD, credentials, trainer.identity);
};

exports.list = async (query) => {
  const { trainer } = query;

  return TrainerMission
    .find({ trainer })
    .populate({
      path: 'courses',
      select: 'misc type companies subProgram tradeName',
      populate: [
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
        { path: 'companies', select: 'name' },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();
};

const formatData = (courses, fee, credentials, trainerIdentity) => {
  const { subProgram, slots, slotsToPlan } = courses[0];

  return {
    trainerIdentity,
    program: subProgram.program.name,
    slotsCount: slots.length + slotsToPlan.length,
    liveDuration: StepsHelper.computeLiveDuration(slots, slotsToPlan, subProgram.steps),
    groupCount: courses.length,
    companies: [...new Set(courses.map(c => UtilsHelper.formatName(c.companies)))].join(', '),
    addressList: CourseSlotsHelper.getAddressList(courses.map(c => c.slots).flat(), subProgram.steps),
    dates: CourseSlotsHelper.formatSlotDates(courses.map(c => c.slots).flat()),
    slotsToPlan: courses.reduce((acc, course) => acc + course.slotsToPlan.length, 0),
    certification: courses.filter(c => c.hasCertifyingTest),
    fee,
    createdBy: UtilsHelper.formatIdentity(credentials.identity, 'FL'),
  };
};

exports.generate = async (payload, credentials) => {
  const payloadCourses = Array.isArray(payload.courses) ? payload.courses : [payload.courses];
  const courseIds = payloadCourses.map(c => c.courseId);
  const fee = payloadCourses.reduce((acc, c) => acc + (c.fee || 0), 0);
  const courses = await Course
    .find({ _id: { $in: courseIds } }, { hasCertifyingTest: 1, misc: 1, type: 1, tradeName: 1 })
    .populate({ path: 'companies', select: 'name' })
    .populate({ path: 'trainers', select: 'identity' })
    .populate({
      path: 'subProgram',
      select: 'program steps',
      populate: [{ path: 'program', select: 'name' }, { path: 'steps', select: 'theoreticalDuration type' }],
    })
    .populate({ path: 'slots', select: 'startDate endDate address' })
    .populate({ path: 'slotsToPlan', select: '_id' })
    .lean();

  const trainer = get(courses[0], 'trainers', []).find(t => UtilsHelper.areObjectIdsEquals(t._id, payload.trainer));

  const data = formatData(courses, fee, credentials, trainer.identity);

  const pdf = await TrainerMissionPdf.getPdf(data);

  return uploadDocument(payload, courses[0], pdf, GENERATION, credentials, trainer.identity);
};

exports.update = async (trainerMissionId, payload) => {
  const trainerMission = await TrainerMission.findOne({ _id: trainerMissionId }, { courses: 1 }).lean();
  const billingItem = await CourseBillingItem.findOne({ type: TRAINER }, { _id: 1 }).lean();

  const promises = [TrainerMission.updateOne({ _id: trainerMissionId }, { $set: payload })];
  if (billingItem) {
    promises.push(Course.updateMany(
      { _id: { $in: trainerMission.courses } },
      { $pull: { billingPurchaseList: { billingItem: billingItem._id } } }
    ));
  }

  await Promise.all(promises);
};
