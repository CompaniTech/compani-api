const Step = require('../models/Step');
const SubProgram = require('../models/SubProgram');
const moment = require('../extensions/moment');
const UtilsHelper = require('./utils');
const { E_LEARNING } = require('./constants');

exports.updateStep = async (stepId, payload) => Step.updateOne({ _id: stepId }, { $set: payload });

exports.addStep = async (subProgramId, payload) => {
  const step = await Step.create(payload);
  await SubProgram.updateOne({ _id: subProgramId }, { $push: { steps: step._id } });
};

exports.reuseActivity = async (stepId, payload) =>
  Step.updateOne({ _id: stepId }, { $push: { activities: payload.activities } });

exports.detachStep = async (subProgramId, stepId) =>
  SubProgram.updateOne({ _id: subProgramId }, { $pull: { steps: stepId } });

exports.elearningStepProgress = (step) => {
  const progress = step.activities.filter(activity => activity.activityHistories.length > 0).length;
  const maxProgress = step.activities.length;

  return maxProgress ? progress / maxProgress : 0;
};

exports.onSiteStepProgress = (slots) => {
  const nextSlots = slots.filter(slot => moment().isSameOrBefore(slot.endDate));

  return slots.length ? 1 - nextSlots.length / slots.length : 0;
};

exports.getProgress = (step, slots) => (step.type === E_LEARNING
  ? exports.elearningStepProgress(step)
  : exports.onSiteStepProgress(slots.filter(slot => UtilsHelper.areObjectIdsEquals(slot.step, step._id))));
