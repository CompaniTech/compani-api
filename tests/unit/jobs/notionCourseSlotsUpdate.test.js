const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const notionSdk = require('@notionhq/client');
const SinonMongoose = require('../sinonMongoose');
const Course = require('../../../src/models/Course');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const UtilsHelper = require('../../../src/helpers/utils');
const { notionCourseSlotsUpdateJob } = require('../../../src/jobs/notionCourseSlotsUpdate');

describe('method', () => {
  let findCourses;
  let findActivityHistories;
  let notionMock;
  let originalClientDescriptor;

  const VAEI_SUBPROGRAM_IDS = new ObjectId();
  const PRI_SUBPROGRAM_IDS = new ObjectId();
  const VAE_SUBPROGRAM_IDS = new ObjectId();
  const EVALUATION_STEP_IDS = new ObjectId();
  const CODEV_STEP_IDS = new ObjectId();
  const TRIPARTITE_STEP_IDS = new ObjectId();
  const COACHING_STEP_IDS = new ObjectId();

  // eslint-disable-next-line no-console
  const server = { log: value => console.log(value) };

  beforeEach(() => {
    findCourses = sinon.stub(Course, 'find');
    findActivityHistories = sinon.stub(ActivityHistory, 'find');

    notionMock = { dataSources: { query: sinon.stub() }, pages: { update: sinon.stub().resolves({}) } };
    originalClientDescriptor = Object.getOwnPropertyDescriptor(notionSdk, 'Client');
    Object.defineProperty(notionSdk, 'Client', {
      configurable: true,
      enumerable: true,
      get: () => function MockClient() { return notionMock; },
    });

    process.env.VAEI_SUBPROGRAM_IDS = VAEI_SUBPROGRAM_IDS.toHexString();
    process.env.PRI_SUBPROGRAM_IDS = PRI_SUBPROGRAM_IDS.toHexString();
    process.env.VAE_SUBPROGRAM_IDS = VAE_SUBPROGRAM_IDS.toHexString();
    process.env.EVALUATION_STEP_IDS = EVALUATION_STEP_IDS.toHexString();
    process.env.CODEV_STEP_IDS = CODEV_STEP_IDS.toHexString();
    process.env.TRIPARTITE_STEP_IDS = TRIPARTITE_STEP_IDS.toHexString();
    process.env.COACHING_STEP_IDS = COACHING_STEP_IDS.toHexString();
    process.env.NOTION_TOKEN = 'notion-token';
    process.env.NOTION_TRAINEES_DATABASE = 'notion-db-id';
  });

  afterEach(() => {
    findCourses.restore();
    findActivityHistories.restore();
    Object.defineProperty(notionSdk, 'Client', originalClientDescriptor);
    process.env.VAEI_SUBPROGRAM_IDS = '';
    process.env.PRI_SUBPROGRAM_IDS = '';
    process.env.VAE_SUBPROGRAM_IDS = '';
    process.env.EVALUATION_STEP_IDS = '';
    process.env.CODEV_STEP_IDS = '';
    process.env.TRIPARTITE_STEP_IDS = '';
    process.env.COACHING_STEP_IDS = '';
    process.env.NOTION_TOKEN = '';
    process.env.NOTION_TRAINEES_DATABASE = '';
  });

  it('should update Notion pages for matching trainees, skip courses without trainees, and handle errors', async () => {
    const traineeIds = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
    const activityIds = [new ObjectId(), new ObjectId()];
    const evalStepId = new ObjectId(EVALUATION_STEP_IDS);
    const codevStepId = new ObjectId(CODEV_STEP_IDS);

    const courses = [
      // skipped: no trainees
      {
        _id: new ObjectId(),
        trainees: [],
        subProgram: { steps: [] },
        slots: [],
      },
      // updated: found in Notion, eval 2h + codev 2h, no e-learning
      {
        _id: new ObjectId(),
        trainees: [traineeIds[0]],
        subProgram: {
          steps: [
            { _id: evalStepId, activities: [activityIds[0]] },
            { _id: codevStepId, activities: [activityIds[1]] },
          ],
        },
        slots: [
          { startDate: '2026-01-05T08:00:00.000Z', endDate: '2026-01-05T10:00:00.000Z', step: evalStepId },
          { startDate: '2026-01-06T08:00:00.000Z', endDate: '2026-01-06T10:00:00.000Z', step: codevStepId },
        ],
      },
      // not updated: not found in Notion
      {
        _id: new ObjectId(),
        trainees: [traineeIds[1]],
        subProgram: { steps: [{ _id: codevStepId, activities: [activityIds[1]] }] },
        slots: [{ startDate: '2026-01-07T08:00:00.000Z', endDate: '2026-01-07T09:00:00.000Z', step: codevStepId }],
      },
      // not updated: Notion API throws
      {
        _id: new ObjectId(),
        trainees: [traineeIds[2]],
        subProgram: { steps: [] },
        slots: [],
      },
      // updated: multiple slots on same step (1h + 1.5h eval) + e-learning 0.75h
      {
        _id: new ObjectId(),
        trainees: [traineeIds[3]],
        subProgram: { steps: [{ _id: evalStepId, activities: [activityIds[0]] }] },
        slots: [
          { startDate: '2026-01-08T08:00:00.000Z', endDate: '2026-01-08T09:00:00.000Z', step: evalStepId },
          { startDate: '2026-01-09T08:00:00.000Z', endDate: '2026-01-09T09:30:00.000Z', step: evalStepId },
        ],
      },
    ];

    findCourses.returns(SinonMongoose.stubChainedQueries(courses, ['populate', 'populate', 'lean']));
    // ActivityHistory.find is called once per course with trainees (4 times, course 0 is skipped)
    findActivityHistories.onCall(0).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistories.onCall(1).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistories.onCall(2).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistories.onCall(3).returns(
      SinonMongoose.stubChainedQueries([{ duration: 'PT1800S' }, { duration: 'PT900S' }], ['lean'])
    );

    notionMock.dataSources.query.callsFake(async ({ filter }) => {
      const id = filter.rich_text.equals;
      if (UtilsHelper.areObjectIdsEquals(id, traineeIds[2])) throw new Error('Notion error');
      if (UtilsHelper.doesArrayIncludeId([traineeIds[0], traineeIds[3]], id)) {
        return { results: [{ id: `page-${id}` }] };
      }
      return { results: [] };
    });

    const result = await notionCourseSlotsUpdateJob.method(server);

    expect(result.updatedTraineeIds).toEqual(expect.arrayContaining([traineeIds[0], traineeIds[3]]));
    expect(result.updatedTraineeIds).toHaveLength(2);
    expect(result.notUpdatedTraineeIds).toEqual(expect.arrayContaining([traineeIds[1], traineeIds[2]]));
    expect(result.notUpdatedTraineeIds).toHaveLength(2);

    sinon.assert.calledWithExactly(notionMock.pages.update, {
      page_id: `page-${traineeIds[0].toHexString()}`,
      properties: {
        'Total h diag&eval': { number: 2 },
        'Total h codev': { number: 2 },
        'Total h tripartite': { number: 0 },
        'Total h coaching': { number: 0 },
        'Total h e-learning': { number: 0 },
      },
    });
    sinon.assert.calledWithExactly(notionMock.pages.update, {
      page_id: `page-${traineeIds[3].toHexString()}`,
      properties: {
        'Total h diag&eval': { number: 2.5 },
        'Total h codev': { number: 0 },
        'Total h tripartite': { number: 0 },
        'Total h coaching': { number: 0 },
        'Total h e-learning': { number: 0.75 },
      },
    });
    sinon.assert.callCount(notionMock.pages.update, 2);

    SinonMongoose.calledOnceWithExactly(findCourses, [
      {
        query: 'find',
        args: [{
          subProgram: { $in: [VAEI_SUBPROGRAM_IDS, PRI_SUBPROGRAM_IDS, VAE_SUBPROGRAM_IDS] },
          archivedAt: { $exists: false },
        }],
      },
      { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate step' }] },
      {
        query: 'populate',
        args: [{
          path: 'subProgram',
          select: 'steps subProgram',
          populate: { path: 'steps', select: 'activities' },
        }],
      },
      { query: 'lean', args: [{ virtuals: true }] },
    ]);
  });
});
