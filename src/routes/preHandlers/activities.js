const Boom = require('@hapi/boom');
const Activity = require('../../models/Activity');
const Card = require('../../models/Card');
const { PUBLISHED } = require('../../helpers/constants');

const everySubProgramIsArchived = (steps) => {
  const subPrograms = steps.map(step => step.subPrograms).flat();
  return subPrograms.length && subPrograms.every(sp => sp.archivedAt);
};

exports.authorizeActivityUpdate = async (req) => {
  const activity = await Activity.findOne({ _id: req.params._id })
    .populate({ path: 'steps', select: 'subPrograms', populate: { path: 'subPrograms', select: 'archivedAt' } })
    .lean();
  if (!activity) throw Boom.notFound();
  if (activity.status === PUBLISHED && Object.keys(req.payload).some(key => key !== 'name')) throw Boom.forbidden();
  if (everySubProgramIsArchived(activity.steps)) throw Boom.forbidden();

  const { cards } = req.payload;
  if (cards) {
    const lengthAreEquals = activity.cards.length === cards.length;
    const dbCardsAreInPayload = activity.cards.every(value => cards.includes(value.toHexString()));
    const payloadCardsAreInDb = cards.every(value => activity.cards.map(s => s.toHexString()).includes(value));
    if (!lengthAreEquals || !payloadCardsAreInDb || !dbCardsAreInPayload) return Boom.badRequest();
  }

  return null;
};

exports.authorizeCardAddition = async (req) => {
  const activity = await Activity.findOne({ _id: req.params._id }, { status: 1, steps: 1 })
    .populate({ path: 'steps', select: 'subPrograms', populate: { path: 'subPrograms', select: 'archivedAt' } })
    .lean();
  if (!activity) throw Boom.notFound();
  if (activity.status === PUBLISHED) throw Boom.forbidden();
  if (everySubProgramIsArchived(activity.steps)) throw Boom.forbidden();

  return null;
};

exports.authorizeCardDeletion = async (req) => {
  const card = await Card.countDocuments({ _id: req.params.cardId });
  if (!card) throw Boom.notFound();

  const activities = await Activity.find({ cards: req.params.cardId }, { status: 1, steps: 1 })
    .populate({ path: 'steps', select: 'subPrograms', populate: { path: 'subPrograms', select: 'archivedAt' } })
    .lean();
  if (activities.some(activity => activity.status === PUBLISHED)) throw Boom.forbidden();
  if (activities.some(activity => everySubProgramIsArchived(activity.steps))) throw Boom.forbidden();

  return null;
};
