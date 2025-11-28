const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const SubProgram = require('../../../src/models/SubProgram');
const Step = require('../../../src/models/Step');
const StepsHelper = require('../../../src/helpers/steps');
const { E_LEARNING, PT0S, PRESENT, MISSING } = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('updateStep', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Step, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should update a step\'s name', async () => {
    const step = { _id: new ObjectId(), name: 'jour' };
    const payload = { name: 'nuit' };

    await StepsHelper.updateStep(step._id, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: step._id }, { $set: payload });
  });
});

describe('addStep', () => {
  let updateOneSupProgram;
  let createStep;

  beforeEach(() => {
    updateOneSupProgram = sinon.stub(SubProgram, 'updateOne');
    createStep = sinon.stub(Step, 'create');
  });

  afterEach(() => {
    updateOneSupProgram.restore();
    createStep.restore();
  });

  it('should create a step', async () => {
    const subProgram = { _id: new ObjectId() };
    const newStep = { name: 'c\'est une étape !', type: 'lesson' };
    const stepId = new ObjectId();
    createStep.returns({ _id: stepId });

    await StepsHelper.addStep(subProgram._id, newStep);

    sinon.assert.calledOnceWithExactly(updateOneSupProgram, { _id: subProgram._id }, { $push: { steps: stepId } });
    sinon.assert.calledOnceWithExactly(createStep, newStep);
  });
});

describe('reuseActivity', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Step, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should push a reused activity', async () => {
    const step = { _id: new ObjectId() };
    const payload = { activities: new ObjectId() };

    await StepsHelper.reuseActivity(step._id, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: step._id }, { $push: payload });
  });
});

describe('detachStep', () => {
  let SubProgramUpdate;

  beforeEach(() => {
    SubProgramUpdate = sinon.stub(SubProgram, 'updateOne');
  });

  afterEach(() => {
    SubProgramUpdate.restore();
  });

  it('remove stepId of subProgram', async () => {
    const stepId = new ObjectId();
    const subProgramId = new ObjectId();

    await StepsHelper.detachStep(subProgramId, stepId);

    sinon.assert.calledWithExactly(SubProgramUpdate, { _id: subProgramId }, { $pull: { steps: stepId } });
  });
});

describe('getElearningStepProgress', () => {
  it('should get elearning steps progress', async () => {
    const step = {
      _id: '5fa159a1795723a10b12825a',
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
    };

    const result = await StepsHelper.getElearningStepProgress(step);
    expect(result).toBe(1);
  });

  it('should return 0 if no activityHistories', async () => {
    const step = {
      _id: '5fa159a1795723a10b12825a',
      activities: [],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
    };

    const result = await StepsHelper.getElearningStepProgress(step);
    expect(result).toBe(0);
  });
});

describe('getLiveStepProgress', () => {
  it('should get live steps progress', async () => {
    const stepId = new ObjectId();

    const slots = [
      { endDate: '2020-11-03T09:00:00.000Z', step: stepId },
      { endDate: '2020-11-04T16:01:00.000Z', step: stepId },
    ];

    const result = await StepsHelper.getLiveStepProgress(slots);
    expect(result).toBe(1);
  });

  it('should return 0 if no slots', async () => {
    const slots = [];

    const result = await StepsHelper.getLiveStepProgress(slots);

    expect(result).toBe(0);
  });
});

describe('getPresenceStepProgress', () => {
  it('should get presence progress', async () => {
    const slots = [
      {
        startDate: '2020-11-03T09:00:00.000Z',
        endDate: '2020-11-03T12:00:00.000Z',
        attendances: [{ _id: new ObjectId(), status: PRESENT }],
      },
      {
        startDate: '2020-11-04T09:00:00.000Z',
        endDate: '2020-11-04T12:00:00.000Z',
        attendances: [{ _id: new ObjectId(), status: MISSING }],
      },
    ];

    const result = StepsHelper.getPresenceStepProgress(slots);
    expect(result).toEqual({ attendanceDuration: 'PT180M', maxDuration: 'PT360M' });
  });

  it('should return presence at 0 if no slot', async () => {
    const slots = [];

    const result = StepsHelper.getPresenceStepProgress(slots);
    expect(result).toEqual({ attendanceDuration: PT0S, maxDuration: PT0S });
  });
});

describe('getProgress', () => {
  let getElearningStepProgress;
  let getLiveStepProgress;
  let getPresenceStepProgress;
  beforeEach(() => {
    getElearningStepProgress = sinon.stub(StepsHelper, 'getElearningStepProgress');
    getLiveStepProgress = sinon.stub(StepsHelper, 'getLiveStepProgress');
    getPresenceStepProgress = sinon.stub(StepsHelper, 'getPresenceStepProgress');
  });
  afterEach(() => {
    getElearningStepProgress.restore();
    getLiveStepProgress.restore();
    getPresenceStepProgress.restore();
  });

  it('should get progress for elearning step', async () => {
    const step = {
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
    };
    getElearningStepProgress.returns(1);

    const result = await StepsHelper.getProgress(step);

    expect(result).toEqual({ eLearning: 1 });
    sinon.assert.calledOnceWithExactly(getElearningStepProgress, step);
    sinon.assert.notCalled(getLiveStepProgress);
    sinon.assert.notCalled(getPresenceStepProgress);
  });

  it('should get progress for only elearning step event if shouldComputePresence is true', async () => {
    const step = {
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
    };
    getElearningStepProgress.returns(1);

    const result = await StepsHelper.getProgress(step, [], true);

    expect(result).toEqual({ eLearning: 1 });
    sinon.assert.calledOnceWithExactly(getElearningStepProgress, step);
    sinon.assert.notCalled(getLiveStepProgress);
    sinon.assert.notCalled(getPresenceStepProgress);
  });

  it('should get progress for live step', async () => {
    const stepId = new ObjectId();
    const step = {
      _id: stepId,
      activities: [],
      name: 'Développer des équipes agiles et autonomes',
      type: 'on_site',
      areActivitiesValid: true,
    };
    const slots = [
      { startDate: '2020-11-03T09:00:00.000Z', endDate: '2020-11-03T12:00:00.000Z', step: stepId, attendances: [] },
      {
        startDate: '2020-11-04T09:00:00.000Z',
        endDate: '2020-11-04T16:01:00.000Z',
        step: stepId,
        attendances: [{ _id: new ObjectId() }],
      },
    ];
    getLiveStepProgress.returns(1);

    const result = await StepsHelper.getProgress(step, slots);

    expect(result).toEqual({ live: 1 });
    sinon.assert.calledOnceWithExactly(getLiveStepProgress, slots);
    sinon.assert.notCalled(getPresenceStepProgress);
  });

  it('should get progress for live and presence', async () => {
    const stepId = new ObjectId();
    const step = {
      _id: stepId,
      activities: [],
      name: 'Développer des équipes agiles et autonomes',
      type: 'on_site',
      areActivitiesValid: true,
    };
    const slots = [
      { startDate: '2020-11-03T09:00:00.000Z', endDate: '2020-11-03T12:00:00.000Z', step: stepId, attendances: [] },
      {
        startDate: '2020-11-04T09:00:00.000Z',
        endDate: '2020-11-04T16:01:00.000Z',
        step: stepId,
        attendances: [{ _id: new ObjectId() }],
      },
    ];
    getLiveStepProgress.returns(1);
    getPresenceStepProgress.returns({ attendanceDuration: 421, maxDuration: 601 });

    const result = await StepsHelper.getProgress(step, slots, true);

    expect(result).toEqual({ live: 1, presence: { attendanceDuration: 421, maxDuration: 601 } });
    sinon.assert.calledOnceWithExactly(getLiveStepProgress, slots);
    sinon.assert.calledOnceWithExactly(getPresenceStepProgress, slots);
  });
});

describe('list', () => {
  let stepFind;
  beforeEach(() => {
    stepFind = sinon.stub(Step, 'find');
  });
  afterEach(() => {
    stepFind.restore();
  });

  it('should return steps linked to program id', async () => {
    const programId = new ObjectId();
    const subProgramId1 = new ObjectId();
    const subProgramId2 = new ObjectId();
    const stepId1 = new ObjectId();
    const stepId2 = new ObjectId();
    const stepId3 = new ObjectId();

    const steps = [
      {
        _id: stepId1,
        name: 'etape 1',
        type: 'on_site',
        subPrograms: [{ _id: subProgramId1, program: { _id: programId } }],
      },
      {
        _id: stepId2,
        name: 'etape 2',
        type: 'remote',
        subPrograms: [{ _id: subProgramId1, program: { _id: new ObjectId() } }],
      },
      {
        _id: stepId3,
        name: 'etape 3',
        type: 'remote',
        subPrograms: [{ _id: subProgramId2, program: { _id: programId } }],
      },
    ];

    stepFind.returns(SinonMongoose.stubChainedQueries(steps, ['populate', 'lean']));

    const result = await StepsHelper.list(programId);

    expect(result).toEqual([
      { _id: stepId1, name: 'etape 1', type: 'on_site' },
      { _id: stepId3, name: 'etape 3', type: 'remote' },
    ]);
    SinonMongoose.calledOnceWithExactly(
      stepFind,
      [
        { query: 'find', args: [] },
        {
          query: 'populate',
          args: [{
            path: 'subPrograms',
            select: 'program -steps',
            populate: { path: 'program', select: '_id' },
          }],
        },
        { query: 'lean' },
      ]
    );
  });
});
