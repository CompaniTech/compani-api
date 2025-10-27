const get = require('lodash/get');
const omit = require('lodash/omit');
const keyBy = require('lodash/keyBy');
const mapValues = require('lodash/mapValues');
const GCloudStorageHelper = require('./gCloudStorage');
const UtilsHelper = require('./utils');
const StepsHelper = require('./steps');
const CourseSlotsHelper = require('./courseSlots');
const { E_LEARNING, SHORT_DURATION_H_MM, COURSE, TRAINEE, INTER_B2B } = require('./constants');
const { CompaniDuration } = require('./dates/companiDurations');
const Course = require('../models/Course');
const TrainingContract = require('../models/TrainingContract');
const CourseHistoriesHelper = require('./courseHistories');

exports.create = async (payload) => {
  const course = await Course
    .findOne({ _id: payload.course }, { companies: 1, subProgram: 1 })
    .populate([
      { path: 'companies', select: 'name' },
      { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
    ])
    .lean();

  const programName = course.subProgram.program.name;
  const companyName = course.companies.find(c => UtilsHelper.areObjectIdsEquals(c._id, payload.company)).name;

  const fileName = `convention_${programName}_${companyName}`;
  const fileUploaded = await GCloudStorageHelper.uploadCourseFile({
    fileName,
    file: payload.file,
  });

  await TrainingContract.create({ ...omit(payload, 'file'), file: fileUploaded });
};

exports.list = async (query, credentials) => {
  const { course, company, holding } = query;
  const isVendorUser = !!get(credentials, 'role.vendor');
  const companies = [];
  if (holding) companies.push(...credentials.holding.companies);
  if (company) companies.push(query.company);

  return TrainingContract
    .find({ course, ...(companies.length && { company: { $in: companies } }) })
    .setOptions({ isVendorUser })
    .lean();
};

exports.delete = async trainingContractId => exports.deleteMany([trainingContractId]);

exports.deleteMany = async (trainingContractIdList) => {
  const trainingContracts = await TrainingContract.find({ _id: { $in: trainingContractIdList } }).lean();

  await TrainingContract.deleteMany({ _id: { $in: trainingContractIdList } });

  return Promise.all([trainingContracts.map(tc => GCloudStorageHelper.deleteCourseFile(tc.file.publicId))]);
};

const computeElearnigDuration = (steps) => {
  if (!steps.some(step => step.type === E_LEARNING)) return '';

  return steps
    .filter(step => step.type === E_LEARNING)
    .reduce((acc, step) => acc.add(step.theoreticalDuration), CompaniDuration())
    .format(SHORT_DURATION_H_MM);
};

// make sure code is similar to front part in TrainingContractInfoModal
exports.formatCourseForTrainingContract = async (course, vendorCompany, price) => {
  const { companies, subProgram, slots, slotsToPlan, trainers } = course;
  const trainersName = trainers.map(trainer => UtilsHelper.formatIdentity(trainer.identity, 'FL'));

  const traineesIds = course.trainees.map(t => t._id);
  const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper
    .getCompanyAtCourseRegistrationList({ key: COURSE, value: course._id }, { key: TRAINEE, value: traineesIds });

  const traineesCompany = mapValues(keyBy(traineesCompanyAtCourseRegistration, 'trainee'), 'company');
  const trainees = course.trainees
    .filter(t => UtilsHelper.areObjectIdsEquals(course.companies[0]._id, traineesCompany[t._id]));

  return {
    type: course.type,
    vendorCompany,
    company: { name: companies[0].name, address: companies[0].address.fullAddress },
    programName: subProgram.program.name,
    learningGoals: subProgram.program.learningGoals,
    slotsCount: slots.length + slotsToPlan.length,
    liveDuration: StepsHelper.computeLiveDuration(slots, slotsToPlan, subProgram.steps),
    eLearningDuration: computeElearnigDuration(subProgram.steps),
    misc: course.misc,
    learnersCount: course.type !== INTER_B2B ? course.maxTrainees : trainees.length,
    learnersName: trainees.map(t => UtilsHelper.formatIdentity(t.identity, 'FL')).join(', '),
    dates: CourseSlotsHelper.formatSlotDates(slots),
    addressList: CourseSlotsHelper.getAddressList(slots, subProgram.steps),
    trainers: trainersName,
    price,
  };
};
