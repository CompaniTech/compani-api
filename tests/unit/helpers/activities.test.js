const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Step = require('../../../src/models/Step');
const Card = require('../../../src/models/Card');
const Activity = require('../../../src/models/Activity');
const ActivityHelper = require('../../../src/helpers/activities');
const CardHelper = require('../../../src/helpers/cards');
const SinonMongoose = require('../sinonMongoose');

describe('getActivity', () => {
  let findOne;

  beforeEach(() => {
    findOne = sinon.stub(Activity, 'findOne');
  });
  afterEach(() => {
    findOne.restore();
  });

  it('should return the requested activity', async () => {
    findOne.returns(SinonMongoose.stubChainedQueries({ _id: 'skusku' }));

    const activity = { _id: new ObjectId() };

    const result = await ActivityHelper.getActivity(activity._id);

    const chainedPayload = [
      { query: 'findOne', args: [{ _id: activity._id }] },
      { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
      {
        query: 'populate',
        args: [{
          path: 'steps',
          select: '_id -activities',
          populate: {
            path: 'subPrograms',
            match: { archivedAt: { $exists: false } },
            select: '_id -steps',
            populate: { path: 'program', select: 'name -subPrograms' },
          },
        }],
      },
      { query: 'lean', args: [{ virtuals: true }] },
    ];

    SinonMongoose.calledOnceWithExactly(findOne, chainedPayload);
    expect(result).toMatchObject({ _id: 'skusku' });
  });
});

describe('updateActivity', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Activity, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should update an activity\'s name', async () => {
    const activity = { _id: new ObjectId(), name: 'faire du pedalo' };
    const payload = { name: 'faire dodo' };

    await ActivityHelper.updateActivity(activity._id, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: activity._id }, { $set: payload });
  });
});

describe('addActivity', () => {
  let create;
  let updateOne;
  let insertMany;
  let getActivity;
  beforeEach(() => {
    create = sinon.stub(Activity, 'create');
    updateOne = sinon.stub(Step, 'updateOne');
    insertMany = sinon.stub(Card, 'insertMany');
    getActivity = sinon.stub(ActivityHelper, 'getActivity');
  });
  afterEach(() => {
    create.restore();
    updateOne.restore();
    insertMany.restore();
    getActivity.restore();
  });

  it('should create an activity', async () => {
    const stepId = new ObjectId();
    const newActivity = { name: 'c\'est une activité !' };
    const createdActivityId = new ObjectId();
    create.returns({ _id: createdActivityId });

    await ActivityHelper.addActivity(stepId, newActivity);

    sinon.assert.calledOnceWithExactly(create, newActivity);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: stepId }, { $push: { activities: createdActivityId } });
    sinon.assert.notCalled(insertMany);
    sinon.assert.notCalled(getActivity);
  });

  it('should duplicate an activity', async () => {
    const stepId = new ObjectId();
    const activity = {
      _id: new ObjectId(),
      name: 'danser',
      type: 'quiz',
      cards: [
        { _id: new ObjectId(), template: 'transition', title: 'coucou' },
        { _id: new ObjectId(), template: 'title_text', title: 'ok' },
      ],
    };
    const newActivityId = new ObjectId();
    getActivity.returns(activity);
    create.returns({ _id: newActivityId });

    await ActivityHelper.addActivity(stepId, { activityId: activity._id });

    sinon.assert.calledOnceWithExactly(getActivity, activity._id);
    sinon.assert.calledOnceWithExactly(
      insertMany,
      [
        { _id: sinon.match(Object), template: 'transition', title: 'coucou' },
        { _id: sinon.match(Object), template: 'title_text', title: 'ok' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        name: activity.name,
        type: activity.type,
        cards: [sinon.match(Object), sinon.match(Object)],
      }
    );
    sinon.assert.calledOnceWithExactly(updateOne, { _id: stepId }, { $push: { activities: newActivityId } });
  });
});

describe('detachActivity', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Step, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should detach activity', async () => {
    const stepId = new ObjectId();
    const activityId = new ObjectId();

    await ActivityHelper.detachActivity(stepId, activityId);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: stepId }, { $pull: { activities: activityId } });
  });
});

describe('addCard', () => {
  let createCard;
  let updateOne;
  beforeEach(() => {
    createCard = sinon.stub(CardHelper, 'createCard');
    updateOne = sinon.stub(Activity, 'updateOne');
  });
  afterEach(() => {
    createCard.restore();
    updateOne.restore();
  });

  it('should add card to activity', async () => {
    const cardId = new ObjectId();
    const payload = { template: 'transition' };
    const activity = { _id: new ObjectId(), name: 'faire du jetski' };

    createCard.returns({ _id: cardId });

    await ActivityHelper.addCard(activity._id, payload);

    sinon.assert.calledOnceWithExactly(createCard, payload);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: activity._id }, { $push: { cards: cardId } });
  });
});

describe('removeCard', () => {
  let findOneAndDeleteCard;
  let updateOne;
  let deleteMedia;
  beforeEach(() => {
    findOneAndDeleteCard = sinon.stub(Card, 'findOneAndDelete');
    updateOne = sinon.stub(Activity, 'updateOne');
    deleteMedia = sinon.stub(CardHelper, 'deleteMedia');
  });
  afterEach(() => {
    findOneAndDeleteCard.restore();
    updateOne.restore();
    deleteMedia.restore();
  });

  it('should remove card without media from activity', async () => {
    const cardId = new ObjectId();

    findOneAndDeleteCard.returns(SinonMongoose.stubChainedQueries(null, ['lean']));

    await ActivityHelper.removeCard(cardId, null);

    sinon.assert.calledOnceWithExactly(updateOne, { cards: cardId }, { $pull: { cards: cardId } });
    sinon.assert.notCalled(deleteMedia);
    SinonMongoose.calledOnceWithExactly(
      findOneAndDeleteCard,
      [
        { query: 'findOneAndDelete', args: [{ _id: cardId }, { 'media.publicId': 1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should remove card with media from activity', async () => {
    const cardId = new ObjectId();
    const card = { _id: cardId, media: { publicId: 'publicId' } };

    findOneAndDeleteCard.returns(SinonMongoose.stubChainedQueries(card, ['lean']));

    await ActivityHelper.removeCard(cardId, 'media-test-20210505104400');

    sinon.assert.calledOnceWithExactly(updateOne, { cards: cardId }, { $pull: { cards: cardId } });
    sinon.assert.calledOnceWithExactly(deleteMedia, cardId, 'publicId');
    SinonMongoose.calledOnceWithExactly(
      findOneAndDeleteCard,
      [
        { query: 'findOneAndDelete', args: [{ _id: cardId }, { 'media.publicId': 1 }] },
        { query: 'lean' },
      ]
    );
  });
});
