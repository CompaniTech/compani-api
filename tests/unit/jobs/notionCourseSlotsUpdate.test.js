const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const notionSdk = require('@notionhq/client');
const SinonMongoose = require('../sinonMongoose');
const Course = require('../../../src/models/Course');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const UtilsHelper = require('../../../src/helpers/utils');
const UtilsMock = require('../../utilsMock');
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

    UtilsMock.mockCurrentDate('2026-02-05T10:00:00.000Z');

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
    UtilsMock.unmockCurrentDate();

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
      // updated: found in Notion — eval 2h (present) + codev 2h (present), all slots in Jan = past month
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
          {
            startDate: '2026-01-05T08:00:00.000Z',
            endDate: '2026-01-05T10:00:00.000Z',
            step: evalStepId,
            attendances: [{ status: 'present' }],
          },
          {
            startDate: '2026-01-06T08:00:00.000Z',
            endDate: '2026-01-06T10:00:00.000Z',
            step: codevStepId,
            attendances: [{ status: 'present' }],
          },
        ],
      },
      // not updated: not found in Notion
      {
        _id: new ObjectId(),
        trainees: [traineeIds[1]],
        subProgram: { steps: [{ _id: codevStepId, activities: [activityIds[1]] }] },
        slots: [{
          startDate: '2026-01-07T08:00:00.000Z',
          endDate: '2026-01-07T09:00:00.000Z',
          step: codevStepId,
          attendances: [{ status: 'present' }],
        }],
      },
      // not updated: Notion API throws
      {
        _id: new ObjectId(),
        trainees: [traineeIds[2]],
        subProgram: { steps: [] },
        slots: [],
      },
      // updated: eval 1h + 1.5h (present, past month) + codev 0.5h (missing) + e-learning 0.75h (past month)
      {
        _id: new ObjectId(),
        trainees: [traineeIds[3]],
        subProgram: { steps: [{ _id: evalStepId, activities: [activityIds[0]] }] },
        slots: [
          {
            startDate: '2026-01-08T08:00:00.000Z',
            endDate: '2026-01-08T09:00:00.000Z',
            step: evalStepId,
            attendances: [{ status: 'present' }],
          },
          {
            startDate: '2026-01-09T08:00:00.000Z',
            endDate: '2026-01-09T09:30:00.000Z',
            step: evalStepId,
            attendances: [{ status: 'present' }],
          },
          {
            startDate: '2026-01-10T08:00:00.000Z',
            endDate: '2026-01-10T08:30:00.000Z',
            step: codevStepId,
            attendances: [{ status: 'missing' }],
          },
        ],
      },
    ];

    findCourses.returns(SinonMongoose.stubChainedQueries(courses, ['populate', 'populate', 'lean']));
    findActivityHistories.onCall(0).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistories.onCall(1).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistories.onCall(2).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistories.onCall(3).returns(SinonMongoose.stubChainedQueries(
      [
        { duration: 'PT1800S', createdAt: '2026-01-15T10:00:00.000Z' },
        { duration: 'PT900S', createdAt: '2026-01-15T10:00:00.000Z' },
      ],
      ['lean']
    ));

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
        'Tot Nb codev': { number: 2 },
        'Total h tripartites': { number: 0 },
        'Total h coaching': { number: 0 },
        'h diag&eval du mois dernier': { number: 2 },
        'Nb codev du mois dernier': { number: 2 },
        'h tripartites du mois dernier': { number: 0 },
        'h coaching du mois dernier': { number: 0 },
        'Total h e-learning': { number: 0 },
        'h e-learning du mois dernier': { number: 0 },
        'Total h absences parcours': { number: 0 },
      },
    });
    sinon.assert.calledWithExactly(notionMock.pages.update, {
      page_id: `page-${traineeIds[3].toHexString()}`,
      properties: {
        'Total h diag&eval': { number: 2.5 },
        'Tot Nb codev': { number: 0 },
        'Total h tripartites': { number: 0 },
        'Total h coaching': { number: 0 },
        'h diag&eval du mois dernier': { number: 2.5 },
        'Nb codev du mois dernier': { number: 0 },
        'h tripartites du mois dernier': { number: 0 },
        'h coaching du mois dernier': { number: 0 },
        'Total h e-learning': { number: 0.75 },
        'h e-learning du mois dernier': { number: 0.75 },
        'Total h absences parcours': { number: 0.5 },
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
      {
        query: 'populate',
        args: [{
          path: 'slots',
          select: 'startDate endDate step attendances',
          populate: { path: 'attendances', options: { isVendorUser: true } },
        }],
      },
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
