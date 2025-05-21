const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const Step = require('../../../src/models/Step');
const Activity = require('../../../src/models/Activity');
const Course = require('../../../src/models/Course');
const UserCompany = require('../../../src/models/UserCompany');
const SubProgramHelper = require('../../../src/helpers/subPrograms');
const NotificationHelper = require('../../../src/helpers/notifications');
const SinonMongoose = require('../sinonMongoose');
const UtilsMock = require('../../utilsMock');

describe('addSubProgram', () => {
  let updateOne;
  let create;

  beforeEach(() => {
    updateOne = sinon.stub(Program, 'updateOne');
    create = sinon.stub(SubProgram, 'create');
  });

  afterEach(() => {
    updateOne.restore();
    create.restore();
  });

  it('should create a subProgram', async () => {
    const program = { _id: new ObjectId() };
    const newSubProgram = { name: 'nouveau sous programme' };
    const subProgramId = new ObjectId();

    create.returns({ _id: subProgramId });

    await SubProgramHelper.addSubProgram(program._id, newSubProgram);

    sinon.assert.calledOnceWithExactly(create, newSubProgram);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: program._id }, { $push: { subPrograms: subProgramId } });
  });
});

describe('updatedSubProgram', () => {
  let updateOne;
  let findOneAndUpdate;
  let stepUpdateManyStub;
  let activityUpdateManyStub;
  let userCompanyFind;
  let courseCreateStub;
  let sendNewElearningCourseNotification;

  beforeEach(() => {
    updateOne = sinon.stub(SubProgram, 'updateOne');
    findOneAndUpdate = sinon.stub(SubProgram, 'findOneAndUpdate');
    stepUpdateManyStub = sinon.stub(Step, 'updateMany');
    activityUpdateManyStub = sinon.stub(Activity, 'updateMany');
    userCompanyFind = sinon.stub(UserCompany, 'find');
    courseCreateStub = sinon.stub(Course, 'create');
    sendNewElearningCourseNotification = sinon.stub(NotificationHelper, 'sendNewElearningCourseNotification');
    UtilsMock.mockCurrentDate('2025-03-31T14:00:00.000Z');
  });

  afterEach(() => {
    updateOne.restore();
    findOneAndUpdate.restore();
    stepUpdateManyStub.restore();
    activityUpdateManyStub.restore();
    userCompanyFind.restore();
    courseCreateStub.restore();
    sendNewElearningCourseNotification.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should update a subProgram name', async () => {
    const subProgram = { _id: new ObjectId(), name: 'non' };
    const payload = { name: 'si' };

    await SubProgramHelper.updateSubProgram(subProgram._id, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: subProgram._id }, { $set: payload });
    sinon.assert.notCalled(stepUpdateManyStub);
    sinon.assert.notCalled(activityUpdateManyStub);
    sinon.assert.notCalled(userCompanyFind);
    sinon.assert.notCalled(courseCreateStub);
    sinon.assert.notCalled(sendNewElearningCourseNotification);
  });

  describe('update status', () => {
    it('if subProgram is blended, should only update status', async () => {
      const payload = { status: 'published' };
      const subProgram = {
        _id: new ObjectId(),
        name: 'non',
        status: 'draft',
        steps: [new ObjectId(), new ObjectId()],
        isStrictlyELearning: false,
      };
      const activities = [new ObjectId()];
      const updatedSubProgram = {
        ...subProgram,
        status: 'published',
        steps: [
          { _id: subProgram.steps[0], activities, type: 'e_learning' },
          { _id: subProgram.steps[1], activities: [], type: 'on_site' },
        ],
      };

      findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(updatedSubProgram));
      stepUpdateManyStub.returns({ activities });

      await SubProgramHelper.updateSubProgram(subProgram._id, payload);

      sinon.assert.calledWithExactly(
        stepUpdateManyStub,
        { _id: { $in: subProgram.steps } },
        { status: payload.status }
      );
      sinon.assert.calledWithExactly(activityUpdateManyStub, { _id: { $in: activities } }, { status: payload.status });
      SinonMongoose.calledOnceWithExactly(
        findOneAndUpdate,
        [
          { query: 'findOneAndUpdate', args: [{ _id: subProgram._id }, { $set: payload }] },
          { query: 'populate', args: [{ path: 'steps', select: 'activities type' }] },
          { query: 'lean', args: [{ virtuals: true }] },
        ]
      );
      sinon.assert.notCalled(courseCreateStub);
      sinon.assert.notCalled(userCompanyFind);
      sinon.assert.notCalled(sendNewElearningCourseNotification);
    });

    it('if subProgram is strictly e-learning, should also create new course', async () => {
      const payload = { status: 'published' };
      const subProgram = {
        _id: new ObjectId(),
        name: 'non',
        status: 'draft',
        steps: [new ObjectId(), new ObjectId()],
        isStrictlyELearning: true,
      };
      const activities = [new ObjectId()];
      const updatedSubProgram = {
        ...subProgram,
        status: 'published',
        steps: [
          { _id: subProgram.steps[0], activities, type: 'e_learning' },
          { _id: subProgram.steps[1], activities: [], type: 'e_learning' },
        ],
      };
      const course = {
        _id: new ObjectId(),
        subProgram: subProgram._id,
        type: 'inter_b2c',
        format: 'strictly_e_learning',
        accessRules: [],
      };

      findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(updatedSubProgram));
      stepUpdateManyStub.returns({ activities });
      courseCreateStub.returns(course);

      await SubProgramHelper.updateSubProgram(subProgram._id, payload);

      sinon.assert.calledWithExactly(
        stepUpdateManyStub,
        { _id: { $in: subProgram.steps } },
        { status: payload.status }
      );
      sinon.assert.calledWithExactly(activityUpdateManyStub, { _id: { $in: activities } }, { status: payload.status });
      SinonMongoose.calledOnceWithExactly(
        findOneAndUpdate,
        [
          { query: 'findOneAndUpdate', args: [{ _id: subProgram._id }, { $set: { status: payload.status } }] },
          { query: 'populate', args: [{ path: 'steps', select: 'activities type' }] },
          { query: 'lean', args: [{ virtuals: true }] },
        ]
      );
      sinon.assert.calledWithExactly(
        courseCreateStub,
        { subProgram: subProgram._id, type: 'inter_b2c', format: 'strictly_e_learning', accessRules: [] }
      );
      sinon.assert.calledWithExactly(
        sendNewElearningCourseNotification,
        course._id,
        { formationExpoTokenList: { $exists: true, $not: { $size: 0 } } }
      );
      sinon.assert.notCalled(userCompanyFind);
    });

    it('should create course with restricted access if subProgram is strictly e-learning and payload has accessCompany',
      async () => {
        const payload = { status: 'published', accessCompanies: [new ObjectId()] };
        const subProgram = {
          _id: new ObjectId(),
          name: 'non',
          status: 'draft',
          steps: [new ObjectId(), new ObjectId()],
          isStrictlyELearning: true,
        };
        const activities = [new ObjectId()];
        const updatedSubProgram = {
          ...subProgram,
          status: 'published',
          steps: [
            { _id: subProgram.steps[0], activities, type: 'e_learning' },
            { _id: subProgram.steps[1], activities: [], type: 'e_learning' },
          ],
        };
        const course = {
          _id: new ObjectId(),
          subProgram: subProgram._id,
          type: 'inter_b2c',
          format: 'strictly_e_learning',
          accessRules: [payload.accessCompanies],
        };

        const userIds = [new ObjectId(), new ObjectId()];
        const userCompanies = [{ user: userIds[0] }, { user: userIds[1] }];

        findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(updatedSubProgram));
        userCompanyFind.returns(SinonMongoose.stubChainedQueries(userCompanies, ['lean']));
        stepUpdateManyStub.returns({ activities });
        courseCreateStub.returns(course);

        await SubProgramHelper.updateSubProgram(subProgram._id, payload);

        sinon.assert.calledWithExactly(
          stepUpdateManyStub,
          { _id: { $in: subProgram.steps } },
          { status: payload.status }
        );
        sinon.assert.calledWithExactly(
          activityUpdateManyStub,
          { _id: { $in: activities } },
          { status: payload.status }
        );
        SinonMongoose.calledOnceWithExactly(
          findOneAndUpdate,
          [
            { query: 'findOneAndUpdate', args: [{ _id: subProgram._id }, { $set: { status: payload.status } }] },
            { query: 'populate', args: [{ path: 'steps', select: 'activities type' }] },
            { query: 'lean', args: [{ virtuals: true }] },
          ]
        );
        sinon.assert.calledWithExactly(
          courseCreateStub,
          {
            subProgram: subProgram._id,
            type: 'inter_b2c',
            format: 'strictly_e_learning',
            accessRules: [payload.accessCompanies],
          }
        );
        SinonMongoose.calledOnceWithExactly(
          userCompanyFind,
          [
            {
              query: 'find',
              args: [
                {
                  company: payload.accessCompanies,
                  $or: [{ endDate: { $gt: '2025-03-31T14:00:00.000Z' } }, { endDate: { $exists: false } }],
                },
                { user: 1 },
              ],
            },
            { query: 'lean' },
          ]
        );
        sinon.assert.calledWithExactly(
          sendNewElearningCourseNotification,
          course._id,
          { _id: { $in: userIds }, formationExpoTokenList: { $exists: true, $not: { $size: 0 } } }
        );
      });
  });
});

describe('listELearningDraft', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(SubProgram, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return draft subprograms with elearning steps for vendor_admin', async () => {
    const subProgramsList = [
      {
        _id: new ObjectId(),
        status: 'draft',
        steps: [{ type: 'e_learning', theoreticalDuration: 'PT5400S' }],
        isStrictlyELearning: true,
        program: [{ _id: new ObjectId(), name: 'name' }],
      },
      {
        _id: new ObjectId(),
        status: 'draft',
        steps: [{ type: 'on_site' }],
        program: [{ _id: new ObjectId(), name: 'test' }],
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(subProgramsList));

    const result = await SubProgramHelper.listELearningDraft();

    expect(result).toMatchObject([subProgramsList[0]]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ status: 'draft' }] },
        { query: 'populate', args: [{ path: 'program', select: '_id name description image' }] },
        { query: 'populate', args: [{ path: 'steps', select: 'type theoreticalDuration' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return draft subprograms with elearning steps for tester', async () => {
    const testerRestrictedPrograms = [new ObjectId()];
    const subProgramsList = [
      {
        _id: new ObjectId(),
        status: 'draft',
        steps: [{ type: 'e_learning', theoreticalDuration: 'PT5400S' }],
        isStrictlyELearning: true,
        program: [{ _id: new ObjectId(), name: 'name' }],
      },
      {
        _id: new ObjectId(),
        status: 'draft',
        steps: [{ type: 'on_site' }],
        program: [{ _id: new ObjectId(), name: 'test' }],
      },
      {
        _id: new ObjectId(),
        status: 'draft',
        steps: [{ type: 'e_learning' }],
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(subProgramsList));

    const result = await SubProgramHelper.listELearningDraft(testerRestrictedPrograms);

    expect(result).toMatchObject([subProgramsList[0]]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ status: 'draft' }] },
        {
          query: 'populate',
          args: [{
            path: 'program',
            select: '_id name description image',
            match: { _id: { $in: testerRestrictedPrograms } },
          }],
        },
        { query: 'populate', args: [{ path: 'steps', select: 'type theoreticalDuration' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });
});

describe('getSubProgram', () => {
  let findOne;
  beforeEach(() => {
    findOne = sinon.stub(SubProgram, 'findOne');
  });
  afterEach(() => {
    findOne.restore();
  });

  it('should return the requested subprogram', async () => {
    const subProgram = {
      _id: new ObjectId(),
      program: [{
        name: 'program',
        image: 'link',
        steps: [{ _id: new ObjectId(), activities: [{ _id: new ObjectId() }] }],
      }],
    };

    findOne.returns(SinonMongoose.stubChainedQueries(subProgram));

    const result = await SubProgramHelper.getSubProgram(subProgram._id);

    expect(result).toMatchObject(subProgram);
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: subProgram._id }] },
        { query: 'populate', args: [{ path: 'program', select: 'name image' }] },
        { query: 'populate', args: [{ path: 'steps', populate: { path: 'activities' } }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });
});

describe('reuseStep', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(SubProgram, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should link an already existing step to the subProgram', async () => {
    const reusedStepId = new ObjectId();
    const subProgram = {
      _id: new ObjectId(),
      steps: [new ObjectId(), reusedStepId],
    };

    updateOne.returns(subProgram);

    const result = await SubProgramHelper.reuseStep(subProgram._id, { steps: reusedStepId });

    expect(result).toMatchObject(subProgram);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: subProgram._id }, { $push: { steps: reusedStepId } });
  });
});
