const flat = require('flat');
const { get } = require('lodash');
const has = require('lodash/has');
const isEmpty = require('lodash/isEmpty');
const omit = require('lodash/omit');
const Course = require('../models/Course');
const Program = require('../models/Program');
const User = require('../models/User');
const GCloudStorageHelper = require('./gCloudStorage');
const UsersHelper = require('./users');
const UtilsHelper = require('./utils');
const SubProgramHelper = require('./subPrograms');
const { STRICTLY_E_LEARNING, WEBAPP } = require('./constants');

exports.createProgram = async payload => Program.create(payload);

exports.list = async query => Program.find(UtilsHelper.formatQueryWithArchive(query))
  .populate({
    path: 'subPrograms',
    match: { archivedAt: { $exists: false } },
    populate: { path: 'steps', select: 'type' },
  })
  .lean({ virtuals: true });

exports.listELearning = async (credentials, query) => {
  const eLearningCourse = await Course
    .find(
      { format: STRICTLY_E_LEARNING, $or: [{ accessRules: [] }, { accessRules: get(credentials, 'company._id') }] },
      'subProgram'
    )
    .lean();
  const subPrograms = eLearningCourse.map(course => course.subProgram);

  return Program.find({ ...UtilsHelper.formatQueryWithArchive(query), subPrograms: { $in: subPrograms } })
    .populate({
      path: 'subPrograms',
      select: 'name',
      match: { _id: { $in: subPrograms } },
      populate: [
        { path: 'courses', select: '_id trainees', match: { format: STRICTLY_E_LEARNING } },
        {
          path: 'steps',
          select: 'activities theoreticalDuration',
          populate: {
            path: 'activities',
            select: 'activityHistories',
            populate: { path: 'activityHistories', match: { user: credentials._id } },
          },
        },
      ],
    })
    .populate('categories')
    .lean();
};

exports.getProgram = async (programId) => {
  const program = await Program.findOne({ _id: programId })
    .populate({
      path: 'subPrograms',
      populate: [
        {
          path: 'steps',
          populate: [
            { path: 'activities', populate: 'cards' },
            {
              path: 'subPrograms',
              match: { archivedAt: { $exists: false } },
              select: 'name -steps',
              populate: { path: 'program', select: 'name -subPrograms' },
            },
          ],
        },
        { path: 'courses', select: 'tradeName' },
      ],
    })
    .populate({ path: 'testers', select: 'identity.firstname identity.lastname local.email contact' })
    .populate('categories')
    .lean({ virtuals: true });

  return {
    ...program,
    subPrograms: program.subPrograms.map(sp => ({
      ...sp,
      steps: sp.steps.map(st => ({
        ...st,
        activities: st.activities.map(act => ({ ...act, cards: act.cards.map(c => c._id) })),
      })),
    })),
  };
};

exports.updateProgram = async (programId, payload) => {
  const unarchiveProgram = has(payload, 'archivedAt') && payload.archivedAt === '';
  const setFields = unarchiveProgram ? omit(payload, 'archivedAt') : payload;

  const formattedPayload = {
    ...(!isEmpty(setFields) && { $set: setFields }),
    ...(unarchiveProgram && { $unset: { archivedAt: '' } }),
  };

  if (!has(payload, 'archivedAt')) {
    await Program.updateOne({ _id: programId }, formattedPayload);
    return;
  }

  const program = await Program
    .findOneAndUpdate({ _id: programId }, formattedPayload, { projection: { subPrograms: 1, archivedAt: 1 } })
    .lean();
  await SubProgramHelper.archiveSubPrograms(program.subPrograms, payload.archivedAt, program.archivedAt);
};

exports.uploadImage = async (programId, payload) => {
  const imageUploaded = await GCloudStorageHelper.uploadProgramMedia(payload);

  await Program.updateOne({ _id: programId }, { $set: flat({ image: imageUploaded }) });
};

exports.deleteImage = async (programId, publicId) => {
  if (!publicId) return;

  await Program.updateOne({ _id: programId }, { $unset: { image: '' } });
  await GCloudStorageHelper.deleteProgramMedia(publicId);
};

exports.addCategory = async (programId, payload) =>
  Program.updateOne({ _id: programId }, { $push: { categories: payload.categoryId } });

exports.removeCategory = async (programId, categoryId) =>
  Program.updateOne({ _id: programId }, { $pull: { categories: categoryId } });

exports.addTester = async (programId, payload) => {
  const user = await User.findOne({ 'local.email': payload.local.email }).lean();
  const addedTester = user || await UsersHelper.createUser({ ...payload, origin: WEBAPP });

  return Program.findOneAndUpdate({ _id: programId }, { $addToSet: { testers: addedTester._id } }, { new: true })
    .lean();
};

exports.removeTester = async (programId, testerId) =>
  Program.updateOne({ _id: programId }, { $pull: { testers: testerId } });

exports.addTradeName = async (programId, payload) =>
  Program.updateOne({ _id: programId }, { $push: { tradeNames: { name: payload.tradeName } } });

exports.removeTradeName = async (programId, tradeNameId) =>
  Program.updateOne({ _id: programId }, { $pull: { tradeNames: { _id: tradeNameId } } });
