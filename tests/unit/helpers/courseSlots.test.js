const sinon = require('sinon');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const CourseSlot = require('../../../src/models/CourseSlot');
const Course = require('../../../src/models/Course');
const CourseSlotsHelper = require('../../../src/helpers/courseSlots');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
const SinonMongoose = require('../sinonMongoose');
const { REMOTE, ON_SITE, PRESENT, MISSING, SINGLE, NOT_PAID } = require('../../../src/helpers/constants');

describe('list', () => {
  let courseSlotsFind;
  let courseFind;
  beforeEach(() => {
    courseSlotsFind = sinon.stub(CourseSlot, 'find');
    courseFind = sinon.stub(Course, 'find');
    process.env.COLLECTIVE_STEP_IDS = new ObjectId();
  });
  afterEach(() => {
    courseSlotsFind.restore();
    courseFind.restore();
    process.env.COLLECTIVE_STEP_IDS = '';
  });

  it('should return slots grouped by trainer between two dates', async () => {
    const collectiveStepId = process.env.COLLECTIVE_STEP_IDS;
    const courseIds = [new ObjectId(), new ObjectId()];
    const traineesIds = [new ObjectId(), new ObjectId()];
    const trainerId = new ObjectId();
    const subProgramId = new ObjectId();
    const slots = [
      {
        _id: new ObjectId(),
        startDate: '2020-05-03T12:00:00.000Z',
        endDate: '2020-05-03T13:00:00.000Z',
        step: { _id: new ObjectId(), name: 'step 1' },
        trainers: [{ _id: trainerId, identity: { firstname: 'Jean', lastname: 'Pierre' } }],
        course: {
          _id: courseIds[0],
          misc: 'indiv 1',
          subProgram: { _id: subProgramId, program: { name: 'program' } },
          trainees: [{ _id: traineesIds[0], identity: { firstname: 'App', lastname: 'One' } }],
        },
        attendances: [{ status: PRESENT }],
        status: NOT_PAID,
      },
      {
        _id: new ObjectId(),
        startDate: '2020-05-04T12:00:00.000Z',
        endDate: '2020-05-04T13:00:00.000Z',
        step: { _id: collectiveStepId, name: 'step collective' },
        trainers: [{ _id: trainerId, identity: { firstname: 'Jean', lastname: 'Pierre' } }],
        course: {
          _id: courseIds[0],
          misc: 'indiv 1',
          subProgram: { _id: subProgramId, program: { name: 'program' } },
          trainees: [{ _id: traineesIds[0], identity: { firstname: 'App', lastname: 'One' } }],
        },
        attendances: [{ status: MISSING }],
        status: NOT_PAID,
      },
      {
        _id: new ObjectId(),
        startDate: '2020-05-05T12:00:00.000Z',
        endDate: '2020-05-05T13:00:00.000Z',
        step: { _id: new ObjectId(), name: 'step 2' },
        trainers: [{ _id: trainerId, identity: { firstname: 'Jean', lastname: 'Pierre' } }],
        course: {
          _id: courseIds[0],
          misc: 'indiv 1',
          subProgram: { _id: subProgramId, program: { name: 'program' } },
          trainees: [{ _id: traineesIds[0], identity: { firstname: 'App', lastname: 'One' } }],
        },
        attendances: [],
        status: NOT_PAID,
      },
      {
        _id: new ObjectId(),
        startDate: '2020-05-06T12:00:00.000Z',
        endDate: '2020-05-06T13:00:00.000Z',
        step: { _id: new ObjectId(), name: 'step 3' },
        trainers: [{ _id: trainerId, identity: { firstname: 'Jean', lastname: 'Pierre' } }],
        course: {
          _id: courseIds[1],
          misc: 'indiv 2',
          subProgram: { _id: subProgramId, program: { name: 'program' } },
          trainees: [{ _id: traineesIds[1], identity: { firstname: 'App', lastname: 'Two' } }],
        },
        attendances: [{ status: PRESENT }],
        status: NOT_PAID,
      },
    ];

    courseFind.returns(SinonMongoose.stubChainedQueries(courseIds.map(c => ({ _id: c })), ['lean']));
    courseSlotsFind.returns(SinonMongoose.stubChainedQueries(slots));

    const result = await CourseSlotsHelper
      .list({ startDate: '2020-04-30T22:00:00.000Z', endDate: '2020-05-31T21:59:59.999Z' });

    expect(result).toEqual({
      [trainerId]: {
        identity: { firstname: 'Jean', lastname: 'Pierre' },
        courses: [
          {
            _id: courseIds[0].toHexString(),
            name: 'program - indiv 1',
            singleTraineeSlots: {
              'step 1': [{
                startDate: '2020-05-03T12:00:00.000Z',
                endDate: '2020-05-03T13:00:00.000Z',
                duration: 'PT60M',
                isAbsence: false,
                status: NOT_PAID,
              }],
            },
          },
          {
            _id: courseIds[1].toHexString(),
            name: 'program - indiv 2',
            singleTraineeSlots: {
              'step 3': [{
                startDate: '2020-05-06T12:00:00.000Z',
                endDate: '2020-05-06T13:00:00.000Z',
                duration: 'PT60M',
                isAbsence: false,
                status: NOT_PAID,
              }],
            },
          },
        ],
        collectiveSlots: {
          '04/05/2020': [{
            traineeName: 'App ONE',
            startDate: '2020-05-04T12:00:00.000Z',
            endDate: '2020-05-04T13:00:00.000Z',
            duration: 'PT60M',
            isAbsence: true,
            status: NOT_PAID,
          }],
        },
      },
    });

    SinonMongoose.calledOnceWithExactly(
      courseFind,
      [{ query: 'find', args: [{ type: SINGLE }, { _id: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      courseSlotsFind,
      [
        {
          query: 'find',
          args: [{
            course: { $in: courseIds },
            startDate: { $gte: '2020-04-30T22:00:00.000Z' },
            endDate: { $lte: '2020-05-31T21:59:59.999Z' },
          }],
        },
        { query: 'populate', args: [{ path: 'step', select: '_id name' }] },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: '_id misc subProgram trainees',
            populate: [
              { path: 'trainees', select: 'identity' },
              { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'attendances', select: 'status', options: { isVendorUser: true } }] },
        { query: 'lean' },
      ]
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
      trainers: [new ObjectId()],
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
        trainers: payload.trainers,
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
          trainers: payload.trainers,
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
      trainers: [new ObjectId()],
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
        trainers: payload.trainers,
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
        trainers: payload.trainers,
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
