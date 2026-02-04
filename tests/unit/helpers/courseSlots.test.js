const sinon = require('sinon');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const CourseSlot = require('../../../src/models/CourseSlot');
const Course = require('../../../src/models/Course');
const CourseSlotsHelper = require('../../../src/helpers/courseSlots');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
const SinonMongoose = require('../sinonMongoose');
const { REMOTE, ON_SITE } = require('../../../src/helpers/constants');

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
  let create;
  let createHistoryOnSlotEdition;
  let createHistoryOnSlotCreation;
  let createHistoryOnSlotDeletion;
  let createHistoryOnSlotRestriction;
  let findOne;
  let courseFindOne;
  beforeEach(() => {
    updateOne = sinon.stub(CourseSlot, 'updateOne');
    create = sinon.stub(CourseSlot, 'create');
    findOne = sinon.stub(CourseSlot, 'findOne');
    courseFindOne = sinon.stub(Course, 'findOne');
    createHistoryOnSlotCreation = sinon.stub(CourseHistoriesHelper, 'createHistoryOnSlotCreation');
    createHistoryOnSlotEdition = sinon.stub(CourseHistoriesHelper, 'createHistoryOnSlotEdition');
    createHistoryOnSlotDeletion = sinon.stub(CourseHistoriesHelper, 'createHistoryOnSlotDeletion');
    createHistoryOnSlotRestriction = sinon.stub(CourseHistoriesHelper, 'createHistoryOnSlotRestriction');
  });
  afterEach(() => {
    updateOne.restore();
    create.restore();
    findOne.restore();
    courseFindOne.restore();
    createHistoryOnSlotCreation.restore();
    createHistoryOnSlotEdition.restore();
    createHistoryOnSlotDeletion.restore();
    createHistoryOnSlotRestriction.restore();
  });

  it('should update a remote course slot with meetingLink', async () => {
    const slotId = new ObjectId();
    const slot = { _id: slotId, step: { _id: new ObjectId(), type: REMOTE } };
    const user = { _id: new ObjectId() };
    const payload = { startDate: '2020-03-03T22:00:00.000Z', meetingLink: 'https://github.com' };

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
    sinon.assert.notCalled(createHistoryOnSlotCreation);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.notCalled(create);
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
    sinon.assert.notCalled(createHistoryOnSlotCreation);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.notCalled(create);
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
    sinon.assert.notCalled(createHistoryOnSlotCreation);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.notCalled(create);
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
    sinon.assert.notCalled(createHistoryOnSlotCreation);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.notCalled(create);
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotEdition, slot, payload, user._id);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $set: payload, $unset: { meetingLink: '', address: '' } }
    );
  });

  it('should update a course slot to whole day (use existing second slot)', async () => {
    const slotIds = [new ObjectId(), new ObjectId()];
    const courseId = new ObjectId();
    const slot = { _id: slotIds[0], step: { _id: new ObjectId(), type: ON_SITE }, course: courseId };
    const slotToPlan = { _id: slotIds[1], step: { _id: new ObjectId(), type: ON_SITE } };
    const user = { _id: new ObjectId() };
    const payload = {
      startDate: '2020-03-03T08:00:00.000Z',
      address: { fullAddress: '24 avenue Daumesnil' },
      endDate: '2020-03-03T11:30:00.000Z',
      wholeDay: true,
    };

    findOne.onCall(0).returns(SinonMongoose.stubChainedQueries(slot));
    findOne.onCall(1).returns(SinonMongoose.stubChainedQueries(slotToPlan, ['lean']));

    await CourseSlotsHelper.updateCourseSlot(slotIds[0], payload, user);

    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotIds[0] }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [{
            course: courseId,
            step: slot.step._id,
            startDate: { $exists: false },
            endDate: { $exists: false },
            _id: { $ne: slotIds[0] },
          }],
        },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.notCalled(create);
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotEdition, slot, payload, user._id);
    sinon.assert.calledOnceWithExactly(
      createHistoryOnSlotCreation,
      {
        course: courseId,
        step: slot.step,
        startDate: '2020-03-03T12:30:00.000Z',
        endDate: '2020-03-03T16:00:00.000Z',
        address: { fullAddress: '24 avenue Daumesnil' },
      },
      user._id
    );
    sinon.assert.calledWithExactly(
      updateOne.getCall(0),
      { _id: slot._id },
      { $set: omit(payload, 'wholeDay'), $unset: { meetingLink: '' } }
    );
    sinon.assert.calledWithExactly(
      updateOne.getCall(1),
      { _id: slotToPlan._id },
      {
        $set: {
          course: courseId,
          step: slot.step,
          startDate: '2020-03-03T12:30:00.000Z',
          endDate: '2020-03-03T16:00:00.000Z',
          address: { fullAddress: '24 avenue Daumesnil' },
        },
      }
    );
  });

  it('should update a course slot to whole day (create second slot)', async () => {
    const slotIds = [new ObjectId(), new ObjectId()];
    const courseId = new ObjectId();
    const trainees = [new ObjectId()];
    const slot = { _id: slotIds[0], step: { _id: new ObjectId(), type: ON_SITE }, course: courseId, trainees };
    const user = { _id: new ObjectId() };
    const payload = {
      startDate: '2020-03-03T08:00:00.000Z',
      address: { fullAddress: '24 avenue Daumesnil' },
      endDate: '2020-03-03T11:30:00.000Z',
      wholeDay: true,
    };

    findOne.onCall(0).returns(SinonMongoose.stubChainedQueries(slot));
    findOne.onCall(1).returns(SinonMongoose.stubChainedQueries(null, ['lean']));

    await CourseSlotsHelper.updateCourseSlot(slotIds[0], payload, user);

    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: slotIds[0] }] },
        { query: 'populate', args: [{ path: 'step', select: '_id type' }] },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [{
            course: courseId,
            step: slot.step._id,
            startDate: { $exists: false },
            endDate: { $exists: false },
            _id: { $ne: slotIds[0] },
          }],
        },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.notCalled(courseFindOne);
    sinon.assert.notCalled(createHistoryOnSlotRestriction);
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotEdition, slot, payload, user._id);
    sinon.assert.calledOnceWithExactly(
      createHistoryOnSlotCreation,
      {
        course: courseId,
        step: slot.step,
        startDate: '2020-03-03T12:30:00.000Z',
        endDate: '2020-03-03T16:00:00.000Z',
        address: { fullAddress: '24 avenue Daumesnil' },
        trainees,
      },
      user._id
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $set: omit(payload, 'wholeDay'), $unset: { meetingLink: '' } }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        course: courseId,
        step: slot.step,
        startDate: '2020-03-03T12:30:00.000Z',
        endDate: '2020-03-03T16:00:00.000Z',
        address: { fullAddress: '24 avenue Daumesnil' },
        trainees,
      }
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
    sinon.assert.notCalled(createHistoryOnSlotCreation);
    sinon.assert.notCalled(create);
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotDeletion, omit(slot, '_id'), user._id);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: slot._id },
      { $unset: { startDate: '', endDate: '', meetingLink: '', address: '', trainees: '', trainers: '' } }
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
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.notCalled(createHistoryOnSlotCreation);
    sinon.assert.notCalled(create);
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
    sinon.assert.notCalled(createHistoryOnSlotDeletion);
    sinon.assert.notCalled(createHistoryOnSlotCreation);
    sinon.assert.notCalled(create);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: slot._id }, { $unset: { trainees: '' } });
    sinon.assert.calledOnceWithExactly(createHistoryOnSlotRestriction,
      { course: courseId, startDate: '2020-03-03T20:00:00.000Z', endDate: '2020-03-03T22:00:00.000Z' },
      user._id);
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
