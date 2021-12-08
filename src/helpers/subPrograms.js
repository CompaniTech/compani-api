const Program = require('../models/Program');
const SubProgram = require('../models/SubProgram');
const Step = require('../models/Step');
const Activity = require('../models/Activity');
const Course = require('../models/Course');
const { INTER_B2C, STRICTLY_E_LEARNING, DRAFT } = require('./constants');
const NotificationHelper = require('./notifications');

exports.addSubProgram = async (programId, payload) => {
  const subProgram = await SubProgram.create(payload);
  await Program.updateOne({ _id: programId }, { $push: { subPrograms: subProgram._id } });
};

exports.updateSubProgram = async (subProgramId, payload) => {
  if (!payload.status) return SubProgram.updateOne({ _id: subProgramId }, { $set: payload });

  const subProgram = await SubProgram
    .findOneAndUpdate({ _id: subProgramId }, { $set: { status: payload.status } })
    .populate({ path: 'steps', select: 'activities type' })
    .lean({ virtuals: true });

  if (subProgram.isStrictlyELearning) {
    const course = await Course.create({
      subProgram: subProgramId,
      type: INTER_B2C,
      format: STRICTLY_E_LEARNING,
      accessRules: payload.accessCompany ? [payload.accessCompany] : [],
    });
    if (!payload.accessCompany) NotificationHelper.sendNewElearningCourseNotification(course._id);
  }

  await Step.updateMany({ _id: { $in: subProgram.steps.map(step => step._id) } }, { status: payload.status });
  const activities = subProgram.steps.map(step => step.activities).flat();
  return Activity.updateMany({ _id: { $in: activities } }, { status: payload.status });
};

exports.listELearningDraft = async (testerRestrictedPrograms) => {
  let query = { path: 'program', select: '_id name description image' };
  if (testerRestrictedPrograms) query = { ...query, match: { _id: { $in: testerRestrictedPrograms } } };

  const subPrograms = await SubProgram.find({ status: DRAFT })
    .populate(query)
    .populate({ path: 'steps', select: 'type' })
    .lean({ virtuals: true });

  return subPrograms.filter(sp => sp.steps.length && sp.isStrictlyELearning && sp.program);
};

exports.getSubProgram = async subProgramId => SubProgram
  .findOne({ _id: subProgramId })
  .populate({ path: 'program', select: 'name image' })
  .populate({ path: 'steps', populate: { path: 'activities' } })
  .lean({ virtuals: true });

exports.reuseStep = async (subProgramId, payload) =>
  SubProgram.updateOne({ _id: subProgramId }, { $push: { steps: payload.steps } });
