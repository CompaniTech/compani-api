const { pick, get } = require('lodash');
const Step = require('../models/Step');
const SubProgram = require('../models/SubProgram');
const UtilsHelper = require('./utils');
const { E_LEARNING, PT0S, MINUTES } = require('./constants');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');

exports.updateStep = async (stepId, payload) => Step.updateOne({ _id: stepId }, { $set: payload });

exports.addStep = async (subProgramId, payload) => {
  const step = await Step.create(payload);
  await SubProgram.updateOne({ _id: subProgramId }, { $push: { steps: step._id } });
};

exports.reuseActivity = async (stepId, payload) =>
  Step.updateOne({ _id: stepId }, { $push: { activities: payload.activities } });

exports.detachStep = async (subProgramId, stepId) =>
  SubProgram.updateOne({ _id: subProgramId }, { $pull: { steps: stepId } });

exports.getElearningStepProgress = (step) => {
  const progress = step.activities.filter(activity => activity.activityHistories.length > 0).length;
  const maxProgress = step.activities.length;

  return maxProgress ? progress / maxProgress : 0;
};

exports.getLiveStepProgress = (slots) => {
  const nextSlots = slots.filter(slot => CompaniDate().isSameOrBefore(slot.endDate));
  const liveProgress = slots.length ? 1 - nextSlots.length / slots.length : 0;

  return liveProgress;
};

exports.getPresenceStepProgress = (slots) => {
  if (!slots.length) return { attendanceDuration: PT0S, maxDuration: PT0S };

  const slotsWithDuration = slots.map(s => ({ ...s, duration: CompaniDate(s.endDate).diff(s.startDate, MINUTES) }));

  const attendanceDuration = slotsWithDuration
    .filter(slot => slot.attendances.length)
    .reduce((acc, s) => acc.add(s.duration), CompaniDuration())
    .toISO();

  return {
    attendanceDuration,
    maxDuration: slotsWithDuration
      .reduce((acc, s) => acc.add(s.duration), CompaniDuration())
      .toISO(),
  };
};

exports.getProgress = (step, slots = []) => (step.type === E_LEARNING
  ? { eLearning: exports.getElearningStepProgress(step) }
  : {
    live: exports.getLiveStepProgress(slots),
    presence: exports.getPresenceStepProgress(slots),
  });

exports.list = async (programId) => {
  const steps = await Step.find()
    .populate({ path: 'subPrograms', select: 'program -steps', populate: { path: 'program', select: '_id' } })
    .lean();

  return steps
    .filter(step => step.subPrograms.some(subProgram =>
      UtilsHelper.areObjectIdsEquals(get(subProgram, 'program._id'), programId)))
    .map(step => pick(step, ['_id', 'name', 'type']));
};
