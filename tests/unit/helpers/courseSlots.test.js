const sinon = require('sinon');
const { expect } = require('expect');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const CourseSlot = require('../../../src/models/CourseSlot');
const Course = require('../../../src/models/Course');
const CourseSlotsHelper = require('../../../src/helpers/courseSlots');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
const SinonMongoose = require('../sinonMongoose');
const { REMOTE, ON_SITE } = require('../../../src/helpers/constants');

describe('hasConflicts', () => {
  let countDocuments;
  beforeEach(() => {
    countDocuments = sinon.stub(CourseSlot, 'countDocuments');
  });
  afterEach(() => {
    countDocuments.restore();
  });

  it('should return true if has conflicts', async () => {
    const slot = {
      _id: new ObjectId(),
      course: new ObjectId(),
      startDate: '2020-09-12T09:00:00',
      endDate: '2020-09-12T11:00:00',
      step: new ObjectId(),
    };
    countDocuments.returns(2);
    const result = await CourseSlotsHelper.hasConflicts(slot);

    expect(result).toBeTruthy();
    sinon.assert.calledWithExactly(
      countDocuments,
      {
        _id: { $ne: slot._id },
        course: slot.course,
        startDate: { $lt: '2020-09-12T11:00:00' },
        endDate: { $gt: '2020-09-12T09:00:00' },
      }
    );
  });

  it('should return false if no conflict', async () => {
    const slot = {
      course: new ObjectId(),
      startDate: '2020-09-12T09:00:00',
      endDate: '2020-09-12T11:00:00',
      step: new ObjectId(),
    };
    countDocuments.returns(0);
    const result = await CourseSlotsHelper.hasConflicts(slot);

    expect(result).toBeFalsy();
    sinon.assert.calledWithExactly(
      countDocuments,
      {
        course: slot.course,
        startDate: { $lt: '2020-09-12T11:00:00' },
        endDate: { $gt: '2020-09-12T09:00:00' },
      }
    );
  });
});

describe('createCourseSlot', () => {
  let insertMany;
  beforeEach(() => {
    insertMany = sinon.stub(CourseSlot, 'insertMany');
  });
  afterEach(() => {
    insertMany.restore();
  });

  it('should create multiple courses slots', async () => {
    const courseId = new ObjectId();
    const stepId = new ObjectId();
    const payload = { course: courseId, step: stepId, quantity: 3 };

    await CourseSlotsHelper.createCourseSlot(payload);

    sinon.assert.calledOnceWithExactly(
      insertMany,
      [{ course: courseId, step: stepId }, { course: courseId, step: stepId }, { course: courseId, step: stepId }]
    );
  });
});

describe('updateCourseSlot', () => {
  let updateOne;
  let hasConflicts;
  let createHistoryOnSlotEdition;
  let createHistoryOnSlotDeletion;
  let createHistoryOnSlotRestriction;
  let findOne;
  let courseFindOne;
  beforeEach(() => {
    updateOne = sinon.stub(CourseSlot, 'updateOne');
    findOne = sinon.stub(CourseSlot, 'findOne');
    courseFindOne = sinon.stub(Course, 'findOne');
    hasConflicts = sinon.stub(CourseSlotsHelper, 'hasConflicts');
    createHistoryOnSlotEdition = sinon.stub(CourseHistoriesHelper, 'createHistoryOnSlotEdition');
    createHistoryOnSlotDeletion = sinon.stub(CourseHistoriesHelper, 'createHistoryOnSlotDeletion');
    createHistoryOnSlotRestriction = sinon.stub(CourseHistoriesHelper, 'createHistoryOnSlotRestriction');
  });
  afterEach(() => {
    updateOne.restore();
    findOne.restore();
    courseFindOne.restore();
    hasConflicts.restore();
    createHistoryOnSlotEdition.restore();
    createHistoryOnSlotDeletion.restore();
    createHistoryOnSlotRestriction.restore();
  });

  it('should update a remote course slot with meetingLink', async () => {
    const slotId = new ObjectId();
    const slot = { _id: slotId, step: { _id: new ObjectId(), type: REMOTE } };
    const user = { _id: new ObjectId() };
    const payload = { startDate: '2020-03-03T22:00:00.000Z', meetingLink: 'https://github.com' };
    hasConflicts.returns(false);
    findOne.returns(SinonMongoose.stubChainedQueries(slot));

    await CourseSlotsHelper.updateCourseSlot(slotId, payload, user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotId }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.calledOnceWithExactly(hasConflicts, { ...slot, ...payload });
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotEdition, slot, payload, user._id);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $set: payload, $unset: { address: '' } }
    );
  });

  it('should update a remote course slot without meetingLink', async () => {
    const slotId = new ObjectId();
    const slot = { _id: slotId, step: { _id: new ObjectId(), type: REMOTE } };
    const user = { _id: new ObjectId() };
    const payload = { startDate: '2020-03-03T22:00:00.000Z' };
    hasConflicts.returns(false);
    findOne.returns(SinonMongoose.stubChainedQueries(slot));

    await CourseSlotsHelper.updateCourseSlot(slotId, payload, user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotId }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.calledOnceWithExactly(hasConflicts, { ...slot, ...payload });
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotEdition, slot, payload, user._id);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $set: payload, $unset: { meetingLink: '', address: '' } }
    );
  });

  it('should update an on site course slot with address', async () => {
    const slotId = new ObjectId();
    const slot = { _id: slotId, step: { _id: new ObjectId(), type: ON_SITE } };
    const user = { _id: new ObjectId() };
    const payload = { startDate: '2020-03-03T22:00:00.000Z', address: { fullAddress: '24 avenue Daumesnil' } };
    hasConflicts.returns(false);
    findOne.returns(SinonMongoose.stubChainedQueries(slot));

    await CourseSlotsHelper.updateCourseSlot(slotId, payload, user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotId }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.calledOnceWithExactly(hasConflicts, { ...slot, ...payload });
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotEdition, slot, payload, user._id);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $set: payload, $unset: { meetingLink: '' } }
    );
  });

  it('should update an on site course slot without address', async () => {
    const slotId = new ObjectId();
    const slot = { _id: slotId, step: { _id: new ObjectId(), type: ON_SITE } };
    const user = { _id: new ObjectId() };
    const payload = { startDate: '2020-03-03T22:00:00.000Z' };
    hasConflicts.returns(false);
    findOne.returns(SinonMongoose.stubChainedQueries(slot));

    await CourseSlotsHelper.updateCourseSlot(slotId, payload, user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotId }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.calledOnceWithExactly(hasConflicts, { ...slot, ...payload });
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotEdition, slot, payload, user._id);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $set: payload, $unset: { meetingLink: '', address: '' } }
    );
  });

  it('should remove dates', async () => {
    const slotId = new ObjectId();
    const slot = {
      _id: slotId,
      startDate: '2020-03-03T20:00:00.000Z',
      endDate: '2020-03-03T22:00:00.000Z',
      meetingLink: 'test.com',
    };
    const user = { _id: new ObjectId() };
    const payload = { startDate: '', endDate: '' };
    hasConflicts.returns(false);
    findOne.returns(SinonMongoose.stubChainedQueries(slot));

    await CourseSlotsHelper.updateCourseSlot(slotId, payload, user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotId }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(createHistoryOnSlotEdition);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.calledOnceWithExactly(hasConflicts, { ...slot, ...payload });
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotDeletion, omit(slot, '_id'), user._id);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $unset: { startDate: '', endDate: '', meetingLink: '', address: '' } }
    );
  });

  it('should add concerned trainees', async () => {
    const slotId = new ObjectId();
    const courseId = new ObjectId();
    const traineesIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const slot = {
      _id: slotId,
      startDate: '2020-03-03T20:00:00.000Z',
      endDate: '2020-03-03T22:00:00.000Z',
      trainees: [traineesIds[0], traineesIds[1]],
      course: courseId,
    };
    const course = { _id: courseId, trainees: traineesIds };
    const user = { _id: new ObjectId() };
    const payload = { trainees: [traineesIds[1], traineesIds[2]] };
    findOne.returns(SinonMongoose.stubChainedQueries(slot));
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['lean']));

    await CourseSlotsHelper.updateCourseSlot(slotId, payload, user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotId }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ]
    );

    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { trainees: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(createHistoryOnSlotEdition);
    sinon.assert.notCalled(hasConflicts);
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $set: { trainees: [traineesIds[1], traineesIds[2]] } }
    );
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotRestriction,
      { course: courseId, startDate: '2020-03-03T20:00:00.000Z', endDate: '2020-03-03T22:00:00.000Z' },
      user._id);
  });

  it('should remove concerned trainees', async () => {
    const slotId = new ObjectId();
    const courseId = new ObjectId();
    const traineesIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const slot = {
      _id: slotId,
      startDate: '2020-03-03T20:00:00.000Z',
      endDate: '2020-03-03T22:00:00.000Z',
      trainees: [traineesIds[0], traineesIds[1]],
      course: courseId,
    };
    const course = { _id: courseId, trainees: traineesIds };
    const user = { _id: new ObjectId() };
    const payload = { trainees: traineesIds };
    findOne.returns(SinonMongoose.stubChainedQueries(slot));
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['lean']));

    await CourseSlotsHelper.updateCourseSlot(slotId, payload, user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotId }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ]
    );

    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { trainees: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(createHistoryOnSlotEdition);
    sinon.assert.notCalled(hasConflicts);
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: slot._id }, { $unset: { trainees: '' } });
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotRestriction,
      { course: courseId, startDate: '2020-03-03T20:00:00.000Z', endDate: '2020-03-03T22:00:00.000Z' },
      user._id);
  });

  it('should throw an error if conflicts', async () => {
    const slotId = new ObjectId();
    const slot = { _id: slotId, step: { _id: new ObjectId() } };
    const payload = { startDate: '2020-03-03T22:00:00.000Z' };
    const user = { _id: new ObjectId() };
    hasConflicts.returns(true);
    findOne.returns(SinonMongoose.stubChainedQueries(slot));

    try {
      await CourseSlotsHelper.updateCourseSlot(slotId, payload, user);

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: slotId }] },
          { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
          { query: 'lean' },
        ]
      );
      sinon.assert.calledOnceWithExactly(hasConflicts, { ...slot, ...payload });
    } catch (e) {
      expect(e.output.statusCode).toEqual(409);
    } finally {
      sinon.assert.notCalled(updateOne);
      sinon.assert.notCalled(createHistoryOnSlotEdition);
    }
  });
});

describe('removeCourseSlot', () => {
  let deleteOne;
  beforeEach(() => {
    deleteOne = sinon.stub(CourseSlot, 'deleteOne');
  });
  afterEach(() => {
    deleteOne.restore();
  });

  it('should remove a course slot without dates', async () => {
    const courseSlotId = new ObjectId();

    await CourseSlotsHelper.removeCourseSlot(courseSlotId);

    sinon.assert.calledOnceWithExactly(deleteOne, { _id: courseSlotId });
  });
});
