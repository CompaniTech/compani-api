const Boom = require('@hapi/boom');
const SubProgram = require('../../models/SubProgram');
const StudyTrack = require('../../models/StudyTrack');
const { PUBLISHED, E_LEARNING } = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.authorizeStudyTrackCreation = async (req) => {
  const { name, subProgram: subProgramId, detailsPerStep, eLearningDurations, milestones } = req.payload;

  const subProgram = await SubProgram.findOne({ _id: subProgramId }).populate({ path: 'steps', select: 'type' }).lean();
  if (!subProgram) throw Boom.notFound();
  if (subProgram.status !== PUBLISHED) throw Boom.forbidden();

  if (name) {
    const nameAlreadyExists = await StudyTrack
      .countDocuments({ name, subProgram: subProgramId }, { limit: 1 })
      .collation({ locale: 'fr', strength: 1 });
    if (nameAlreadyExists) throw Boom.conflict(translate[language].studyTrackNameAlreadyExists);
  }

  const defaultAlreadyExists = await StudyTrack
    .countDocuments({ subProgram: subProgramId, isDefault: true }, { limit: 1 });
  if (defaultAlreadyExists) throw Boom.conflict(translate[language].defaultStudyTrackAlreadyExists);

  const stepIds = (detailsPerStep || []).map(detail => detail.step);
  const nonELearningStepIds = subProgram.steps.filter(step => step.type !== E_LEARNING).map(step => step._id);
  const hasSameSteps = stepIds.length === nonELearningStepIds.length &&
    nonELearningStepIds.every(stepId => UtilsHelper.doesArrayIncludeId(stepIds, stepId));
  if (!hasSameSteps) throw Boom.forbidden(translate[language].studyTrackInconsistentSteps);

  const hasELearningStep = subProgram.steps.some(step => step.type === E_LEARNING);
  if (hasELearningStep !== !!eLearningDurations) {
    throw Boom.forbidden(translate[language].studyTrackInconsistentELearning);
  }

  const monthsCounts = [
    ...(detailsPerStep || []).map(detail => detail.durations.length),
    ...(eLearningDurations ? [eLearningDurations.length] : []),
  ];
  if (new Set(monthsCounts).size > 1) throw Boom.badRequest(translate[language].studyTrackInconsistentDurations);

  const hasEmptyDurations = (detailsPerStep || []).some(detail => !detail.durations.some(duration => duration > 0)) ||
    (eLearningDurations && !eLearningDurations.some(duration => duration > 0));
  if (hasEmptyDurations) throw Boom.badRequest(translate[language].studyTrackEmptyDurations);

  if ((milestones || []).some(milestone => milestone.month >= monthsCounts[0])) {
    throw Boom.badRequest(translate[language].studyTrackMilestoneMonthTooHigh);
  }

  return null;
};
