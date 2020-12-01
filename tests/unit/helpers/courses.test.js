const sinon = require('sinon');
const expect = require('expect');
const { ObjectID } = require('mongodb');
const fs = require('fs');
const os = require('os');
const { PassThrough } = require('stream');
const { fn: momentProto } = require('moment');
const moment = require('moment');
const Course = require('../../../src/models/Course');
const CourseSmsHistory = require('../../../src/models/CourseSmsHistory');
const User = require('../../../src/models/User');
const Role = require('../../../src/models/Role');
const Drive = require('../../../src/models/Google/Drive');
const CourseHelper = require('../../../src/helpers/courses');
const SmsHelper = require('../../../src/helpers/sms');
const UsersHelper = require('../../../src/helpers/users');
const UtilsHelper = require('../../../src/helpers/utils');
const PdfHelper = require('../../../src/helpers/pdf');
const ZipHelper = require('../../../src/helpers/zip');
const DocxHelper = require('../../../src/helpers/docx');
const StepHelper = require('../../../src/helpers/steps');
const { COURSE_SMS, BLENDED } = require('../../../src/helpers/constants');
const CourseRepository = require('../../../src/repositories/CourseRepository');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
const { E_LEARNING, ON_SITE } = require('../../../src/helpers/constants');

require('sinon-mongoose');

describe('createCourse', () => {
  let save;
  beforeEach(() => {
    save = sinon.stub(Course.prototype, 'save').returnsThis();
  });
  afterEach(() => {
    save.restore();
  });

  it('should create an intra course', async () => {
    const newCourse = { misc: 'name', company: new ObjectID(), subProgram: new ObjectID(), type: 'intra' };

    const result = await CourseHelper.createCourse(newCourse);
    expect(result.misc).toEqual(newCourse.misc);
    expect(result.subProgram).toEqual(newCourse.subProgram);
    expect(result.company).toEqual(newCourse.company);
    expect(result.format).toEqual('blended');
  });
});

describe('list', () => {
  let findCourseAndPopulate;
  let CourseMock;
  const authCompany = new ObjectID();

  beforeEach(() => {
    findCourseAndPopulate = sinon.stub(CourseRepository, 'findCourseAndPopulate');
    CourseMock = sinon.mock(Course);
  });
  afterEach(() => {
    findCourseAndPopulate.restore();
    CourseMock.restore();
  });

  it('should return courses', async () => {
    const coursesList = [{ misc: 'name' }, { misc: 'program' }];

    findCourseAndPopulate.returns(coursesList);
    CourseMock.expects('findOne').never();

    const result = await CourseHelper.list({ trainer: '1234567890abcdef12345678', format: 'blended' });
    expect(result).toMatchObject(coursesList);
    sinon.assert.calledWithExactly(findCourseAndPopulate, { trainer: '1234567890abcdef12345678', format: 'blended' });
    CourseMock.verify();
  });

  it('should return company courses', async () => {
    const coursesList = [
      { misc: 'name', type: 'intra' },
      {
        misc: 'program',
        type: 'inter_b2b',
        trainees: [{ identity: { firstname: 'Bonjour' }, company: { _id: authCompany } }],
      },
    ];
    const returnedList = [
      { misc: 'name', type: 'intra' },
      {
        misc: 'program',
        type: 'inter_b2b',
        companies: ['1234567890abcdef12345678', authCompany.toHexString()],
        trainees: [
          { identity: { firstname: 'Bonjour' }, company: { _id: authCompany } },
          { identity: { firstname: 'Au revoir' }, company: { _id: new ObjectID() } },
        ],
      },
    ];

    findCourseAndPopulate.onFirstCall()
      .returns([returnedList[0]])
      .onSecondCall()
      .returns([returnedList[1]]);

    CourseMock.expects('findOne').never();

    const result = await CourseHelper.list({
      company: authCompany.toHexString(),
      trainer: '1234567890abcdef12345678',
      format: 'blended',
    });
    expect(result).toMatchObject(coursesList);
    sinon.assert.calledWithExactly(
      findCourseAndPopulate.getCall(0),
      { company: authCompany.toHexString(), trainer: '1234567890abcdef12345678', type: 'intra', format: 'blended' }
    );
    sinon.assert.calledWithExactly(
      findCourseAndPopulate.getCall(1),
      { trainer: '1234567890abcdef12345678', type: 'inter_b2b', format: 'blended' },
      true
    );
    CourseMock.verify();
  });
});

describe('getCourseProgress', () => {
  it('should get progress for course', async () => {
    const steps = [{
      _id: new ObjectID(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
      progress: 1,
    },
    {
      _id: new ObjectID(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: ON_SITE,
      areActivitiesValid: false,
      progress: 1,
    }];

    const result = await CourseHelper.getCourseProgress(steps);
    expect(result).toBe(1);
  });

  it('should return 0 if no steps', async () => {
    const steps = [];

    const result = await CourseHelper.getCourseProgress(steps);
    expect(result).toBe(0);
  });
});

describe('formatCourseWithProgress', () => {
  let getProgress;
  let getCourseProgress;
  beforeEach(() => {
    getCourseProgress = sinon.stub(CourseHelper, 'getCourseProgress');
    getProgress = sinon.stub(StepHelper, 'getProgress');
  });
  afterEach(() => {
    getCourseProgress.restore();
    getProgress.restore();
  });
  it('should format course', async () => {
    const stepId = new ObjectID();
    const course = {
      misc: 'name',
      _id: new ObjectID(),
      subProgram: {
        steps: [{
          _id: new ObjectID(),
          activities: [{ activityHistories: [{}, {}] }],
          name: 'Développement personnel full stack',
          type: 'e_learning',
          areActivitiesValid: false,
        },
        {
          _id: stepId,
          activities: [],
          name: 'Développer des équipes agiles et autonomes',
          type: 'on_site',
          areActivitiesValid: true,
        },
        ],
      },
      slots: [
        { endDate: '2020-11-03T09:00:00.000Z', step: stepId },
        { endDate: '2020-11-04T16:01:00.000Z', step: stepId },
      ],
    };
    getProgress.returns(1);
    getCourseProgress.returns(1);

    const result = await CourseHelper.formatCourseWithProgress(course);
    expect(result).toMatchObject({
      ...course,
      subProgram: {
        ...course.subProgram,
        steps: course.subProgram.steps.map(step => ({ ...step, progress: 1 })),
      },
      progress: 1,
    });
    sinon.assert.calledWithExactly(getProgress.getCall(0), course.subProgram.steps[0], course.slots);
    sinon.assert.calledWithExactly(getProgress.getCall(1), course.subProgram.steps[1], course.slots);
    sinon.assert.calledWithExactly(getCourseProgress.getCall(0), [
      { ...course.subProgram.steps[0], progress: 1 },
      { ...course.subProgram.steps[1], progress: 1 },
    ]);
  });
});

describe('listUserCourses', () => {
  let CourseMock;
  let formatCourseWithProgress;
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
    formatCourseWithProgress = sinon.stub(CourseHelper, 'formatCourseWithProgress');
  });
  afterEach(() => {
    CourseMock.restore();
    formatCourseWithProgress.restore();
  });

  it('should return courses', async () => {
    const stepId = new ObjectID();
    const coursesList = [
      {
        misc: 'name',
        _id: new ObjectID(),
        format: BLENDED,
        subProgram: {
          steps: [{
            _id: new ObjectID(),
            activities: [{ activityHistories: [{}, {}] }],
            name: 'Développement personnel full stack',
            type: 'e_learning',
            areActivitiesValid: false,
          },
          {
            _id: stepId,
            activities: [],
            name: 'Développer des équipes agiles et autonomes',
            type: 'on_site',
            areActivitiesValid: true,
          },
          ],
        },
        slots: [
          { endDate: '2020-11-03T09:00:00.000Z', step: stepId },
          { endDate: '2020-11-04T16:01:00.000Z', step: stepId },
        ],
      },
      {
        misc: 'program',
        _id: new ObjectID(),
        format: BLENDED,
        subProgram: {
          steps: [{
            _id: new ObjectID(),
            activities: [{ activityHistories: [{}, {}] }],
            name: 'Brochure : le mal de dos',
            type: 'e_learning',
            areActivitiesValid: false,
          }, {
            _id: stepId,
            activities: [],
            name: 'Enjailler son équipe autonome',
            type: 'on_site',
            areActivitiesValid: true,
          }],
        },
        slots: [
          { endDate: '2019-11-06T09:00:00.000Z', step: stepId },
          { endDate: '2019-12-22T16:01:00.000Z', step: stepId },
        ],
      },
    ];

    CourseMock.expects('find')
      .withExactArgs({ trainees: '1234567890abcdef12345678' }, { format: 1 })
      .chain('populate')
      .withExactArgs({
        path: 'subProgram',
        select: 'program steps',
        populate: [
          { path: 'program', select: 'name image' },
          {
            path: 'steps',
            select: 'name type activities',
            populate: {
              path: 'activities',
              select: 'name type cards activityHistories',
              populate: [
                { path: 'activityHistories', match: { user: '1234567890abcdef12345678' } },
                { path: 'cards', select: 'template' },
              ],
            },
          },
        ],
      })
      .chain('populate')
      .withExactArgs({ path: 'slots', select: 'startDate endDate step', populate: { path: 'step', select: 'type' } })
      .chain('select')
      .withExactArgs('_id misc')
      .chain('lean')
      .returns(coursesList);
    formatCourseWithProgress.onCall(0).returns({
      ...coursesList[0],
      subProgram: {
        ...coursesList[0].subProgram,
        steps: coursesList[0].subProgram.steps.map(step => ({ ...step, progress: 1 })),
      },
      progress: 1,
    });
    formatCourseWithProgress.onCall(1).returns({
      ...coursesList[1],
      subProgram: {
        ...coursesList[1].subProgram,
        steps: coursesList[1].subProgram.steps.map(step => ({ ...step, progress: 1 })),
      },
      progress: 1,
    });

    const result = await CourseHelper.listUserCourses('1234567890abcdef12345678');
    expect(result).toMatchObject(coursesList.map(course => ({ ...course,
      subProgram: {
        ...course.subProgram,
        steps: course.subProgram.steps.map(step => ({ ...step, progress: 1 })),
      },
      progress: 1 })));

    sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(0), coursesList[0]);
    sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(1), coursesList[1]);
  });
});

describe('getCourse', () => {
  let CourseMock;
  const authCompanyId = new ObjectID();
  const course = {
    _id: new ObjectID(),
    type: 'inter_b2b',
    trainees: [
      { _id: new ObjectID(), company: authCompanyId },
      { _id: new ObjectID(), company: new ObjectID() },
    ],
  };
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
  });
  afterEach(() => {
    CourseMock.restore();
  });

  it('should return inter b2b course without trainees filtering', async () => {
    CourseMock.expects('findOne')
      .withExactArgs({ _id: course._id })
      .chain('populate')
      .withExactArgs({ path: 'company', select: 'name' })
      .chain('populate')
      .withExactArgs({
        path: 'subProgram',
        select: 'program steps',
        populate: [{ path: 'program', select: 'name description' }, { path: 'steps', select: 'name type' }],
      })
      .chain('populate')
      .withExactArgs({ path: 'slots', populate: { path: 'step', select: 'name' } })
      .chain('populate')
      .withExactArgs({ path: 'slotsToPlan', select: '_id' })
      .chain('populate')
      .withExactArgs({
        path: 'trainees',
        select: 'identity.firstname identity.lastname local.email company contact',
        populate: { path: 'company', select: 'name' },
        match: {},
      })
      .chain('populate')
      .withExactArgs({ path: 'trainer', select: 'identity.firstname identity.lastname' })
      .chain('populate')
      .withExactArgs({ path: 'accessRules', select: 'name' })
      .chain('lean')
      .once()
      .returns(course);

    const result = await CourseHelper.getCourse(
      course,
      { role: { vendor: { name: 'vendor_admin' } }, company: { _id: authCompanyId } }
    );
    expect(result).toMatchObject(course);
    expect(result.trainees.length).toEqual(2);
  });

  it('should return inter b2b course with trainees filtering', async () => {
    CourseMock.expects('findOne')
      .withExactArgs({ _id: course._id })
      .chain('populate')
      .withExactArgs({ path: 'company', select: 'name' })
      .chain('populate')
      .withExactArgs({
        path: 'subProgram',
        select: 'program steps',
        populate: [{ path: 'program', select: 'name description' }, { path: 'steps', select: 'name type' }],
      })
      .chain('populate')
      .withExactArgs({ path: 'slots', populate: { path: 'step', select: 'name' } })
      .chain('populate')
      .withExactArgs({ path: 'slotsToPlan', select: '_id' })
      .chain('populate')
      .withExactArgs({
        path: 'trainees',
        select: 'identity.firstname identity.lastname local.email company contact',
        populate: { path: 'company', select: 'name' },
        match: { company: authCompanyId },
      })
      .chain('populate')
      .withExactArgs({ path: 'trainer', select: 'identity.firstname identity.lastname' })
      .chain('lean')
      .once()
      .returns({ ...course, trainees: [course.trainees[0]] });

    const result = await CourseHelper.getCourse(
      course,
      { role: { client: { name: 'client_admin' } }, company: { _id: authCompanyId } }
    );
    expect(result.trainees.length).toEqual(1);
  });
});

describe('getCoursePublicInfos', () => {
  let CourseMock;
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
  });
  afterEach(() => {
    CourseMock.restore();
  });

  it('should return courses', async () => {
    const course = { _id: new ObjectID() };

    CourseMock.expects('findOne')
      .withExactArgs({ _id: course._id })
      .chain('populate')
      .withExactArgs({
        path: 'subProgram',
        select: 'program',
        populate: { path: 'program', select: 'name description' },
      })
      .chain('populate')
      .withExactArgs('slots')
      .chain('populate')
      .withExactArgs({ path: 'slotsToPlan', select: '_id' })
      .chain('populate')
      .withExactArgs({ path: 'trainer', select: 'identity.firstname identity.lastname biography' })
      .chain('lean')
      .once()
      .returns(course);

    const result = await CourseHelper.getCoursePublicInfos(course);
    expect(result).toMatchObject(course);
  });
});

describe('selectUserHistory', () => {
  it('should return only the last history for each user', () => {
    const user1 = new ObjectID();
    const user2 = new ObjectID();
    const histories = [
      { user: user2.toHexString(), createdAt: '2020-10-03T10:00:00' },
      { user: user1.toHexString(), createdAt: '2020-09-03T10:00:00' },
      { user: user2.toHexString(), createdAt: '2020-08-03T10:00:00' },
      { user: user1.toHexString(), createdAt: '2020-11-03T10:00:00' },
      { user: user2.toHexString(), createdAt: '2020-01-03T10:00:00' },
      { user: user2.toHexString(), createdAt: '2020-02-03T10:00:00' },
    ];

    const result = CourseHelper.selectUserHistory(histories);

    expect(result).toStrictEqual([
      { user: user2.toHexString(), createdAt: '2020-10-03T10:00:00' },
      { user: user1.toHexString(), createdAt: '2020-11-03T10:00:00' },
    ]);
  });
});

describe('formatActivity', () => {
  let selectUserHistory;
  beforeEach(() => {
    selectUserHistory = sinon.stub(CourseHelper, 'selectUserHistory');
  });
  afterEach(() => {
    selectUserHistory.restore();
  });

  it('should return empty follow up if no history', () => {
    const activity = { activityHistories: [] };
    selectUserHistory.returns(activity.activityHistories);
    const result = CourseHelper.formatActivity(activity);

    expect(result).toEqual({ activityHistories: [], followUp: [] });
  });

  it('should return format activity with histories', () => {
    const activity = {
      activityHistories: [
        {
          _id: 'rfvgtgb',
          user: 'qwertyuiop',
          questionnaireAnswersList: [
            { card: { _id: '1234567', title: 'Bonjour' }, answerList: [2] },
            { card: { _id: '0987654', title: 'Hello' }, answerList: [3] },
          ],
        },
        {
          _id: 'yhnjujm',
          user: 'poiuytre',
          questionnaireAnswersList: [
            { card: { _id: '1234567', title: 'Bonjour' }, answerList: [3] },
            { card: { _id: '0987654', title: 'Hello' }, answerList: [4] },
          ],
        },
        {
          _id: 'zxcvbnm',
          user: 'xzcvbnm',
          questionnaireAnswersList: [
            { card: { _id: '1234567', title: 'Bonjour' }, answerList: [1] },
            { card: { _id: '0987654', title: 'Hello' }, answerList: [4] },
          ],
        },
      ],
    };
    selectUserHistory.returns(activity.activityHistories);
    const result = CourseHelper.formatActivity(activity);

    expect(result).toEqual({
      activityHistories: ['rfvgtgb', 'yhnjujm', 'zxcvbnm'],
      followUp: [
        { _id: '1234567', title: 'Bonjour', answers: [2, 3, 1] },
        { _id: '0987654', title: 'Hello', answers: [3, 4, 4] },
      ],
    });
  });
});

describe('formatStep', () => {
  let formatActivity;
  beforeEach(() => {
    formatActivity = sinon.stub(CourseHelper, 'formatActivity');
  });
  afterEach(() => {
    formatActivity.restore();
  });

  it('should format step', () => {
    const step = { name: 'Je suis une etape', activities: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] };
    formatActivity.callsFake(a => a._id);
    const result = CourseHelper.formatStep(step);

    expect(result).toEqual({ name: 'Je suis une etape', activities: ['abc', 'def', 'ghi'] });
  });
});

describe('getCourseFollowUp', () => {
  let CourseMock;
  let formatStep;
  let getTraineeProgress;
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
    formatStep = sinon.stub(CourseHelper, 'formatStep');
    getTraineeProgress = sinon.stub(CourseHelper, 'getTraineeProgress');
  });
  afterEach(() => {
    CourseMock.restore();
    formatStep.restore();
    getTraineeProgress.restore();
  });

  it('should return course follow up', async () => {
    const course = {
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [{ _id: '123213123', steps: { progress: 1 }, progress: 1 }],
      slots: [{ _id: '123456789' }],
    };
    const trainees = [1, 2, 3, 4, 5];

    CourseMock.expects('findOne')
      .withExactArgs({ _id: course._id })
      .chain('select')
      .withExactArgs('trainees')
      .chain('lean')
      .returns({ trainees });

    CourseMock.expects('findOne')
      .withExactArgs({ _id: course._id })
      .chain('select')
      .withExactArgs('subProgram')
      .chain('populate')
      .withExactArgs({
        path: 'subProgram',
        select: 'name steps program',
        populate: [
          { path: 'program', select: 'name' },
          {
            path: 'steps',
            select: 'name activities type',
            populate: {
              path: 'activities',
              select: 'name type',
              populate: {
                path: 'activityHistories',
                match: { user: { $in: trainees } },
                populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
              },
            },
          },
        ],
      })
      .chain('populate')
      .withExactArgs({ path: 'trainees', select: 'identity.firstname identity.lastname' })
      .chain('populate')
      .withExactArgs({ path: 'slots', populate: { path: 'step', select: '_id' } })
      .chain('lean')
      .returns(course);

    formatStep.callsFake(s => s);
    getTraineeProgress.returns({ steps: { progress: 1 }, progress: 1 });
    const result = await CourseHelper.getCourseFollowUp(course);

    expect(result).toEqual(course);
    CourseMock.verify();
  });
});

describe('getTraineeProgress', () => {
  let areObjectIdsEquals;
  let getProgress;
  let getCourseProgress;
  beforeEach(() => {
    areObjectIdsEquals = sinon.stub(UtilsHelper, 'areObjectIdsEquals');
    getProgress = sinon.stub(StepHelper, 'getProgress');
    getCourseProgress = sinon.stub(CourseHelper, 'getCourseProgress');
  });
  afterEach(() => {
    areObjectIdsEquals.restore();
    getProgress.restore();
    getCourseProgress.restore();
  });

  it('should return formatted steps and course progress', () => {
    const traineeId = new ObjectID();
    const otherTraineeId = new ObjectID();
    const steps = [{
      activities: [{ activityHistories: [{ user: traineeId }, { user: otherTraineeId }] }],
      type: ON_SITE,
    }];
    const slots = [{ endDate: '2020-11-03T09:00:00.000Z' }];

    const formattedSteps = [{
      activities: [{ activityHistories: [{ user: traineeId }] }],
      type: ON_SITE,
      progress: 1,
    }];

    areObjectIdsEquals.onCall(0).returns(true);
    areObjectIdsEquals.onCall(1).returns(false);
    getProgress.returns(1);
    getCourseProgress.returns(1);

    const result = CourseHelper.getTraineeProgress(traineeId, steps, slots);

    expect(result).toEqual({
      steps: [{ activities: [{ activityHistories: [{ user: traineeId }] }], type: ON_SITE, progress: 1 }],
      progress: 1,
    });
    sinon.assert.calledWithExactly(areObjectIdsEquals.getCall(0), traineeId, traineeId);
    sinon.assert.calledWithExactly(areObjectIdsEquals.getCall(1), otherTraineeId, traineeId);
    sinon.assert.calledOnceWithExactly(
      getProgress,
      { activities: [{ activityHistories: [{ user: traineeId }] }], type: ON_SITE },
      slots
    );
    sinon.assert.calledOnceWithExactly(getCourseProgress, formattedSteps);
  });
});

describe('getTraineeCourse', () => {
  let CourseMock;
  let formatCourseWithProgress;
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
    formatCourseWithProgress = sinon.stub(CourseHelper, 'formatCourseWithProgress');
  });
  afterEach(() => {
    CourseMock.restore();
    formatCourseWithProgress.restore();
  });

  it('should return courses', async () => {
    const stepId = new ObjectID();
    const course = {
      _id: new ObjectID(),
      subProgram: {
        steps: [{
          _id: new ObjectID(),
          activities: [{ activityHistories: [{}, {}] }],
          name: 'Développement personnel full stack',
          type: 'e_learning',
          areActivitiesValid: false,
        },
        {
          _id: stepId,
          activities: [],
          name: 'Développer des équipes agiles et autonomes',
          type: 'on_site',
          areActivitiesValid: true,
        },
        ],
      },
      slots: [
        { endDate: '2020-11-03T09:00:00.000Z', step: stepId },
        { endDate: '2020-11-04T16:01:00.000Z', step: stepId },
      ],
    };
    const credentials = { _id: new ObjectID() };

    CourseMock.expects('findOne')
      .withExactArgs({ _id: course._id })
      .chain('populate')
      .withExactArgs({
        path: 'subProgram',
        select: 'program steps',
        populate: [
          { path: 'program', select: 'name image' },
          {
            path: 'steps',
            select: 'name type activities',
            populate: {
              path: 'activities',
              select: 'name type cards activityHistories',
              populate: [
                { path: 'activityHistories', match: { user: credentials._id } },
                { path: 'cards', select: 'template' },
              ],
            },
          },
        ],
      })
      .chain('populate')
      .withExactArgs({ path: 'slots', select: 'startDate endDate step address' })
      .chain('select')
      .withExactArgs('_id misc')
      .chain('lean')
      .once()
      .returns(course);
    formatCourseWithProgress.returns({
      ...course,
      subProgram: {
        ...course.subProgram,
        steps: course.subProgram.steps.map(step => ({ ...step, progress: 1 })),
      },
      progress: 1,
    });

    const result = await CourseHelper.getTraineeCourse(course._id, credentials);
    expect(result).toMatchObject({
      ...course,
      subProgram: {
        ...course.subProgram,
        steps: course.subProgram.steps.map(step => ({ ...step, progress: 1 })),
      },
      progress: 1,
    });

    sinon.assert.calledWithExactly(formatCourseWithProgress, course);
  });
});

describe('updateCourse', () => {
  let CourseMock;
  beforeEach(() => {
    CourseMock = sinon.mock(Course, 'CourseMock');
  });
  afterEach(() => {
    CourseMock.restore();
  });

  it('should update an intra course', async () => {
    const courseId = new ObjectID();
    const payload = { misc: 'groupe 4' };
    CourseMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: courseId }, { $set: payload })
      .chain('lean')
      .returns(payload);

    const result = await CourseHelper.updateCourse(courseId, payload);
    expect(result.misc).toEqual(payload.misc);
  });
});

describe('deleteCourse', () => {
  let deleteCourse;
  let deleteCourseSmsHistory;
  beforeEach(() => {
    deleteCourse = sinon.stub(Course, 'deleteOne');
    deleteCourseSmsHistory = sinon.stub(CourseSmsHistory, 'deleteMany');
  });
  afterEach(() => {
    deleteCourse.restore();
    deleteCourseSmsHistory.restore();
  });

  it('should delete course and sms history', async () => {
    const courseId = new ObjectID();
    await CourseHelper.deleteCourse(courseId);

    sinon.assert.calledOnceWithExactly(deleteCourse, { _id: courseId });
    sinon.assert.calledOnceWithExactly(deleteCourseSmsHistory, { course: courseId });
  });
});

describe('sendSMS', () => {
  const courseId = new ObjectID();
  const trainees = [
    { contact: { phone: '0123456789' }, identity: { firstname: 'non', lasname: 'ok' }, _id: 'qwertyuio' },
    { contact: { phone: '0987654321' }, identity: { firstname: 'test', lasname: 'ok' }, _id: 'asdfghjkl' },
    { contact: {}, identity: { firstname: 'test', lasname: 'ko' }, _id: 'poiuytrewq' },
  ];
  const payload = { content: 'Ceci est un test.' };
  const credentials = { _id: new ObjectID() };

  let CourseMock;
  let CourseSmsHistoryMock;
  let UserMock;
  let sendStub;
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
    CourseSmsHistoryMock = sinon.mock(CourseSmsHistory);
    UserMock = sinon.mock(User);
    sendStub = sinon.stub(SmsHelper, 'send');
  });
  afterEach(() => {
    CourseMock.restore();
    CourseSmsHistoryMock.restore();
    UserMock.restore();
    sendStub.restore();
  });

  it('should sens SMS to trainees and save missing phone trainee id', async () => {
    CourseMock.expects('findById')
      .withExactArgs(courseId)
      .chain('populate')
      .withExactArgs({ path: 'trainees', select: '_id contact' })
      .chain('lean')
      .returns({ trainees });

    sendStub.returns();

    CourseSmsHistoryMock.expects('create')
      .withExactArgs({
        type: payload.type,
        course: courseId,
        message: payload.content,
        sender: credentials._id,
        missingPhones: ['poiuytrewq'],
      })
      .returns();

    await CourseHelper.sendSMS(courseId, payload, credentials);

    sinon.assert.calledWith(
      sendStub.getCall(0),
      {
        recipient: `+33${trainees[0].contact.phone.substring(1)}`,
        sender: 'Compani',
        content: payload.content,
        tag: COURSE_SMS,
      }
    );
    sinon.assert.calledWithExactly(
      sendStub.getCall(1),
      {
        recipient: `+33${trainees[1].contact.phone.substring(1)}`,
        sender: 'Compani',
        content: payload.content,
        tag: COURSE_SMS,
      }
    );
    CourseMock.verify();
    CourseSmsHistoryMock.verify();
    UserMock.verify();
  });
});

describe('getSMSHistory', () => {
  const courseId = new ObjectID();
  const sms = [{ type: 'convocation', message: 'Hello, this is a test' }];
  let CourseSmsHistoryMock;
  beforeEach(() => {
    CourseSmsHistoryMock = sinon.mock(CourseSmsHistory);
  });
  afterEach(() => {
    CourseSmsHistoryMock.restore();
  });

  it('should get SMS history', async () => {
    CourseSmsHistoryMock.expects('find')
      .withExactArgs({ course: courseId })
      .chain('populate')
      .withExactArgs({ path: 'sender', select: 'identity.firstname identity.lastname' })
      .chain('populate')
      .withExactArgs({ path: 'missingPhones', select: 'identity.firstname identity.lastname' })
      .chain('lean')
      .returns(sms);

    const result = await CourseHelper.getSMSHistory(courseId);

    expect(result).toEqual(sms);
    CourseSmsHistoryMock.verify();
  });
});

describe('addCourseTrainee', () => {
  let CourseMock;
  let RoleMock;
  let createUserStub;
  let updateUserStub;
  let createHistoryOnTraineeAddition;
  beforeEach(() => {
    CourseMock = sinon.mock(Course, 'CourseMock');
    RoleMock = sinon.mock(Role, 'RoleMock');
    createUserStub = sinon.stub(UsersHelper, 'createUser');
    updateUserStub = sinon.stub(UsersHelper, 'updateUser');
    createHistoryOnTraineeAddition = sinon.stub(CourseHistoriesHelper, 'createHistoryOnTraineeAddition');
  });
  afterEach(() => {
    CourseMock.restore();
    RoleMock.restore();
    createUserStub.restore();
    updateUserStub.restore();
    createHistoryOnTraineeAddition.restore();
  });
  const addedBy = { _id: new ObjectID() };

  it('should add a course trainee using existing user', async () => {
    const user = { _id: new ObjectID(), company: new ObjectID() };
    const course = { _id: new ObjectID(), misc: 'Test' };
    const payload = { local: { email: 'toto@toto.com' } };

    CourseMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: course._id }, { $addToSet: { trainees: user._id } }, { new: true })
      .chain('lean')
      .returns({ ...course, trainee: [user._id] });

    const result = await CourseHelper.addCourseTrainee(course._id, payload, user, addedBy);
    expect(result.trainee).toEqual(expect.arrayContaining([user._id]));
    CourseMock.verify();
    sinon.assert.calledOnceWithExactly(
      createHistoryOnTraineeAddition,
      { course: course._id, traineeId: user._id },
      addedBy._id
    );
    sinon.assert.notCalled(createUserStub);
    sinon.assert.notCalled(updateUserStub);
  });

  it('should add a course trainee creating new user without role', async () => {
    const user = { _id: new ObjectID() };
    const course = { _id: new ObjectID(), misc: 'Test' };
    const payload = { local: { email: 'toto@toto.com' } };

    createUserStub.returns(user);
    RoleMock.expects('findOne').never();
    CourseMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: course._id }, { $addToSet: { trainees: user._id } }, { new: true })
      .chain('lean')
      .returns({ ...course, trainee: [user._id] });

    const result = await CourseHelper.addCourseTrainee(course._id, payload, null, addedBy);
    expect(result.trainee).toEqual(expect.arrayContaining([user._id]));
    CourseMock.verify();
    RoleMock.verify();
    sinon.assert.calledOnceWithExactly(
      createHistoryOnTraineeAddition,
      { course: course._id, traineeId: user._id },
      addedBy._id
    );
    sinon.assert.calledWithExactly(createUserStub, payload);
    sinon.assert.notCalled(updateUserStub);
  });

  it('should add a course trainee, and update it by adding his company', async () => {
    const user = { _id: new ObjectID() };
    const course = { _id: new ObjectID(), misc: 'Test' };
    const payload = { local: { email: 'toto@toto.com' }, company: new ObjectID() };

    CourseMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: course._id }, { $addToSet: { trainees: user._id } }, { new: true })
      .chain('lean')
      .returns({ ...course, trainee: [user._id] });

    const result = await CourseHelper.addCourseTrainee(course._id, payload, user, addedBy);
    expect(result.trainee).toEqual(expect.arrayContaining([user._id]));
    sinon.assert.calledWithExactly(updateUserStub, user._id, { company: payload.company }, null);
    CourseMock.verify();
    sinon.assert.notCalled(createUserStub);
  });
});

describe('registerToELearningCourse', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Course, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should add a course trainee using existing user', async () => {
    const courseId = new ObjectID();
    const credentials = { _id: new ObjectID() };
    await CourseHelper.registerToELearningCourse(courseId, credentials);
    sinon.assert.calledWithExactly(updateOne, { _id: courseId }, { $addToSet: { trainees: credentials._id } });
  });
});

describe('removeCourseTrainee', () => {
  let updateOne;
  let createHistoryOnTraineeDeletion;
  beforeEach(() => {
    updateOne = sinon.stub(Course, 'updateOne');
    createHistoryOnTraineeDeletion = sinon.stub(CourseHistoriesHelper, 'createHistoryOnTraineeDeletion');
  });
  afterEach(() => {
    updateOne.restore();
    createHistoryOnTraineeDeletion.restore();
  });

  it('should remove a course trainee', async () => {
    const course = new ObjectID();
    const traineeId = new ObjectID();
    const removedBy = { _id: new ObjectID() };

    await CourseHelper.removeCourseTrainee(course, traineeId, removedBy);
    sinon.assert.calledWithExactly(updateOne, { _id: course }, { $pull: { trainees: traineeId } });
    sinon.assert.calledOnceWithExactly(createHistoryOnTraineeDeletion, { course, traineeId }, removedBy._id);
  });
});

describe('formatInterCourseSlotsForPdf', () => {
  it('should format slot for pdf', () => {
    const slot = {
      startDate: '2020-03-20T09:00:00',
      endDate: '2020-03-20T11:00:00',
      address: { fullAddress: 'je suis une adress' },
    };

    const result = CourseHelper.formatInterCourseSlotsForPdf(slot);

    expect(result).toEqual({
      address: 'je suis une adress',
      date: '20/03/2020',
      startHour: '09:00',
      endHour: '11:00',
      duration: '2h',
    });
  });
});

describe('getCourseDuration', () => {
  let formatDuration;
  beforeEach(() => {
    formatDuration = sinon.stub(UtilsHelper, 'formatDuration');
  });
  afterEach(() => {
    formatDuration.restore();
  });

  it('should return course duration with minutes', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
      { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
    ];
    formatDuration.returns('4h30');

    const result = CourseHelper.getCourseDuration(slots);

    expect(result).toEqual('4h30');
    sinon.assert.calledOnceWithExactly(formatDuration, moment.duration({ hours: 4, minutes: 30 }));
  });
  it('should return course duration with leading zero minutes', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:08:00' },
      { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:00:00' },
    ];
    formatDuration.returns('4h08');

    const result = CourseHelper.getCourseDuration(slots);

    expect(result).toEqual('4h08');
    sinon.assert.calledOnceWithExactly(formatDuration, moment.duration({ hours: 4, minutes: 8 }));
  });
  it('should return course duration without minutes', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
      { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:00:00' },
    ];
    formatDuration.returns('4h');

    const result = CourseHelper.getCourseDuration(slots);

    expect(result).toEqual('4h');
    sinon.assert.calledOnceWithExactly(formatDuration, moment.duration({ hours: 4 }));
  });
  it('should return course duration with days', () => {
    const slots = [
      { startDate: '2020-03-20T07:00:00', endDate: '2020-03-20T22:00:00' },
      { startDate: '2020-04-21T07:00:00', endDate: '2020-04-21T22:00:00' },
    ];
    formatDuration.returns('30h');

    const result = CourseHelper.getCourseDuration(slots);

    expect(result).toEqual('30h');
    sinon.assert.calledOnceWithExactly(formatDuration, moment.duration({ hours: 30 }));
  });
});

describe('formatIntraCourseForPdf', () => {
  let formatIdentity;
  let getCourseDuration;
  let formatIntraCourseSlotsForPdf;
  beforeEach(() => {
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    getCourseDuration = sinon.stub(CourseHelper, 'getCourseDuration');
    formatIntraCourseSlotsForPdf = sinon.stub(CourseHelper, 'formatIntraCourseSlotsForPdf');
  });
  afterEach(() => {
    formatIdentity.restore();
    getCourseDuration.restore();
    formatIntraCourseSlotsForPdf.restore();
  });

  it('should format course for pdf', () => {
    const course = {
      misc: 'des infos en plus',
      trainer: { identity: { lastname: 'MasterClass' } },
      subProgram: { program: { name: 'programme de formation' } },
      slots: [
        {
          startDate: '2020-03-20T09:00:00',
          endDate: '2020-03-20T11:00:00',
          address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
        },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
        { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00' },
      ],
      company: { name: 'alenvi' },
    };

    getCourseDuration.returns('8h');
    formatIdentity.returns('MasterClass');
    formatIntraCourseSlotsForPdf.onCall(0).returns({ startHour: 'slot1' });
    formatIntraCourseSlotsForPdf.onCall(1).returns({ startHour: 'slot2' });
    formatIntraCourseSlotsForPdf.onCall(2).returns({ startHour: 'slot3' });

    const result = CourseHelper.formatIntraCourseForPdf(course);

    expect(result).toEqual({
      dates: [
        {
          course: {
            name: 'programme de formation - des infos en plus',
            duration: '8h',
            company: 'alenvi',
            trainer: 'MasterClass',
          },
          address: '37 rue de Ponthieu 75008 Paris',
          slots: [{ startHour: 'slot1' }],
          date: '20/03/2020',
        },
        {
          course: {
            name: 'programme de formation - des infos en plus',
            duration: '8h',
            company: 'alenvi',
            trainer: 'MasterClass',
          },
          address: '',
          slots: [{ startHour: 'slot2' }, { startHour: 'slot3' }],
          date: '12/04/2020',
        },
      ],
    });
    sinon.assert.calledOnceWithExactly(getCourseDuration, course.slots);
    sinon.assert.calledOnceWithExactly(formatIdentity, { lastname: 'MasterClass' }, 'FL');
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(0), course.slots[0]);
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(1), course.slots[1]);
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(2), course.slots[2]);
    sinon.assert.callCount(formatIntraCourseSlotsForPdf, 3);
  });
});

describe('formatInterCourseForPdf', () => {
  let formatIdentity;
  let getCourseDuration;
  let formatInterCourseSlotsForPdf;
  beforeEach(() => {
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    getCourseDuration = sinon.stub(CourseHelper, 'getCourseDuration');
    formatInterCourseSlotsForPdf = sinon.stub(CourseHelper, 'formatInterCourseSlotsForPdf');
  });
  afterEach(() => {
    formatIdentity.restore();
    getCourseDuration.restore();
    formatInterCourseSlotsForPdf.restore();
  });

  it('should format course for pdf', () => {
    const course = {
      slots: [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
      ],
      misc: 'des infos en plus',
      trainer: { identity: { lastname: 'MasterClass' } },
      trainees: [
        { identity: { lastname: 'trainee 1' }, company: { name: 'alenvi', tradeName: 'Pfiou' } },
        { identity: { lastname: 'trainee 2' }, company: { name: 'alenvi', tradeName: 'Pfiou' } },
      ],
      subProgram: { program: { name: 'programme de formation' } },
    };
    const sortedSlots = [
      { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
      { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
      { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
    ];
    formatInterCourseSlotsForPdf.returns('slot');
    formatIdentity.onCall(0).returns('Pere Castor');
    formatIdentity.onCall(1).returns('trainee 1');
    formatIdentity.onCall(2).returns('trainee 2');
    getCourseDuration.returns('7h');

    const result = CourseHelper.formatInterCourseForPdf(course);

    expect(result).toEqual({
      trainees: [
        {
          traineeName: 'trainee 1',
          company: 'alenvi',
          course: {
            name: 'programme de formation - des infos en plus',
            slots: ['slot', 'slot', 'slot'],
            trainer: 'Pere Castor',
            firstDate: '20/03/2020',
            lastDate: '21/04/2020',
            duration: '7h',
          },
        },
        {
          traineeName: 'trainee 2',
          company: 'alenvi',
          course: {
            name: 'programme de formation - des infos en plus',
            slots: ['slot', 'slot', 'slot'],
            trainer: 'Pere Castor',
            firstDate: '20/03/2020',
            lastDate: '21/04/2020',
            duration: '7h',
          },
        },
      ],
    });
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'MasterClass' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(2), { lastname: 'trainee 2' }, 'FL');
    sinon.assert.calledOnceWithExactly(getCourseDuration, sortedSlots);
    sinon.assert.callCount(formatInterCourseSlotsForPdf, 3);
  });
});

describe('generateAttendanceSheets', () => {
  let CourseMock;
  let formatInterCourseForPdf;
  let formatIntraCourseForPdf;
  let generatePdf;
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
    formatInterCourseForPdf = sinon.stub(CourseHelper, 'formatInterCourseForPdf');
    formatIntraCourseForPdf = sinon.stub(CourseHelper, 'formatIntraCourseForPdf');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });
  afterEach(() => {
    CourseMock.restore();
    formatInterCourseForPdf.restore();
    formatIntraCourseForPdf.restore();
    generatePdf.restore();
  });

  it('should download attendance sheet for inter b2b course', async () => {
    const courseId = new ObjectID();
    const course = { misc: 'des infos en plus', type: 'inter_b2b' };
    CourseMock.expects('findOne')
      .withExactArgs({ _id: courseId })
      .chain('populate')
      .withExactArgs('company')
      .chain('populate')
      .withExactArgs('slots')
      .chain('populate')
      .withExactArgs({ path: 'trainees', populate: { path: 'company', select: 'name' } })
      .chain('populate')
      .withExactArgs('trainer')
      .chain('populate')
      .withExactArgs({ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } })
      .chain('lean')
      .once()
      .returns(course);
    formatInterCourseForPdf.returns({ name: 'la formation - des infos en plus' });
    generatePdf.returns('pdf');

    await CourseHelper.generateAttendanceSheets(courseId);

    sinon.assert.calledOnceWithExactly(formatInterCourseForPdf, course);
    sinon.assert.notCalled(formatIntraCourseForPdf);
    sinon.assert.calledOnceWithExactly(
      generatePdf,
      { name: 'la formation - des infos en plus' },
      './src/data/interAttendanceSheet.html'
    );
  });

  it('should download attendance sheet for intra course', async () => {
    const courseId = new ObjectID();
    const course = { misc: 'des infos en plus', type: 'intra' };
    CourseMock.expects('findOne')
      .withExactArgs({ _id: courseId })
      .chain('populate')
      .withExactArgs('company')
      .chain('populate')
      .withExactArgs('slots')
      .chain('populate')
      .withExactArgs({ path: 'trainees', populate: { path: 'company', select: 'name' } })
      .chain('populate')
      .withExactArgs('trainer')
      .chain('populate')
      .withExactArgs({ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } })
      .chain('lean')
      .once()
      .returns(course);
    formatIntraCourseForPdf.returns({ name: 'la formation - des infos en plus' });
    generatePdf.returns('pdf');

    await CourseHelper.generateAttendanceSheets(courseId);

    sinon.assert.calledOnceWithExactly(formatIntraCourseForPdf, course);
    sinon.assert.notCalled(formatInterCourseForPdf);
    sinon.assert.calledOnceWithExactly(
      generatePdf,
      { name: 'la formation - des infos en plus' },
      './src/data/intraAttendanceSheet.html'
    );
  });
});

describe('formatCourseForDocx', () => {
  let getCourseDuration;
  beforeEach(() => {
    getCourseDuration = sinon.stub(CourseHelper, 'getCourseDuration');
  });
  afterEach(() => {
    getCourseDuration.restore();
  });

  it('should format course for docx', () => {
    const course = {
      slots: [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
      ],
      subProgram: { program: { description: 'Apprendre', name: 'nom du programme' } },
    };
    getCourseDuration.returns('7h');

    const result = CourseHelper.formatCourseForDocx(course);

    expect(result).toEqual({
      duration: '7h',
      description: course.subProgram.program.description,
      startDate: '20/03/2020',
      endDate: '21/04/2020',
      programName: 'NOM DU PROGRAMME',
    });
    sinon.assert.calledOnceWithExactly(
      getCourseDuration,
      [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
      ]
    );
  });
});

describe('generateCompletionCertificate', () => {
  let CourseMock;
  let formatCourseForDocx;
  let formatIdentity;
  let createDocx;
  let generateZip;
  let momentFormat;
  let createReadStream;
  let downloadFileById;
  let tmpDir;
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
    formatCourseForDocx = sinon.stub(CourseHelper, 'formatCourseForDocx');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    createDocx = sinon.stub(DocxHelper, 'createDocx');
    generateZip = sinon.stub(ZipHelper, 'generateZip');
    momentFormat = sinon.stub(momentProto, 'format').returns('20/01/2020');
    createReadStream = sinon.stub(fs, 'createReadStream');
    downloadFileById = sinon.stub(Drive, 'downloadFileById');
    tmpDir = sinon.stub(os, 'tmpdir').returns('/path');
  });
  afterEach(() => {
    CourseMock.restore();
    formatCourseForDocx.restore();
    formatIdentity.restore();
    createDocx.restore();
    generateZip.restore();
    momentFormat.restore();
    createReadStream.restore();
    downloadFileById.restore();
    tmpDir.restore();
  });

  it('should download completion certificates', async () => {
    const courseId = new ObjectID();
    const readable1 = new PassThrough();
    const readable2 = new PassThrough();
    const readable3 = new PassThrough();
    const course = {
      trainees: [
        { identity: { lastname: 'trainee 1' } },
        { identity: { lastname: 'trainee 2' } },
        { identity: { lastname: 'trainee 3' } },
      ],
      misc: 'Bonjour je suis une formation',
    };
    const formattedCourse = { program: { description: 'Apprendre', name: 'nom du programme' }, courseDuration: '8h' };
    CourseMock.expects('findOne')
      .withExactArgs({ _id: courseId })
      .chain('populate')
      .withExactArgs('slots')
      .chain('populate')
      .withExactArgs('trainees')
      .chain('populate')
      .withExactArgs({
        path: 'subProgram',
        select: 'program',
        populate: { path: 'program', select: 'name description' },
      })
      .chain('lean')
      .once()
      .returns(course);
    formatCourseForDocx.returns(formattedCourse);
    createDocx.onCall(0).returns('1.docx');
    createDocx.onCall(1).returns('2.docx');
    createDocx.onCall(2).returns('3.docx');
    momentFormat.returns('20/01/2020');
    formatIdentity.onCall(0).returns('trainee 1');
    formatIdentity.onCall(1).returns('trainee 2');
    formatIdentity.onCall(2).returns('trainee 3');
    createReadStream.onCall(0).returns(readable1);
    createReadStream.onCall(1).returns(readable2);
    createReadStream.onCall(2).returns(readable3);

    await CourseHelper.generateCompletionCertificates(courseId);

    sinon.assert.calledOnceWithExactly(formatCourseForDocx, course);
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'trainee 2' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(2), { lastname: 'trainee 3' }, 'FL');
    sinon.assert.calledWithExactly(
      createDocx.getCall(0),
      '/path/certificate_template.docx',
      { ...formattedCourse, traineeIdentity: 'trainee 1', date: '20/01/2020' }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(1),
      '/path/certificate_template.docx',
      { ...formattedCourse, traineeIdentity: 'trainee 2', date: '20/01/2020' }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(2),
      '/path/certificate_template.docx',
      { ...formattedCourse, traineeIdentity: 'trainee 3', date: '20/01/2020' }
    );
    sinon.assert.calledOnceWithExactly(
      generateZip,
      'attestations.zip',
      [
        { name: 'Attestation - trainee 1.docx', file: readable1 },
        { name: 'Attestation - trainee 2.docx', file: readable2 },
        { name: 'Attestation - trainee 3.docx', file: readable3 },
      ]
    );
    sinon.assert.calledWithExactly(createReadStream.getCall(0), '1.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(1), '2.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(2), '3.docx');
    sinon.assert.calledOnceWithExactly(downloadFileById, {
      fileId: process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID,
      tmpFilePath: '/path/certificate_template.docx',
    });
    CourseMock.verify();
  });
});

describe('addAccessRule', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Course, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should add access rule to course', async () => {
    const courseId = new ObjectID();
    const payload = { company: new ObjectID() };

    await CourseHelper.addAccessRule(courseId, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: courseId }, { $push: { accessRules: payload.company } });
  });
});
