const pick = require('lodash/pick');
const get = require('lodash/get');
const { ObjectId } = require('mongodb');
const Activity = require('../models/Activity');
const Step = require('../models/Step');
const Card = require('../models/Card');
const CardHelper = require('./cards');

exports.getActivity = async activityId => Activity.findOne({ _id: activityId })
  .populate({ path: 'cards', select: '-__v -createdAt -updatedAt' })
  .populate({
    path: 'steps',
    select: '_id -activities',
    populate: {
      path: 'subPrograms',
      match: { archivedAt: { $exists: false } },
      select: '_id -steps',
      populate: { path: 'program', select: 'name -subPrograms' },
    },
  })
  .lean({ virtuals: true });

exports.updateActivity = async (activityId, payload) => Activity.updateOne({ _id: activityId }, { $set: payload });

exports.addActivity = async (stepId, payload) => {
  let newActivity;
  if (payload.activityId) {
    const duplicatedActivity = await exports.getActivity(payload.activityId);

    const duplicatedCards = duplicatedActivity.cards.map(c => ({ ...c, _id: new ObjectId() }));
    await Card.insertMany(duplicatedCards);

    newActivity = { ...pick(duplicatedActivity, ['name', 'type']), cards: duplicatedCards.map(c => c._id) };
  } else newActivity = payload;

  const createdActivity = await Activity.create(newActivity);
  await Step.updateOne({ _id: stepId }, { $push: { activities: createdActivity._id } });
};

exports.detachActivity = async (stepId, activityId) =>
  Step.updateOne({ _id: stepId }, { $pull: { activities: activityId } });

exports.addCard = async (activityId, payload) => {
  const card = await CardHelper.createCard(payload);
  await Activity.updateOne({ _id: activityId }, { $push: { cards: card._id } });
};

exports.removeCard = async (cardId) => {
  const card = await Card.findOneAndDelete({ _id: cardId }, { 'media.publicId': 1 }).lean();
  await Activity.updateOne({ cards: cardId }, { $pull: { cards: cardId } });
  if (get(card, 'media.publicId')) await CardHelper.deleteMedia(cardId, card.media.publicId);
};
