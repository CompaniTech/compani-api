const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const { cloneDeep } = require('lodash');
const CourseHistory = require('../../../src/models/CourseHistory');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
const {
  SLOT_CREATION,
  SLOT_DELETION,
  SLOT_EDITION,
  TRAINEE_ADDITION,
  TRAINEE_DELETION,
  ESTIMATED_START_DATE_EDITION,
  COMPANY_ADDITION,
  COMPANY_DELETION,
  COURSE,
  TRAINEE,
  TRAINER_ADDITION,
  TRAINER_DELETION,
  COURSE_INTERRUPTION,
} = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('createHistory', () => {
  let create;

  beforeEach(() => {
    create = sinon.stub(CourseHistory, 'create');
  });

  afterEach(() => {
    create.restore();
  });

  it('should create history', async () => {
    const course = new ObjectId();
    const user = new ObjectId();
    await CourseHistoriesHelper.createHistory(course, user, 'action', { trainee: 'bonjour' });

    sinon.assert.calledOnceWithExactly(create, { course, createdBy: user, action: 'action', trainee: 'bonjour' });
  });

  it('should create history without payload', async () => {
    const course = new ObjectId();
    const user = new ObjectId();
    await CourseHistoriesHelper.createHistory(course, user, 'action');

    sinon.assert.calledOnceWithExactly(create, { course, createdBy: user, action: 'action' });
  });
});

describe('createHistoryOnSlotCreation', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory with address', async () => {
    const payload = {
      startDate: '2019-02-03T09:00:00.000Z',
      endDate: '2019-02-03T10:00:00.000Z',
      address: {
        fullAddress: 'ertyui',
        street: '12345',
        zipCode: '12345',
        city: 'qwert',
        location: { type: 'Point', coordinates: [0, 1] },
      },
      course: new ObjectId(),
    };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotCreation(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      SLOT_CREATION,
      { slot: { startDate: payload.startDate, endDate: payload.endDate, address: payload.address } }
    );
  });

  it('should create a courseHistory with meetingLink', async () => {
    const payload = {
      startDate: '2019-02-03T09:00:00.000Z',
      endDate: '2019-02-03T10:00:00.000Z',
      meetingLink: 'https://meet.google.com',
      course: new ObjectId(),
    };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotCreation(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      SLOT_CREATION,
      { slot: { startDate: payload.startDate, endDate: payload.endDate, meetingLink: payload.meetingLink } }
    );
  });

  it('should create a courseHistory without address or meetingLink', async () => {
    const payload = {
      startDate: '2019-02-03T09:00:00.000Z',
      endDate: '2019-02-03T10:00:00.000Z',
      course: new ObjectId(),
    };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotCreation(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      SLOT_CREATION,
      { slot: { startDate: payload.startDate, endDate: payload.endDate } }
    );
  });
});

describe('createHistoryOnSlotDeletion', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory with address', async () => {
    const payload = {
      startDate: '2019-02-03T09:00:00.000Z',
      endDate: '2019-02-03T10:00:00.000Z',
      address: {
        fullAddress: 'ertyui',
        street: '12345',
        zipCode: '12345',
        city: 'qwert',
        location: { type: 'Point', coordinates: [0, 1] },
      },
      course: new ObjectId(),
    };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotDeletion(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      SLOT_DELETION,
      { slot: { startDate: payload.startDate, endDate: payload.endDate, address: payload.address } }
    );
  });

  it('should create a courseHistory with meetingLink', async () => {
    const payload = {
      startDate: '2019-02-03T09:00:00.000Z',
      endDate: '2019-02-03T10:00:00.000Z',
      meetingLink: 'https://meet.google.com',
      course: new ObjectId(),
    };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotDeletion(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      SLOT_DELETION,
      { slot: { startDate: payload.startDate, endDate: payload.endDate, meetingLink: payload.meetingLink } }
    );
  });

  it('should create a courseHistory without address or meetingLink', async () => {
    const payload = {
      startDate: '2019-02-03T09:00:00.000Z',
      endDate: '2019-02-03T10:00:00.000Z',
      course: new ObjectId(),
    };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotDeletion(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      SLOT_DELETION,
      { slot: { startDate: payload.startDate, endDate: payload.endDate } }
    );
  });
});

describe('createHistoryOnSlotEdition', () => {
  let createHistory;
  let createHistoryOnSlotCreation;
  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
    createHistoryOnSlotCreation = sinon.stub(CourseHistoriesHelper, 'createHistoryOnSlotCreation');
  });

  afterEach(() => {
    createHistory.restore();
    createHistoryOnSlotCreation.restore();
  });

  it('should create history if date is updated', async () => {
    const course = new ObjectId();
    const slotFromDb = { startDate: '2020-01-10T09:00:00.000Z', endDate: '2020-01-10T11:00:00.000Z', course };
    const payload = { startDate: '2020-01-11T09:00:00.000Z', endDate: '2020-01-10T11:00:00.000Z' };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotEdition(slotFromDb, payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      course,
      userId,
      SLOT_EDITION,
      { update: { startDate: { from: '2020-01-10T09:00:00.000Z', to: '2020-01-11T09:00:00.000Z' } } }
    );
    sinon.assert.notCalled(createHistoryOnSlotCreation);
  });

  it('should create history with slot_creation action if not date in db', async () => {
    const course = new ObjectId();
    const slotFromDb = { course };
    const payload = { startDate: '2020-01-11T09:00:00.000Z', endDate: '2020-01-11T11:00:00.000Z' };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotEdition(slotFromDb, payload, userId);

    sinon.assert.calledOnceWithExactly(createHistoryOnSlotCreation, { ...slotFromDb, ...payload }, userId);
    sinon.assert.notCalled(createHistory);
  });

  it('should not create history if date is not updated', async () => {
    const course = new ObjectId();
    const slotFromDb = { startDate: '2020-01-10T09:00:00.000Z', endDate: '2020-01-10T11:00:00.000Z', course };
    const payload = { startDate: '2020-01-10T09:00:00.000Z', endDate: '2020-01-10T11:00:00.000Z' };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotEdition(slotFromDb, payload, userId);

    sinon.assert.notCalled(createHistory);
    sinon.assert.notCalled(createHistoryOnSlotCreation);
  });

  it('should create history if date and hour are updated', async () => {
    const course = new ObjectId();
    const slotFromDb = { startDate: '2020-01-10T10:00:00.000Z', endDate: '2020-01-10T11:30:00.000Z', course };
    const payload = { startDate: '2020-01-15T11:00:00.000Z', endDate: '2020-01-15T11:30:00.000Z' };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotEdition(slotFromDb, payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      course,
      userId,
      SLOT_EDITION,
      {
        update: {
          startDate: { from: '2020-01-10T10:00:00.000Z', to: '2020-01-15T11:00:00.000Z' },
          startHour: { from: '2020-01-10T10:00:00.000Z', to: '2020-01-15T11:00:00.000Z' },
          endHour: { from: '2020-01-10T11:30:00.000Z', to: '2020-01-15T11:30:00.000Z' },
        },
      }
    );
    sinon.assert.notCalled(createHistoryOnSlotCreation);
  });

  it('should create history if start hour is updated', async () => {
    const course = new ObjectId();
    const slotFromDb = { startDate: '2020-01-10T09:00:00.000Z', endDate: '2020-01-10T11:30:00.000Z', course };
    const payload = { startDate: '2020-01-10T11:00:00.000Z', endDate: '2020-01-10T11:30:00.000Z' };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotEdition(slotFromDb, payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      course,
      userId,
      SLOT_EDITION,
      {
        update: {
          startHour: { from: '2020-01-10T09:00:00.000Z', to: '2020-01-10T11:00:00.000Z' },
          endHour: { from: '2020-01-10T11:30:00.000Z', to: '2020-01-10T11:30:00.000Z' },
        },
      }
    );
    sinon.assert.notCalled(createHistoryOnSlotCreation);
  });

  it('should create history if end hour is updated', async () => {
    const course = new ObjectId();
    const slotFromDb = { startDate: '2020-01-10T10:00:00.000Z', endDate: '2020-01-10T11:30:00.000Z', course };
    const payload = { startDate: '2020-01-10T10:00:00.000Z', endDate: '2020-01-10T13:00:00.000Z' };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnSlotEdition(slotFromDb, payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      course,
      userId,
      SLOT_EDITION,
      {
        update: {
          startHour: { from: '2020-01-10T10:00:00.000Z', to: '2020-01-10T10:00:00.000Z' },
          endHour: { from: '2020-01-10T11:30:00.000Z', to: '2020-01-10T13:00:00.000Z' },
        },
      }
    );
    sinon.assert.notCalled(createHistoryOnSlotCreation);
  });
});

describe('createHistoryOnTraineeAddition', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory', async () => {
    const payload = { traineeId: new ObjectId(), course: new ObjectId(), company: new ObjectId() };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnTraineeAddition(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      TRAINEE_ADDITION,
      { trainee: payload.traineeId, company: payload.company }
    );
  });
});

describe('createHistoryOnTraineeDeletion', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory', async () => {
    const payload = {
      traineeId: new ObjectId(),
      course: new ObjectId(),
    };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnTraineeDeletion(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      TRAINEE_DELETION,
      { trainee: payload.traineeId }
    );
  });
});

describe('createHistoryOnEstimatedStartDateEdition', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory for estimatedStartDate on value initialisation', async () => {
    const courseId = new ObjectId();
    const newEstimatedStartDate = '2022-11-12T12:30:00.000Z';
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnEstimatedStartDateEdition(courseId, userId, newEstimatedStartDate);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      courseId,
      userId,
      ESTIMATED_START_DATE_EDITION,
      { update: { estimatedStartDate: { to: newEstimatedStartDate } } }
    );
  });

  it('should create a courseHistory for estimatedStartDate on edition', async () => {
    const courseId = new ObjectId();
    const previousEstimatedStartDate = '2022-11-01T08:00:00.000Z';
    const newEstimatedStartDate = '2022-11-12T12:30:00.000Z';
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnEstimatedStartDateEdition(
      courseId,
      userId,
      newEstimatedStartDate,
      previousEstimatedStartDate
    );

    sinon.assert.calledOnceWithExactly(
      createHistory,
      courseId,
      userId,
      ESTIMATED_START_DATE_EDITION,
      { update: { estimatedStartDate: { from: previousEstimatedStartDate, to: newEstimatedStartDate } } }
    );
  });
});

describe('createHistoryOnTrainerAdditionOrDeletion', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory for addition trainer', async () => {
    const payload = { trainerId: new ObjectId(), course: new ObjectId(), action: TRAINER_ADDITION };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnTrainerAdditionOrDeletion(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      payload.action,
      { trainer: payload.trainerId }
    );
  });

  it('should create a courseHistory for deletion trainer', async () => {
    const payload = { trainerId: new ObjectId(), course: new ObjectId(), action: TRAINER_DELETION };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnTrainerAdditionOrDeletion(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      payload.action,
      { trainer: payload.trainerId }
    );
  });
});

describe('list', () => {
  let find;

  beforeEach(() => {
    find = sinon.stub(CourseHistory, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return the requested course histories', async () => {
    const returnedList = [{
      startDate: '2019-02-03T09:00:00.000Z',
      endDate: '2019-02-03T10:00:00.000Z',
      address: {
        fullAddress: 'ertyui',
        street: '12345',
        zipCode: '12345',
        city: 'qwert',
        location: { type: 'Point', coordinates: [0, 1] },
      },
      course: new ObjectId(),
    }];
    const query = { course: returnedList[0].course };

    find.returns(SinonMongoose.stubChainedQueries(returnedList, ['populate', 'sort', 'limit', 'lean']));

    const result = await CourseHistoriesHelper.list(query);

    expect(result).toMatchObject(returnedList);
    SinonMongoose.calledOnceWithExactly(find, [
      { query: 'find', args: [query] },
      { query: 'populate', args: [{ path: 'createdBy', select: '_id identity picture' }] },
      { query: 'populate', args: [{ path: 'trainee', select: '_id identity' }] },
      { query: 'populate', args: [{ path: 'company', select: '_id name' }] },
      { query: 'populate', args: [{ path: 'trainer', select: '_id identity' }] },
      { query: 'sort', args: [{ createdAt: -1 }] },
      { query: 'limit', args: [20] },
      { query: 'lean' },
    ]);
  });

  it('should return the requested course histories before createdAt', async () => {
    const returnedList = [{
      startDate: '2019-02-03T09:00:00.000Z',
      endDate: '2019-02-03T10:00:00.000Z',
      address: {
        fullAddress: 'ertyui',
        street: '12345',
        zipCode: '12345',
        city: 'qwert',
        location: { type: 'Point', coordinates: [0, 1] },
      },
      course: new ObjectId(),
      createdAt: '2019-02-03T10:00:00.000Z',
    }];
    const query = { course: returnedList[0].course, createdAt: '2019-02-04T10:00:00.000Z' };

    find.returns(SinonMongoose.stubChainedQueries(returnedList, ['populate', 'sort', 'limit', 'lean']));

    const result = await CourseHistoriesHelper.list(query);

    expect(result).toMatchObject(returnedList);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: query.course, createdAt: { $lt: query.createdAt } }] },
        { query: 'populate', args: [{ path: 'createdBy', select: '_id identity picture' }] },
        { query: 'populate', args: [{ path: 'trainee', select: '_id identity' }] },
        { query: 'populate', args: [{ path: 'company', select: '_id name' }] },
        { query: 'populate', args: [{ path: 'trainer', select: '_id identity' }] },
        { query: 'sort', args: [{ createdAt: -1 }] },
        { query: 'limit', args: [20] },
        { query: 'lean' },
      ]
    );
  });
});

describe('createHistoryOnCompanyAddition', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory', async () => {
    const payload = { company: new ObjectId(), course: new ObjectId() };
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnCompanyAddition(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      payload.course,
      userId,
      COMPANY_ADDITION,
      { company: payload.company }
    );
  });
});

describe('createHistoryOnCompanyDeletion', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory', async () => {
    const companyId = new ObjectId();
    const courseId = new ObjectId();
    const userId = new ObjectId();
    const payload = { course: courseId, company: companyId };

    await CourseHistoriesHelper.createHistoryOnCompanyDeletion(payload, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      courseId,
      userId,
      COMPANY_DELETION,
      { company: companyId }
    );
  });
});

describe('getCompanyAtCourseRegistrationList', () => {
  let courseHistoryFind;

  beforeEach(() => {
    courseHistoryFind = sinon.stub(CourseHistory, 'find');
  });
  afterEach(() => {
    courseHistoryFind.restore();
  });

  it('should list trainees and the company that registered them in the course (INTER)', async () => {
    const courseId = new ObjectId();
    const traineeIds = [new ObjectId(), new ObjectId()];
    const companyIds = [new ObjectId(), new ObjectId()];
    const courseHistories = [
      { trainee: cloneDeep(traineeIds[1]), company: companyIds[1], createdAt: '2023-01-04T12:30:00.000Z' },
      { trainee: cloneDeep(traineeIds[0]), company: companyIds[0], createdAt: '2023-01-03T12:30:00.000Z' },
      { trainee: cloneDeep(traineeIds[0]), company: new ObjectId(), createdAt: '2022-12-15T12:30:00.000Z' },
    ];

    courseHistoryFind.returns(SinonMongoose.stubChainedQueries(courseHistories, ['sort', 'lean']));

    const result = await CourseHistoriesHelper
      .getCompanyAtCourseRegistrationList({ key: COURSE, value: courseId }, { key: TRAINEE, value: traineeIds });

    expect(result).toEqual([
      { trainee: traineeIds[1], company: courseHistories[0].company },
      { trainee: traineeIds[0], company: courseHistories[1].company },
    ]);

    SinonMongoose.calledOnceWithExactly(
      courseHistoryFind,
      [
        {
          query: 'find',
          args: [
            { course: courseId, action: TRAINEE_ADDITION, trainee: { $in: traineeIds } },
            { trainee: 1, company: 1, createdAt: 1, _id: 0 },
          ],
        },
        { query: 'sort', args: [{ createdAt: -1, trainee: 1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should list courses and the company at registration', async () => {
    const traineeId = new ObjectId();
    const courseIds = [new ObjectId(), new ObjectId()];
    const companyIds = [new ObjectId(), new ObjectId()];

    const courseHistories = [
      { trainee: traineeId, company: companyIds[1], createdAt: '2023-01-04T12:30:00.000Z', course: courseIds[1] },
      { trainee: traineeId, company: companyIds[0], createdAt: '2023-01-03T12:30:00.000Z', course: courseIds[0] },
      { trainee: traineeId, company: new ObjectId(), createdAt: '2022-12-15T12:30:00.000Z', course: courseIds[0] },
    ];
    courseHistoryFind.returns(SinonMongoose.stubChainedQueries(courseHistories, ['sort', 'lean']));

    const result = await CourseHistoriesHelper
      .getCompanyAtCourseRegistrationList({ key: TRAINEE, value: traineeId }, { key: COURSE, value: courseIds });

    expect(result).toEqual([
      { course: courseIds[1], company: courseHistories[0].company },
      { course: courseIds[0], company: courseHistories[1].company },
    ]);

    SinonMongoose.calledOnceWithExactly(
      courseHistoryFind,
      [
        {
          query: 'find',
          args: [
            { trainee: traineeId, action: TRAINEE_ADDITION, course: { $in: courseIds } },
            { course: 1, company: 1, createdAt: 1, _id: 0 },
          ],
        },
        { query: 'sort', args: [{ createdAt: -1, course: 1 }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('createHistoryOnCourseInterruption', () => {
  let createHistory;

  beforeEach(() => {
    createHistory = sinon.stub(CourseHistoriesHelper, 'createHistory');
  });

  afterEach(() => {
    createHistory.restore();
  });

  it('should create a courseHistory on course interruption', async () => {
    const courseId = new ObjectId();
    const userId = new ObjectId();

    await CourseHistoriesHelper.createHistoryOnCourseInterruption(courseId, userId);

    sinon.assert.calledOnceWithExactly(
      createHistory,
      courseId,
      userId,
      COURSE_INTERRUPTION
    );
  });
});
