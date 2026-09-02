const Boom = require('@hapi/boom');
const Step = require('../../models/Step');
const Activity = require('../../models/Activity');
const Program = require('../../models/Program');
const { PUBLISHED, E_LEARNING } = require('../../helpers/constants');

const everySubProgramIsArchived = subPrograms => subPrograms.length && subPrograms.every(sp => sp.archivedAt);

exports.authorizeStepUpdate = async (req) => {
  const step = await Step.findOne({ _id: req.params._id }, { activities: 1, status: 1 })
    .populate({ path: 'subPrograms', select: 'archivedAt' })
    .lean();
  if (!step) throw Boom.notFound();
  if (step.status === PUBLISHED &&
    Object.keys(req.payload).some(key => !['name', 'theoreticalDuration'].includes(key))) {
    throw Boom.forbidden();
  }
  if (everySubProgramIsArchived(step.subPrograms)) throw Boom.forbidden();

  const { activities } = req.payload;
  if (activities) {
    const lengthAreEquals = step.activities.length === activities.length;
    const dbActivitiesAreInPayload = step.activities.every(value => activities.includes(value.toHexString()));
    if (!lengthAreEquals || !dbActivitiesAreInPayload) return Boom.badRequest();
  }

  return null;
};

exports.authorizeActivityAddition = async (req) => {
  const step = await Step.findOne({ _id: req.params._id }, { status: 1, type: 1 })
    .populate({ path: 'subPrograms', select: 'archivedAt' })
    .lean();
  if (!step) throw Boom.notFound();
  if (step.status === PUBLISHED || step.type !== E_LEARNING) throw Boom.forbidden();
  if (everySubProgramIsArchived(step.subPrograms)) throw Boom.forbidden();

  return null;
};

exports.authorizeActivityReuse = async (req) => {
  const step = await Step.findOne({ _id: req.params._id }, { activities: 1, status: 1, type: 1 })
    .populate({ path: 'subPrograms', select: 'archivedAt' })
    .lean();
  if (!step) throw Boom.notFound();

  const { activities } = req.payload;
  const existingActivity = await Activity.countDocuments({ _id: activities });
  if (!existingActivity) throw Boom.notFound();

  if (step.status === PUBLISHED || step.type !== E_LEARNING) throw Boom.forbidden();
  if (everySubProgramIsArchived(step.subPrograms)) throw Boom.forbidden();
  if (step.activities.map(a => a.toHexString()).includes(activities)) throw Boom.badRequest();

  return null;
};

exports.authorizeActivityDetachment = async (req) => {
  const step = await Step.findOne({ _id: req.params._id, activities: req.params.activityId }, { status: 1 })
    .populate({ path: 'subPrograms', select: 'archivedAt' })
    .lean();
  if (!step) throw Boom.notFound();
  if (step.status === PUBLISHED) throw Boom.forbidden();
  if (everySubProgramIsArchived(step.subPrograms)) throw Boom.forbidden();

  return null;
};

exports.authorizeGetStep = async (req) => {
  const program = await Program.countDocuments({ _id: req.query.program });
  if (!program) throw Boom.notFound();

  return null;
};
