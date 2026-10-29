const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const SinonMongoose = require('../sinonMongoose');
const Attendance = require('../../../src/models/Attendance');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const TrainingContract = require('../../../src/models/TrainingContract');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CompletionCertificatesHelper = require('../../../src/helpers/completionCertificates');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const CoursesHelper = require('../../../src/helpers/courses');
const HourlyPaymentPlansHelper = require('../../../src/helpers/hourlyPaymentPlans');
const CourseSlotsHelper = require('../../../src/helpers/courseSlots');
const CompletionCertificatePdf = require('../../../src/data/pdf/completionCertificate');
const { OFFICIAL, BLENDED, E_LEARNING, PRESENT, MM_YYYY, MONTH } = require('../../../src/helpers/constants');
const UtilsHelper = require('../../../src/helpers/utils');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');
const { CompaniDuration } = require('../../../src/helpers/dates/companiDurations');
const UtilsMock = require('../../utilsMock');

describe('list', () => {
  let findCompletionCertificates;

  beforeEach(() => {
    findCompletionCertificates = sinon.stub(CompletionCertificate, 'find');
  });

  afterEach(() => {
    findCompletionCertificates.restore();
  });

  it('should get completion certificates for specified months (months is an array)', async () => {
    const query = { months: ['06_2024', '07_2024'] };
    const credentials = { _id: new ObjectId(), role: { vendor: { name: 'training_organisation_manager' } } };

    const trainee = { identity: { firstname: 'Pop', lastname: 'CORN' } };
    const completionCertificates = [
      {
        course: {
          companies: [{ name: 'Pepsi', holding: { name: 'Coca Cola' } }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '06_2024',
      },
      {
        course: {
          companies: [{ name: 'Orangina' }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '07_2024',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'sort', 'setOptions', 'lean'])
    );

    const result = await CompletionCertificatesHelper.list(query, credentials);

    expect(result).toEqual(completionCertificates);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ month: { $in: ['06_2024', '07_2024'] } }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'companies subProgram misc tradeName',
              populate: [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: ' _id' } },
            },
          ]],
        },
        { query: 'sort', args: [{ createdAt: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
  });

  it('should get completion certificates for a specified month (months is a string)', async () => {
    const query = { months: '06_2024' };
    const credentials = { _id: new ObjectId(), role: { vendor: { name: 'training_organisation_manager' } } };

    const trainee = { identity: { firstname: 'Pop', lastname: 'CORN' } };
    const completionCertificates = [
      {
        course: {
          companies: [{ name: 'Pepsi', holding: { name: 'Coca Cola' } }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '06_2024',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'sort', 'setOptions', 'lean'])
    );

    const result = await CompletionCertificatesHelper.list(query, credentials);

    expect(result).toEqual(completionCertificates);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ month: { $in: ['06_2024'] } }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'companies subProgram misc tradeName',
              populate: [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: ' _id' } },
            },
          ]],
        },
        { query: 'sort', args: [{ createdAt: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
  });

  it('should get completion certificates for a specific course', async () => {
    const courseId = new ObjectId();
    const credentials = { _id: new ObjectId(), role: { vendor: { name: 'training_organisation_manager' } } };

    const trainee = { identity: { firstname: 'Pop', lastname: 'CORN' } };
    const completionCertificates = [
      {
        course: {
          _id: courseId,
          companies: [{ name: 'Alenvi' }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '06_2024',
      },
      {
        course: {
          _id: courseId,
          companies: [{ name: 'Alenvi' }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '07_2024',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'sort', 'setOptions', 'lean'])
    );

    const query = { course: courseId };
    const result = await CompletionCertificatesHelper.list(query, credentials);

    expect(result).toEqual(completionCertificates);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ course: courseId }] },
        {
          query: 'populate',
          args: [[{
            path: 'trainee',
            select: 'identity',
            populate: { path: 'company', populate: { path: 'company', select: ' _id' } },
          }]],
        },
        { query: 'sort', args: [{ createdAt: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
  });

  it('should get completion certificates for a specified company (with month)', async () => {
    const companyIds = [new ObjectId(), new ObjectId()];
    const credentials = { _id: new ObjectId(), role: { client: { name: 'coach' } }, company: { _id: companyIds[0] } };

    const completionCertificates = [
      {
        course: {
          companies: [{ _id: companyIds[0] }],
          subProgram: { program: { name: 'program 1' } },
          misc: 'course',
        },
        trainee: { identity: { firstname: 'Rick', lastname: 'SANCHEZ' }, company: { _id: companyIds[0] } },
        month: '08_2025',
        file: 'url/to/file.pdf',
      },
      {
        course: {
          companies: [{ _id: companyIds[1] }],
          subProgram: { program: { name: 'program 1' } },
          misc: 'course',
        },
        trainee: { identity: { firstname: 'Austin', lastname: 'BUTLER' }, company: { _id: companyIds[1] } },
        month: '08_2025',
        file: 'url/to/file.pdf',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'sort', 'setOptions', 'lean'])
    );

    const query = { months: '08_2025', companies: companyIds[0] };
    const result = await CompletionCertificatesHelper.list(query, credentials);

    expect(result).toEqual([completionCertificates[0]]);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ month: { $in: ['08_2025'] } }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'companies subProgram misc tradeName',
              populate: [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: ' _id' } },
            },
          ]],
        },
        { query: 'sort', args: [{ createdAt: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: false, requestingOwnInfos: true }] },
        { query: 'lean' },
      ]
    );
  });

  it('should get completion certificates for holding_admin', async () => {
    const companyIds = [new ObjectId(), new ObjectId()];
    const credentials = {
      _id: new ObjectId(),
      role: { client: 'admin', holding: 'holding_admin' },
      company: { _id: companyIds[0] },
      holding: { _id: new ObjectId(), companies: companyIds },
    };

    const completionCertificates = [
      {
        course: {
          companies: [{ _id: companyIds[0] }, { _id: companyIds[1] }],
          subProgram: { program: { name: 'program 1' } },
          misc: 'course',
        },
        trainee: { identity: { firstname: 'Morty', lastname: 'SMITH' }, company: { _id: companyIds[0] } },
        month: '09_2025',
        file: 'url/to/file.pdf',
      },
      {
        course: {
          companies: [{ _id: companyIds[0] }, { _id: companyIds[1] }],
          subProgram: { program: { name: 'program 1' } },
          misc: 'course',
        },
        trainee: { identity: { firstname: 'Austin', lastname: 'BUTLER' }, company: { _id: companyIds[1] } },
        month: '09_2025',
        file: 'url/to/file.pdf',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'sort', 'setOptions', 'lean'])
    );

    const query = { months: '09_2025', companies: companyIds };
    const result = await CompletionCertificatesHelper.list(query, credentials);

    expect(result).toEqual(completionCertificates);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ month: { $in: ['09_2025'] } }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'companies subProgram misc tradeName',
              populate: [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: ' _id' } },
            },
          ]],
        },
        { query: 'sort', args: [{ createdAt: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: false, requestingOwnInfos: true }] },
        { query: 'lean' },
      ]
    );
  });

  it('should get completion certificates for a specific company (with course)', async () => {
    const courseId = new ObjectId();
    const companyIds = [new ObjectId(), new ObjectId()];
    const credentials = { _id: new ObjectId(), role: { client: { name: 'coach' } }, company: { _id: companyIds[0] } };

    const completionCertificates = [
      {
        course: {
          _id: courseId,
          companies: [{ _id: companyIds[0] }, { _id: companyIds[1] }],
          subProgram: { program: { name: 'program 1' } },
          misc: 'course',
        },
        trainee: { identity: { firstname: 'Stan', lastname: 'SMITH' }, company: { _id: companyIds[0] } },
        month: '07_2025',
        file: 'url/to/file.pdf',
      },
      {
        course: {
          _id: courseId,
          companies: [{ _id: companyIds[0] }, { _id: companyIds[1] }],
          subProgram: { program: { name: 'program 2' } },
          misc: 'course',
        },
        trainee: { identity: { firstname: 'Francine', lastname: 'SMITH' }, company: { _id: companyIds[0] } },
        month: '08_2025',
        file: 'url/to/file2.pdf',
      },
      {
        course: {
          _id: courseId,
          companies: [{ _id: companyIds[0] }, { _id: companyIds[1] }],
          subProgram: { program: { name: 'program 2' } },
          misc: 'course',
        },
        trainee: { identity: { firstname: 'Austin', lastname: 'BUTLER' }, company: { _id: companyIds[1] } },
        month: '08_2025',
        file: 'url/to/file2.pdf',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'sort', 'setOptions', 'lean'])
    );

    const query = { course: courseId, companies: companyIds[0] };
    const result = await CompletionCertificatesHelper.list(query, credentials);

    expect(result).toEqual([completionCertificates[0], completionCertificates[1]]);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ course: courseId }] },
        {
          query: 'populate',
          args: [[{
            path: 'trainee',
            select: 'identity',
            populate: { path: 'company', populate: { path: 'company', select: ' _id' } },
          }]],
        },
        { query: 'sort', args: [{ createdAt: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: false, requestingOwnInfos: true }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('generate', () => {
  let findOneCompletionCertificate;
  let findCompletionCertificate;
  let findOneTrainingContract;
  let findAttendance;
  let formatIdentity;
  let getPdf;
  let uploadCourseFile;
  let updateOne;
  let findActivityHistories;
  let getDurationPerStep;
  let courseFind;
  let getELearningDuration;
  let getRealELearningDuration;
  let findBills;
  let updateManyBills;
  let getPriceFromDurations;
  const PRI_SUBPROGRAM_IDS = new ObjectId();
  const stepId = new ObjectId();
  const REAL_ELEARNING_DURATION_SUBPROGRAM_ID = new ObjectId();

  beforeEach(() => {
    findOneCompletionCertificate = sinon.stub(CompletionCertificate, 'findOne');
    findCompletionCertificate = sinon.stub(CompletionCertificate, 'find');
    findOneTrainingContract = sinon.stub(TrainingContract, 'findOne');
    findAttendance = sinon.stub(Attendance, 'find');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    getPdf = sinon.stub(CompletionCertificatePdf, 'getPdf');
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    updateOne = sinon.stub(CompletionCertificate, 'updateOne');
    UtilsMock.mockCurrentDate('2025-03-24T10:00:00.000Z');
    findActivityHistories = sinon.stub(ActivityHistory, 'find');
    getDurationPerStep = sinon.stub(CourseSlotsHelper, 'getDurationPerStep');
    courseFind = sinon.stub(Course, 'find');
    getELearningDuration = sinon.stub(CoursesHelper, 'getELearningDuration');
    getRealELearningDuration = sinon.stub(CoursesHelper, 'getRealELearningDuration');
    findBills = sinon.stub(CourseBill, 'find');
    updateManyBills = sinon.stub(CourseBill, 'updateMany');
    getPriceFromDurations = sinon.stub(HourlyPaymentPlansHelper, 'getPriceFromDurations');
    process.env.VAEI_SUBPROGRAM_IDS = REAL_ELEARNING_DURATION_SUBPROGRAM_ID;
    process.env.PRI_SUBPROGRAM_IDS = PRI_SUBPROGRAM_IDS;
    process.env.REAL_ELEARNING_DURATION_SUBPROGRAM_IDS = REAL_ELEARNING_DURATION_SUBPROGRAM_ID;
    process.env.VAE_SUPPORT_CONFIGS = `${REAL_ELEARNING_DURATION_SUBPROGRAM_ID}:14:12`;
  });

  afterEach(() => {
    findOneCompletionCertificate.restore();
    findCompletionCertificate.restore();
    findOneTrainingContract.restore();
    findAttendance.restore();
    formatIdentity.restore();
    getPdf.restore();
    uploadCourseFile.restore();
    updateOne.restore();
    UtilsMock.unmockCurrentDate();
    findActivityHistories.restore();
    getDurationPerStep.restore();
    courseFind.restore();
    getELearningDuration.restore();
    getRealELearningDuration.restore();
    findBills.restore();
    updateManyBills.restore();
    getPriceFromDurations.restore();
    process.env.VAEI_SUBPROGRAM_IDS = '';
    process.env.PRI_SUBPROGRAM_IDS = '';
    process.env.REAL_ELEARNING_DURATION_SUBPROGRAM_IDS = '';
    process.env.VAE_SUPPORT_CONFIGS = '';
  });

  it('should generate completion certificate (with theoretical elearning duration) (and add bill price)', async () => {
    const completionCertificateId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const courseId = new ObjectId();
    const month = '03-2025';
    const hourlyPaymentPlan = { _id: new ObjectId(), prices: [{ step: stepId, hourlyAmount: 40 }] };
    const billId = new ObjectId();
    const durationPerStep = { [stepId]: CompaniDuration({ minutes: 390 }) };
    const slotList = [
      { _id: new ObjectId(), startDate: '2025-01-20T10:00:00.000Z', endDate: '2025-01-20T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2025-03-14T10:00:00.000Z', endDate: '2025-03-14T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2025-03-20T10:00:00.000Z', endDate: '2025-03-20T14:00:00.000Z' },
    ];
    const activitiesIds = [new ObjectId(), new ObjectId()];
    const activityHistories = [
      {
        _id: new ObjectId(),
        activity: activitiesIds[0],
        user: traineeId,
      },
      {
        _id: new ObjectId(),
        activity: activitiesIds[1],
        user: traineeId,
      },
    ];
    const eLearningStepsWithAH = [
      {
        type: 'e_learning',
        theoreticalDuration: '3h30',
        activities: [
          {
            _id: activitiesIds[0],
            activityHistories: [activityHistories[0]],
          },
          {
            _id: activitiesIds[1],
            activityHistories: [activityHistories[1]],
          },
        ],
      },
    ];
    const subProgramIds = [new ObjectId(), new ObjectId()];
    const completionCertificate = {
      _id: completionCertificateId,
      course: {
        _id: courseId,
        slots: slotList,
        tradeName: 'program',
        subProgram: {
          _id: subProgramIds[0],
          program: { subPrograms: subProgramIds },
          hourlyPaymentPlans: [hourlyPaymentPlan],
          steps: [
            {
              type: E_LEARNING,
              theoreticalDuration: '3h30',
              activities: [activitiesIds[0], activitiesIds[1]],
            },
          ],
        },
        companies: [companyId],
        trainees: [traineeId],
        hourlyPaymentPlan: hourlyPaymentPlan._id,
      },
      month,
      trainee: {
        _id: traineeId,
        identity: { firstname: 'Jean', lastname: 'Saitrien' },
        company: { _id: companyId, name: 'Alenvi' },
      },
    };
    const startOfMonth = '01/03/2025';
    const endOfMonth = '31/03/2025';

    const courseSlotIdsOnMonth = [slotList[1]._id, slotList[2]._id];
    const attendances = [
      { trainee: traineeId, courseSlot: slotList[1]._id, company: companyId },
    ];

    const slotIdsInOtherCourse = [new ObjectId(), new ObjectId()];
    const slotsInOtherCourse = [
      {
        _id: slotIdsInOtherCourse[0],
        startDate: '2025-03-22T07:00:00.000Z',
        endDate: '2025-03-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[0], company: companyId }],
      },
      {
        _id: slotIdsInOtherCourse[1],
        startDate: '2025-02-22T07:00:00.000Z',
        endDate: '2025-02-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[1], company: companyId }],
      },
    ];
    const coursesWithSameProgram = [{
      _id: new ObjectId(),
      format: BLENDED,
      subProgram: {
        _id: subProgramIds[1],
        program: { subPrograms: subProgramIds },
      },
      trainees: [new ObjectId()],
      companies: [companyId],
      slots: slotsInOtherCourse,
    }];

    findOneCompletionCertificate.returns(
      SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'setOptions', 'lean'])
    );
    findCompletionCertificate.returns(SinonMongoose.stubChainedQueries([], ['setOptions', 'lean']));
    findOneTrainingContract.returns(
      SinonMongoose.stubChainedQueries({ startDate: '2025-01-01T00:00:00.000Z' }, ['sort', 'lean'])
    );
    findAttendance.returns(SinonMongoose.stubChainedQueries(attendances, ['setOptions', 'lean']));
    getDurationPerStep.returns(durationPerStep);
    findBills.returns(SinonMongoose.stubChainedQueries([{ _id: billId }], ['setOptions', 'lean']));
    getPriceFromDurations.returns(260);
    courseFind.returns(SinonMongoose.stubChainedQueries(coursesWithSameProgram));
    findActivityHistories.returns(SinonMongoose.stubChainedQueries(activityHistories, ['lean']));
    getELearningDuration.returns('PT3H30M');
    formatIdentity.returns('Jean SAITRIEN');
    getPdf.returns('pdf');
    uploadCourseFile.returns({ publicId: '1234', link: 'tests/1234' });

    await CompletionCertificatesHelper.generate(completionCertificateId);

    SinonMongoose.calledOnceWithExactly(
      findOneCompletionCertificate,
      [
        { query: 'findOne', args: [{ _id: completionCertificateId }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'subProgram slots companies trainees tradeName hourlyPaymentPlan',
              populate: [
                {
                  path: 'slots',
                  select: 'startDate endDate trainers step',
                  options: { sort: { startDate: 1 } },
                  populate: { path: 'step', select: 'durationCountedPerTrainer' },
                },
                {
                  path: 'subProgram',
                  select: 'program steps hourlyPaymentPlans',
                  populate: [
                    { path: 'program', select: 'subPrograms' },
                    { path: 'steps', select: 'activities type theoreticalDuration' },
                  ],
                },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: 'name' } },
            },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findAttendance,
      [
        { query: 'find', args: [{ trainee: traineeId, courseSlot: { $in: courseSlotIdsOnMonth }, status: PRESENT }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findActivityHistories,
      [
        { query: 'find', args: [{ activity: { $in: activitiesIds }, user: traineeId }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getDurationPerStep,
      [slotList[1], { startDate: '2025-03-22T07:00:00.000Z', endDate: '2025-03-22T09:30:00.000Z' }]
    );
    SinonMongoose.calledWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [{
            _id: { $ne: courseId },
            format: BLENDED,
            subProgram: { $in: subProgramIds },
            companies: { $in: [companyId] },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'attendances startDate endDate step trainers',
            populate: [{
              path: 'attendances',
              match: { company: { $in: [companyId] }, trainee: { $in: [traineeId] }, status: PRESENT },
              options: { isVendorUser: true },
            }, { path: 'step', select: 'durationCountedPerTrainer' }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getELearningDuration,
      eLearningStepsWithAH,
      traineeId,
      { startDate: '2025-02-28T23:00:00.000Z', endDate: '2025-03-31T21:59:59.999Z' }
    );
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstname: 'Jean', lastname: 'Saitrien' }, 'FL');
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        trainee: {
          identity: 'Jean SAITRIEN',
          attendanceDuration: '6h30',
          eLearningDuration: '3h30',
          companyName: 'Alenvi',
        },
        startDate: startOfMonth,
        endDate: endOfMonth,
        date: '24/03/2025',
        isVAEISubProgram: false,
        isPRISubProgram: false,
        certificateGenerationModeIsMonthly: true,
        programName: 'PROGRAM',
        trainingContractStartDate: '01/01/2025',
      },
      OFFICIAL
    );
    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'certificat_realisation_Jean SAITRIEN_03-2025', file: 'pdf', contentType: 'application/pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: completionCertificateId },
      { $set: { file: { publicId: '1234', link: 'tests/1234' } } }
    );
    sinon.assert.notCalled(getRealELearningDuration);
    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificate,
      [
        {
          query: 'find',
          args: [{ course: courseId, trainee: traineeId, _id: { $ne: completionCertificateId } }, { month: 1 }],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneTrainingContract,
      [
        { query: 'findOne', args: [{ course: courseId, company: companyId }, { startDate: 1 }] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findBills,
      [
        {
          query: 'find',
          args: [
            {
              course: courseId,
              maturityDate: {
                $gte: CompaniDate(month, MM_YYYY).startOf(MONTH).toISO(),
                $lte: CompaniDate(month, MM_YYYY).endOf(MONTH).toISO(),
              },
              'mainFee.price': { $in: [0, null] },
            },
            { _id: 1 },
          ],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(getPriceFromDurations, hourlyPaymentPlan, durationPerStep, 'PT3H30M');
    sinon.assert.calledOnceWithExactly(
      updateManyBills,
      { _id: { $in: [billId] } },
      { $set: { 'mainFee.price': 260 } }
    );
  });

  it('should generate completion certificate (with real elearning duration)', async () => {
    const completionCertificateId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const courseId = new ObjectId();
    const month = '03-2025';
    const slotList = [
      { _id: new ObjectId(), startDate: '2025-01-20T10:00:00.000Z', endDate: '2025-01-20T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2025-03-14T10:00:00.000Z', endDate: '2025-03-14T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2025-03-20T10:00:00.000Z', endDate: '2025-03-20T14:00:00.000Z' },
    ];
    const activitiesIds = [new ObjectId(), new ObjectId()];
    const activityHistories = [
      {
        _id: new ObjectId(),
        activity: activitiesIds[0],
        user: traineeId,
        duration: 'PT100S',
        date: '2025-03-20T10:00:00.000Z',
      },
      {
        _id: new ObjectId(),
        activity: activitiesIds[1],
        user: traineeId,
        duration: 'PT100S',
        date: '2025-02-20T10:00:00.000Z',
      },
    ];
    const subProgramIds = [REAL_ELEARNING_DURATION_SUBPROGRAM_ID, new ObjectId()];
    const completionCertificate = {
      _id: completionCertificateId,
      course: {
        _id: courseId,
        slots: slotList,
        tradeName: 'program',
        subProgram: {
          _id: subProgramIds[0],
          program: { subPrograms: subProgramIds },
          steps: [
            {
              type: E_LEARNING,
              theoreticalDuration: '3h30',
              activities: [activitiesIds[0], activitiesIds[1]],
            },
          ],
        },
        companies: [companyId],
        trainees: [traineeId],
      },
      month,
      trainee: {
        _id: traineeId,
        identity: { firstname: 'Jean', lastname: 'Saitrien' },
        company: { _id: companyId, name: 'Alenvi' },
      },
    };
    const startOfMonth = '01/03/2025';
    const endOfMonth = '31/03/2025';

    const courseSlotIdsOnMonth = [slotList[1]._id, slotList[2]._id];
    const attendances = [
      { trainee: traineeId, courseSlot: slotList[1]._id, company: companyId },
    ];

    const slotIdsInOtherCourse = [new ObjectId(), new ObjectId()];
    const slotsInOtherCourse = [
      {
        _id: slotIdsInOtherCourse[0],
        startDate: '2025-03-22T07:00:00.000Z',
        endDate: '2025-03-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[0], company: companyId }],
      },
      {
        _id: slotIdsInOtherCourse[1],
        startDate: '2025-02-22T07:00:00.000Z',
        endDate: '2025-02-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[1], company: companyId }],
      },
    ];
    const coursesWithSameProgram = [{
      _id: new ObjectId(),
      format: BLENDED,
      subProgram: {
        _id: subProgramIds[1],
        program: { subPrograms: subProgramIds },
      },
      trainees: [new ObjectId()],
      companies: [companyId],
      slots: slotsInOtherCourse,
    }];

    findOneCompletionCertificate.returns(
      SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'setOptions', 'lean'])
    );
    findCompletionCertificate.returns(SinonMongoose.stubChainedQueries([{ month: '02-2025' }], ['setOptions', 'lean']));
    findAttendance.returns(SinonMongoose.stubChainedQueries(attendances, ['setOptions', 'lean']));
    getDurationPerStep.returns({ [stepId]: CompaniDuration({ minutes: 390 }) });
    courseFind.returns(SinonMongoose.stubChainedQueries(coursesWithSameProgram));
    findActivityHistories.returns(SinonMongoose.stubChainedQueries(activityHistories, ['lean']));
    getRealELearningDuration.returns('PT200S');
    formatIdentity.returns('Jean SAITRIEN');
    getPdf.returns('pdf');
    uploadCourseFile.returns({ publicId: '1234', link: 'tests/1234' });

    await CompletionCertificatesHelper.generate(completionCertificateId);

    SinonMongoose.calledOnceWithExactly(
      findOneCompletionCertificate,
      [
        { query: 'findOne', args: [{ _id: completionCertificateId }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'subProgram slots companies trainees tradeName hourlyPaymentPlan',
              populate: [
                {
                  path: 'slots',
                  select: 'startDate endDate trainers step',
                  options: { sort: { startDate: 1 } },
                  populate: { path: 'step', select: 'durationCountedPerTrainer' },
                },
                {
                  path: 'subProgram',
                  select: 'program steps hourlyPaymentPlans',
                  populate: [
                    { path: 'program', select: 'subPrograms' },
                    { path: 'steps', select: 'activities type theoreticalDuration' },
                  ],
                },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: 'name' } },
            },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findAttendance,
      [
        { query: 'find', args: [{ trainee: traineeId, courseSlot: { $in: courseSlotIdsOnMonth }, status: PRESENT }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findActivityHistories,
      [
        { query: 'find', args: [{ activity: { $in: activitiesIds }, user: traineeId }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getDurationPerStep,
      [slotList[1], { startDate: '2025-03-22T07:00:00.000Z', endDate: '2025-03-22T09:30:00.000Z' }]
    );
    SinonMongoose.calledWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [{
            _id: { $ne: courseId },
            format: BLENDED,
            subProgram: { $in: subProgramIds },
            companies: { $in: [companyId] },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'attendances startDate endDate step trainers',
            populate: [
              {
                path: 'attendances',
                match: { company: { $in: [companyId] }, trainee: { $in: [traineeId] }, status: PRESENT },
                options: { isVendorUser: true },
              },
              { path: 'step', select: 'durationCountedPerTrainer' },
            ],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(getRealELearningDuration, [activityHistories[0]]);
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstname: 'Jean', lastname: 'Saitrien' }, 'FL');
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        trainee: {
          identity: 'Jean SAITRIEN',
          attendanceDuration: '6h30',
          eLearningDuration: '0h03',
          companyName: 'Alenvi',
        },
        startDate: startOfMonth,
        endDate: endOfMonth,
        date: '24/03/2025',
        isVAEISubProgram: true,
        isPRISubProgram: false,
        certificateGenerationModeIsMonthly: true,
        programName: 'PROGRAM',
      },
      OFFICIAL
    );
    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'certificat_realisation_Jean SAITRIEN_03-2025', file: 'pdf', contentType: 'application/pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: completionCertificateId },
      { $set: { file: { publicId: '1234', link: 'tests/1234' } } }
    );
    sinon.assert.notCalled(getELearningDuration);
    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificate,
      [
        {
          query: 'find',
          args: [{ course: courseId, trainee: traineeId, _id: { $ne: completionCertificateId } }, { month: 1 }],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findOneTrainingContract);
    sinon.assert.notCalled(findBills);
    sinon.assert.notCalled(updateManyBills);
    sinon.assert.notCalled(getPriceFromDurations);
  });

  it('should generate completion certificate in VAE period (attendance within remaining budget)', async () => {
    const completionCertificateId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const courseId = new ObjectId();
    const month = '03-2026';
    const slotList = [
      { _id: new ObjectId(), startDate: '2025-01-20T10:00:00.000Z', endDate: '2025-01-20T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2026-03-14T10:00:00.000Z', endDate: '2026-03-14T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2026-03-20T10:00:00.000Z', endDate: '2026-03-20T14:00:00.000Z' },
    ];
    const activitiesIds = [new ObjectId(), new ObjectId()];
    const activityHistories = [
      {
        _id: new ObjectId(),
        activity: activitiesIds[0],
        user: traineeId,
        duration: 'PT100S',
        date: '2026-03-20T10:00:00.000Z',
      },
      {
        _id: new ObjectId(),
        activity: activitiesIds[1],
        user: traineeId,
        duration: 'PT100S',
        date: '2026-02-20T10:00:00.000Z',
      },
    ];
    const subProgramIds = [REAL_ELEARNING_DURATION_SUBPROGRAM_ID, new ObjectId()];
    const completionCertificate = {
      _id: completionCertificateId,
      course: {
        _id: courseId,
        slots: slotList,
        tradeName: 'program',
        subProgram: {
          _id: subProgramIds[0],
          program: { subPrograms: subProgramIds },
          steps: [
            {
              type: E_LEARNING,
              theoreticalDuration: '3h30',
              activities: [activitiesIds[0], activitiesIds[1]],
            },
          ],
        },
        companies: [companyId],
        trainees: [traineeId],
      },
      month,
      trainee: {
        _id: traineeId,
        identity: { firstname: 'Jean', lastname: 'Saitrien' },
        company: { _id: companyId, name: 'Alenvi' },
      },
    };
    const startOfMonth = '01/03/2026';
    const endOfMonth = '31/03/2026';

    const courseSlotIdsOnMonth = [slotList[1]._id, slotList[2]._id];
    const attendances = [
      { trainee: traineeId, courseSlot: slotList[1]._id, company: companyId },
    ];

    const slotIdsInOtherCourse = [new ObjectId(), new ObjectId()];
    const slotsInOtherCourse = [
      {
        _id: slotIdsInOtherCourse[0],
        startDate: '2026-03-22T07:00:00.000Z',
        endDate: '2026-03-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[0], company: companyId }],
      },
      {
        _id: slotIdsInOtherCourse[1],
        startDate: '2026-02-22T07:00:00.000Z',
        endDate: '2026-02-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[1], company: companyId }],
      },
    ];
    const coursesWithSameProgram = [{
      _id: new ObjectId(),
      format: BLENDED,
      subProgram: {
        _id: subProgramIds[1],
        program: { subPrograms: subProgramIds },
      },
      trainees: [new ObjectId()],
      companies: [companyId],
      slots: slotsInOtherCourse,
    }];

    findOneCompletionCertificate.returns(
      SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'setOptions', 'lean'])
    );
    findCompletionCertificate.onCall(0).returns(SinonMongoose.stubChainedQueries([], ['setOptions', 'lean']));
    findCompletionCertificate.onCall(1).returns(SinonMongoose.stubChainedQueries([], ['setOptions', 'sort', 'lean']));
    findOneTrainingContract.returns(SinonMongoose.stubChainedQueries(null, ['sort', 'lean']));
    findAttendance.returns(SinonMongoose.stubChainedQueries(attendances, ['setOptions', 'lean']));
    getDurationPerStep.returns({ [stepId]: CompaniDuration({ minutes: 390 }) });
    courseFind.returns(SinonMongoose.stubChainedQueries(coursesWithSameProgram));
    findActivityHistories.returns(SinonMongoose.stubChainedQueries(activityHistories, ['lean']));
    getRealELearningDuration.returns('PT200S');
    formatIdentity.returns('Jean SAITRIEN');
    getPdf.returns('pdf');
    uploadCourseFile.returns({ publicId: '1234', link: 'tests/1234' });

    await CompletionCertificatesHelper.generate(completionCertificateId);

    SinonMongoose.calledOnceWithExactly(
      findOneCompletionCertificate,
      [
        { query: 'findOne', args: [{ _id: completionCertificateId }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'subProgram slots companies trainees tradeName hourlyPaymentPlan',
              populate: [
                {
                  path: 'slots',
                  select: 'startDate endDate trainers step',
                  options: { sort: { startDate: 1 } },
                  populate: { path: 'step', select: 'durationCountedPerTrainer' },
                },
                {
                  path: 'subProgram',
                  select: 'program steps hourlyPaymentPlans',
                  populate: [
                    { path: 'program', select: 'subPrograms' },
                    { path: 'steps', select: 'activities type theoreticalDuration' },
                  ],
                },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: 'name' } },
            },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledWithExactly(
      findCompletionCertificate,
      [
        {
          query: 'find',
          args: [{ course: courseId, trainee: traineeId, _id: { $ne: completionCertificateId } }, { month: 1 }],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findCompletionCertificate,
      [
        {
          query: 'find',
          args: [
            {
              _id: { $ne: completionCertificateId },
              course: courseId,
              trainee: traineeId,
              vaeSupportRemainingMinutes: { $exists: true },
            },
            { vaeSupportRemainingMinutes: 1 },
          ],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'sort', args: [{ vaeSupportRemainingMinutes: 1 }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      findOneTrainingContract,
      [
        { query: 'findOne', args: [{ course: courseId, company: companyId }, { startDate: 1 }] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findAttendance,
      [
        { query: 'find', args: [{ trainee: traineeId, courseSlot: { $in: courseSlotIdsOnMonth }, status: PRESENT }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findActivityHistories,
      [
        { query: 'find', args: [{ activity: { $in: activitiesIds }, user: traineeId }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getDurationPerStep,
      [slotList[1], { startDate: '2026-03-22T07:00:00.000Z', endDate: '2026-03-22T09:30:00.000Z' }]
    );
    SinonMongoose.calledWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [{
            _id: { $ne: courseId },
            format: BLENDED,
            subProgram: { $in: subProgramIds },
            companies: { $in: [companyId] },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'attendances startDate endDate step trainers',
            populate: [{
              path: 'attendances',
              match: { company: { $in: [companyId] }, trainee: { $in: [traineeId] }, status: PRESENT },
              options: { isVendorUser: true },
            }, { path: 'step', select: 'durationCountedPerTrainer' }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(getRealELearningDuration, [activityHistories[0]]);
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstname: 'Jean', lastname: 'Saitrien' }, 'FL');
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        trainee: {
          identity: 'Jean SAITRIEN',
          attendanceDuration: '6h30',
          eLearningDuration: '0h03',
          companyName: 'Alenvi',
        },
        startDate: startOfMonth,
        endDate: endOfMonth,
        date: '24/03/2025',
        isVAEISubProgram: true,
        isPRISubProgram: false,
        certificateGenerationModeIsMonthly: true,
        programName: 'PROGRAM',
        vaeSupportData: { vaeDuration: '6h30', regularDuration: null },
      },
      OFFICIAL
    );
    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'certificat_realisation_Jean SAITRIEN_03-2026', file: 'pdf', contentType: 'application/pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: completionCertificateId },
      { $set: { file: { publicId: '1234', link: 'tests/1234' }, vaeSupportRemainingMinutes: 330 } }
    );
    sinon.assert.notCalled(getELearningDuration);
    sinon.assert.notCalled(findBills);
    sinon.assert.notCalled(updateManyBills);
    sinon.assert.notCalled(getPriceFromDurations);
  });

  it('should generate completion certificate in VAE period (attendance exceeds remaining budget)', async () => {
    const completionCertificateId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const courseId = new ObjectId();
    const month = '03-2026';
    const slotList = [
      { _id: new ObjectId(), startDate: '2024-12-20T10:00:00.000Z', endDate: '2025-01-20T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2026-03-14T10:00:00.000Z', endDate: '2026-03-14T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2026-03-20T10:00:00.000Z', endDate: '2026-03-20T14:00:00.000Z' },
    ];
    const activitiesIds = [new ObjectId(), new ObjectId()];
    const activityHistories = [
      {
        _id: new ObjectId(),
        activity: activitiesIds[0],
        user: traineeId,
        duration: 'PT100S',
        date: '2026-03-20T10:00:00.000Z',
      },
      {
        _id: new ObjectId(),
        activity: activitiesIds[1],
        user: traineeId,
        duration: 'PT100S',
        date: '2026-02-20T10:00:00.000Z',
      },
    ];
    const subProgramIds = [REAL_ELEARNING_DURATION_SUBPROGRAM_ID, new ObjectId()];
    const completionCertificate = {
      _id: completionCertificateId,
      course: {
        _id: courseId,
        slots: slotList,
        tradeName: 'program',
        subProgram: {
          _id: subProgramIds[0],
          program: { subPrograms: subProgramIds },
          steps: [
            {
              type: E_LEARNING,
              theoreticalDuration: '3h30',
              activities: [activitiesIds[0], activitiesIds[1]],
            },
          ],
        },
        companies: [companyId],
        trainees: [traineeId],
      },
      month,
      trainee: {
        _id: traineeId,
        identity: { firstname: 'Jean', lastname: 'Saitrien' },
        company: { _id: companyId, name: 'Alenvi' },
      },
    };
    const startOfMonth = '01/03/2026';
    const endOfMonth = '31/03/2026';

    const courseSlotIdsOnMonth = [slotList[1]._id, slotList[2]._id];
    const attendances = [
      { trainee: traineeId, courseSlot: slotList[1]._id, company: companyId },
    ];

    const slotIdsInOtherCourse = [new ObjectId(), new ObjectId()];
    const slotsInOtherCourse = [
      {
        _id: slotIdsInOtherCourse[0],
        startDate: '2026-03-22T07:00:00.000Z',
        endDate: '2026-03-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[0], company: companyId }],
      },
      {
        _id: slotIdsInOtherCourse[1],
        startDate: '2026-02-22T07:00:00.000Z',
        endDate: '2026-02-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[1], company: companyId }],
      },
    ];
    const coursesWithSameProgram = [{
      _id: new ObjectId(),
      format: BLENDED,
      subProgram: {
        _id: subProgramIds[1],
        program: { subPrograms: subProgramIds },
      },
      trainees: [new ObjectId()],
      companies: [companyId],
      slots: slotsInOtherCourse,
    }];

    findOneCompletionCertificate.returns(
      SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'setOptions', 'lean'])
    );
    findCompletionCertificate.onCall(0).returns(SinonMongoose.stubChainedQueries([], ['setOptions', 'lean']));
    findCompletionCertificate.onCall(1).returns(
      SinonMongoose.stubChainedQueries(
        [{ vaeSupportRemainingMinutes: 240 }, { vaeSupportRemainingMinutes: 340 }],
        ['setOptions', 'sort', 'lean']
      )
    );
    findOneTrainingContract.returns(SinonMongoose.stubChainedQueries(null, ['sort', 'lean']));
    findAttendance.returns(SinonMongoose.stubChainedQueries(attendances, ['setOptions', 'lean']));
    getDurationPerStep.returns({ [stepId]: CompaniDuration({ minutes: 390 }) });
    courseFind.returns(SinonMongoose.stubChainedQueries(coursesWithSameProgram));
    findActivityHistories.returns(SinonMongoose.stubChainedQueries(activityHistories, ['lean']));
    getRealELearningDuration.returns('PT200S');
    formatIdentity.returns('Jean SAITRIEN');
    getPdf.returns('pdf');
    uploadCourseFile.returns({ publicId: '1234', link: 'tests/1234' });

    await CompletionCertificatesHelper.generate(completionCertificateId);

    SinonMongoose.calledOnceWithExactly(
      findOneCompletionCertificate,
      [
        { query: 'findOne', args: [{ _id: completionCertificateId }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'subProgram slots companies trainees tradeName hourlyPaymentPlan',
              populate: [
                {
                  path: 'slots',
                  select: 'startDate endDate trainers step',
                  options: { sort: { startDate: 1 } },
                  populate: { path: 'step', select: 'durationCountedPerTrainer' },
                },
                {
                  path: 'subProgram',
                  select: 'program steps hourlyPaymentPlans',
                  populate: [
                    { path: 'program', select: 'subPrograms' },
                    { path: 'steps', select: 'activities type theoreticalDuration' },
                  ],
                },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: 'name' } },
            },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledWithExactly(
      findCompletionCertificate,
      [
        {
          query: 'find',
          args: [{ course: courseId, trainee: traineeId, _id: { $ne: completionCertificateId } }, { month: 1 }],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findCompletionCertificate,
      [
        {
          query: 'find',
          args: [
            {
              _id: { $ne: completionCertificateId },
              course: courseId,
              trainee: traineeId,
              vaeSupportRemainingMinutes: { $exists: true },
            },
            { vaeSupportRemainingMinutes: 1 },
          ],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'sort', args: [{ vaeSupportRemainingMinutes: 1 }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      findOneTrainingContract,
      [
        { query: 'findOne', args: [{ course: courseId, company: companyId }, { startDate: 1 }] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findAttendance,
      [
        { query: 'find', args: [{ trainee: traineeId, courseSlot: { $in: courseSlotIdsOnMonth }, status: PRESENT }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findActivityHistories,
      [
        { query: 'find', args: [{ activity: { $in: activitiesIds }, user: traineeId }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getDurationPerStep,
      [slotList[1], { startDate: '2026-03-22T07:00:00.000Z', endDate: '2026-03-22T09:30:00.000Z' }]
    );
    SinonMongoose.calledWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [{
            _id: { $ne: courseId },
            format: BLENDED,
            subProgram: { $in: subProgramIds },
            companies: { $in: [companyId] },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'attendances startDate endDate step trainers',
            populate: [{
              path: 'attendances',
              match: { company: { $in: [companyId] }, trainee: { $in: [traineeId] }, status: PRESENT },
              options: { isVendorUser: true },
            }, { path: 'step', select: 'durationCountedPerTrainer' }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(getRealELearningDuration, [activityHistories[0]]);
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstname: 'Jean', lastname: 'Saitrien' }, 'FL');
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        trainee: {
          identity: 'Jean SAITRIEN',
          attendanceDuration: '6h30',
          eLearningDuration: '0h03',
          companyName: 'Alenvi',
        },
        startDate: startOfMonth,
        endDate: endOfMonth,
        date: '24/03/2025',
        isVAEISubProgram: true,
        isPRISubProgram: false,
        certificateGenerationModeIsMonthly: true,
        programName: 'PROGRAM',
        vaeSupportData: { vaeDuration: '4h', regularDuration: '2h30' },
      },
      OFFICIAL
    );
    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'certificat_realisation_Jean SAITRIEN_03-2026', file: 'pdf', contentType: 'application/pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: completionCertificateId },
      { $set: { file: { publicId: '1234', link: 'tests/1234' }, vaeSupportRemainingMinutes: 0 } }
    );
    sinon.assert.notCalled(getELearningDuration);
    sinon.assert.notCalled(findBills);
    sinon.assert.notCalled(updateManyBills);
    sinon.assert.notCalled(getPriceFromDurations);
  });

  it('should generate completion certificate normally when VAE period budget is exhausted', async () => {
    const completionCertificateId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const courseId = new ObjectId();
    const month = '03-2026';
    const slotList = [
      { _id: new ObjectId(), startDate: '2024-12-20T10:00:00.000Z', endDate: '2025-01-20T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2026-03-14T10:00:00.000Z', endDate: '2026-03-14T14:00:00.000Z' },
      { _id: new ObjectId(), startDate: '2026-03-20T10:00:00.000Z', endDate: '2026-03-20T14:00:00.000Z' },
    ];
    const activitiesIds = [new ObjectId(), new ObjectId()];
    const activityHistories = [
      {
        _id: new ObjectId(),
        activity: activitiesIds[0],
        user: traineeId,
        duration: 'PT100S',
        date: '2026-03-20T10:00:00.000Z',
      },
      {
        _id: new ObjectId(),
        activity: activitiesIds[1],
        user: traineeId,
        duration: 'PT100S',
        date: '2026-02-20T10:00:00.000Z',
      },
    ];
    const subProgramIds = [REAL_ELEARNING_DURATION_SUBPROGRAM_ID, new ObjectId()];
    const completionCertificate = {
      _id: completionCertificateId,
      course: {
        _id: courseId,
        slots: slotList,
        tradeName: 'program',
        subProgram: {
          _id: subProgramIds[0],
          program: { subPrograms: subProgramIds },
          steps: [
            {
              type: E_LEARNING,
              theoreticalDuration: '3h30',
              activities: [activitiesIds[0], activitiesIds[1]],
            },
          ],
        },
        companies: [companyId],
        trainees: [traineeId],
      },
      month,
      trainee: {
        _id: traineeId,
        identity: { firstname: 'Jean', lastname: 'Saitrien' },
        company: { _id: companyId, name: 'Alenvi' },
      },
    };
    const startOfMonth = '01/03/2026';
    const endOfMonth = '31/03/2026';

    const courseSlotIdsOnMonth = [slotList[1]._id, slotList[2]._id];
    const attendances = [
      { trainee: traineeId, courseSlot: slotList[1]._id, company: companyId },
    ];

    const slotIdsInOtherCourse = [new ObjectId(), new ObjectId()];
    const slotsInOtherCourse = [
      {
        _id: slotIdsInOtherCourse[0],
        startDate: '2026-03-22T07:00:00.000Z',
        endDate: '2026-03-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[0], company: companyId }],
      },
      {
        _id: slotIdsInOtherCourse[1],
        startDate: '2026-02-22T07:00:00.000Z',
        endDate: '2026-02-22T09:30:00.000Z',
        attendances: [{ trainee: traineeId, courseSlot: slotIdsInOtherCourse[1], company: companyId }],
      },
    ];
    const coursesWithSameProgram = [{
      _id: new ObjectId(),
      format: BLENDED,
      subProgram: {
        _id: subProgramIds[1],
        program: { subPrograms: subProgramIds },
      },
      trainees: [new ObjectId()],
      companies: [companyId],
      slots: slotsInOtherCourse,
    }];

    findOneCompletionCertificate.returns(
      SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'setOptions', 'lean'])
    );
    findCompletionCertificate.onCall(0).returns(SinonMongoose.stubChainedQueries([], ['setOptions', 'lean']));
    findCompletionCertificate.onCall(1).returns(
      SinonMongoose.stubChainedQueries([{ vaeSupportRemainingMinutes: 0 }], ['setOptions', 'sort', 'lean'])
    );
    findOneTrainingContract.returns(SinonMongoose.stubChainedQueries(null, ['sort', 'lean']));
    findAttendance.returns(SinonMongoose.stubChainedQueries(attendances, ['setOptions', 'lean']));
    getDurationPerStep.returns({ [stepId]: CompaniDuration({ minutes: 390 }) });
    courseFind.returns(SinonMongoose.stubChainedQueries(coursesWithSameProgram));
    findActivityHistories.returns(SinonMongoose.stubChainedQueries(activityHistories, ['lean']));
    getRealELearningDuration.returns('PT200S');
    formatIdentity.returns('Jean SAITRIEN');
    getPdf.returns('pdf');
    uploadCourseFile.returns({ publicId: '1234', link: 'tests/1234' });

    await CompletionCertificatesHelper.generate(completionCertificateId);

    SinonMongoose.calledOnceWithExactly(
      findOneCompletionCertificate,
      [
        { query: 'findOne', args: [{ _id: completionCertificateId }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'subProgram slots companies trainees tradeName hourlyPaymentPlan',
              populate: [
                {
                  path: 'slots',
                  select: 'startDate endDate trainers step',
                  options: { sort: { startDate: 1 } },
                  populate: { path: 'step', select: 'durationCountedPerTrainer' },
                },
                {
                  path: 'subProgram',
                  select: 'program steps hourlyPaymentPlans',
                  populate: [
                    { path: 'program', select: 'subPrograms' },
                    { path: 'steps', select: 'activities type theoreticalDuration' },
                  ],
                },
              ],
            },
            {
              path: 'trainee',
              select: 'identity',
              populate: { path: 'company', populate: { path: 'company', select: 'name' } },
            },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledWithExactly(
      findCompletionCertificate,
      [
        {
          query: 'find',
          args: [{ course: courseId, trainee: traineeId, _id: { $ne: completionCertificateId } }, { month: 1 }],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findCompletionCertificate,
      [
        {
          query: 'find',
          args: [
            {
              _id: { $ne: completionCertificateId },
              course: courseId,
              trainee: traineeId,
              vaeSupportRemainingMinutes: { $exists: true },
            },
            { vaeSupportRemainingMinutes: 1 },
          ],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'sort', args: [{ vaeSupportRemainingMinutes: 1 }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      findOneTrainingContract,
      [
        { query: 'findOne', args: [{ course: courseId, company: companyId }, { startDate: 1 }] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findAttendance,
      [
        { query: 'find', args: [{ trainee: traineeId, courseSlot: { $in: courseSlotIdsOnMonth }, status: PRESENT }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findActivityHistories,
      [
        { query: 'find', args: [{ activity: { $in: activitiesIds }, user: traineeId }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getDurationPerStep,
      [slotList[1], { startDate: '2026-03-22T07:00:00.000Z', endDate: '2026-03-22T09:30:00.000Z' }]
    );
    SinonMongoose.calledWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [{
            _id: { $ne: courseId },
            format: BLENDED,
            subProgram: { $in: subProgramIds },
            companies: { $in: [companyId] },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'attendances startDate endDate step trainers',
            populate: [{
              path: 'attendances',
              match: { company: { $in: [companyId] }, trainee: { $in: [traineeId] }, status: PRESENT },
              options: { isVendorUser: true },
            }, { path: 'step', select: 'durationCountedPerTrainer' }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(getRealELearningDuration, [activityHistories[0]]);
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstname: 'Jean', lastname: 'Saitrien' }, 'FL');
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        trainee: {
          identity: 'Jean SAITRIEN',
          attendanceDuration: '6h30',
          eLearningDuration: '0h03',
          companyName: 'Alenvi',
        },
        startDate: startOfMonth,
        endDate: endOfMonth,
        date: '24/03/2025',
        isVAEISubProgram: true,
        isPRISubProgram: false,
        certificateGenerationModeIsMonthly: true,
        programName: 'PROGRAM',
      },
      OFFICIAL
    );
    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'certificat_realisation_Jean SAITRIEN_03-2026', file: 'pdf', contentType: 'application/pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: completionCertificateId },
      { $set: { file: { publicId: '1234', link: 'tests/1234' } } }
    );
    sinon.assert.notCalled(getELearningDuration);
    sinon.assert.notCalled(findBills);
    sinon.assert.notCalled(updateManyBills);
    sinon.assert.notCalled(getPriceFromDurations);
  });
});

describe('create', () => {
  let create;

  beforeEach(() => {
    create = sinon.stub(CompletionCertificate, 'create');
  });

  afterEach(() => {
    create.restore();
  });

  it('should add completion certificate', async () => {
    const payload = { trainee: new ObjectId(), course: new ObjectId(), month: '03-2025' };

    await CompletionCertificatesHelper.create(payload);

    sinon.assert.calledOnceWithExactly(create, payload);
  });
});

describe('deleteFile', () => {
  let findOne;
  let findOneCourse;
  let find;
  let updateOne;
  let updateMany;
  let deleteCourseFile;
  let getUnsubscribedAttendances;
  let getTraineeDurations;
  let getDurationPerStep;
  let getPriceFromDurations;
  let findBills;
  let updateManyBills;
  beforeEach(() => {
    findOne = sinon.stub(CompletionCertificate, 'findOne');
    findOneCourse = sinon.stub(Course, 'findOne');
    find = sinon.stub(CompletionCertificate, 'find');
    updateOne = sinon.stub(CompletionCertificate, 'updateOne');
    updateMany = sinon.stub(CompletionCertificate, 'updateMany');
    deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
    getUnsubscribedAttendances = sinon.stub(CoursesHelper, 'getUnsubscribedAttendances');
    getTraineeDurations = sinon.stub(CoursesHelper, 'getTraineeDurations');
    getDurationPerStep = sinon.stub(CourseSlotsHelper, 'getDurationPerStep');
    getPriceFromDurations = sinon.stub(HourlyPaymentPlansHelper, 'getPriceFromDurations');
    findBills = sinon.stub(CourseBill, 'find');
    updateManyBills = sinon.stub(CourseBill, 'updateMany');
  });
  afterEach(() => {
    findOne.restore();
    findOneCourse.restore();
    find.restore();
    updateOne.restore();
    updateMany.restore();
    deleteCourseFile.restore();
    getUnsubscribedAttendances.restore();
    getTraineeDurations.restore();
    getDurationPerStep.restore();
    getPriceFromDurations.restore();
    findBills.restore();
    updateManyBills.restore();
  });

  it('should remove the file of a completion certificat', async () => {
    const completionCertificateId = new ObjectId();
    const completionCertificate = {
      _id: completionCertificateId,
      trainee: { _id: new ObjectId() },
      course: { _id: new ObjectId() },
      month: '03-2025',
      file: { publicId: 'completionCertificateTest', link: 'test/completionCertificateTest' },
    };
    findOne.returns(SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'lean']));

    await CompletionCertificatesHelper.deleteFile(completionCertificateId);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: completionCertificateId }] },
        {
          query: 'populate',
          args: [{ path: 'course', select: 'hourlyPaymentPlan' }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: completionCertificateId },
      { $unset: { file: '', vaeSupportRemainingMinutes: '' } }
    );
    sinon.assert.calledOnceWithExactly(deleteCourseFile, 'completionCertificateTest');
    sinon.assert.notCalled(find);
    sinon.assert.notCalled(updateMany);
    sinon.assert.notCalled(findOneCourse);
    sinon.assert.notCalled(getUnsubscribedAttendances);
    sinon.assert.notCalled(getTraineeDurations);
    sinon.assert.notCalled(getDurationPerStep);
    sinon.assert.notCalled(getPriceFromDurations);
    sinon.assert.notCalled(findBills);
    sinon.assert.notCalled(updateManyBills);
  });

  it('should remove the file of a completion certificat', async () => {
    const completionCertificateIds = [new ObjectId(), new ObjectId()];
    const traineeId = new ObjectId();
    const courseId = new ObjectId();
    const completionCertificate = {
      _id: completionCertificateIds[0],
      trainee: traineeId,
      course: { _id: courseId },
      month: '03-2025',
      file: { publicId: 'completionCertificateTest', link: 'test/completionCertificateTest' },
      vaeSupportRemainingMinutes: 100,
    };
    const completionCertificatesWithRemaingMinutes = [{
      _id: completionCertificateIds[1],
      trainee: traineeId,
      course: courseId,
      month: '04-2025',
      file: { publicId: 'completionCertificateTest_2', link: 'test/completionCertificateTest_2' },
      vaeSupportRemainingMinutes: 0,
    }];
    findOne.returns(SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'lean']));
    find.returns(SinonMongoose.stubChainedQueries(completionCertificatesWithRemaingMinutes, ['setOptions', 'lean']));

    await CompletionCertificatesHelper.deleteFile(completionCertificateIds[0]);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: completionCertificateIds[0] }] },
        {
          query: 'populate',
          args: [{ path: 'course', select: 'hourlyPaymentPlan' }],
        },
        { query: 'lean' },
      ]
    );

    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId, trainee: traineeId, vaeSupportRemainingMinutes: { $lt: 100 } }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      updateMany,
      { _id: { $in: completionCertificateIds } },
      { $unset: { file: '', vaeSupportRemainingMinutes: '' } }
    );
    sinon.assert.calledWithExactly(deleteCourseFile.getCall(0), 'completionCertificateTest');
    sinon.assert.calledWithExactly(deleteCourseFile.getCall(1), 'completionCertificateTest_2');
    sinon.assert.notCalled(updateOne);
    sinon.assert.notCalled(findOneCourse);
    sinon.assert.notCalled(getUnsubscribedAttendances);
    sinon.assert.notCalled(getTraineeDurations);
    sinon.assert.notCalled(getDurationPerStep);
    sinon.assert.notCalled(getPriceFromDurations);
    sinon.assert.notCalled(findBills);
    sinon.assert.notCalled(updateManyBills);
  });

  it('should remove the real price of the bills and the file of a completion certificat', async () => {
    const completionCertificateId = new ObjectId();
    const courseId = new ObjectId();
    const traineeId = new ObjectId();
    const stepId = new ObjectId();
    const hourlyPaymentPlanId = new ObjectId();
    const hourlyPaymentPlan = { _id: hourlyPaymentPlanId, prices: [{ step: stepId, hourlyAmount: 50 }] };
    const completionCertificate = {
      _id: completionCertificateId,
      month: '03-2025',
      file: { publicId: 'completionCertificateTest', link: 'test/completionCertificateTest' },
      trainee: traineeId,
      course: { _id: courseId, hourlyPaymentPlan: hourlyPaymentPlanId },
    };
    const course = {
      _id: courseId,
      slots: [],
      hourlyPaymentPlan: hourlyPaymentPlanId,
      subProgram: { _id: new ObjectId(), steps: [], hourlyPaymentPlans: [hourlyPaymentPlan] },
    };
    const billId = new ObjectId();
    const eLearningDuration = CompaniDuration('PT3600S');
    const durationPerStep = { [stepId]: CompaniDuration('PT7200S') };

    findOne.returns(SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'lean']));
    getUnsubscribedAttendances.returns([]);
    findOneCourse.returns(SinonMongoose.stubChainedQueries(course, ['populate', 'lean']));
    getTraineeDurations.returns({ slotsWithAttendance: [], eLearningDuration });
    getDurationPerStep.returns(durationPerStep);
    getPriceFromDurations.returns(150);
    findBills.returns(SinonMongoose.stubChainedQueries([{ _id: billId }], ['setOptions', 'lean']));

    await CompletionCertificatesHelper.deleteFile(completionCertificateId);

    sinon.assert.calledOnceWithExactly(getPriceFromDurations, hourlyPaymentPlan, durationPerStep, eLearningDuration);
    sinon.assert.calledOnceWithExactly(updateManyBills, { _id: { $in: [billId] } }, { $set: { 'mainFee.price': 0 } });
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: completionCertificateId },
      { $unset: { file: '', vaeSupportRemainingMinutes: '' } }
    );
    sinon.assert.calledOnceWithExactly(deleteCourseFile, 'completionCertificateTest');
    sinon.assert.callOrder(deleteCourseFile, updateManyBills);
  });

  it('should remove the real price of the bills of every certificate deleted in cascade (VAE)', async () => {
    const courseId = new ObjectId();
    const traineeId = new ObjectId();
    const stepId = new ObjectId();
    const hourlyPaymentPlan = { _id: new ObjectId(), prices: [{ step: stepId, hourlyAmount: 50 }] };
    const completionCertificates = [
      {
        _id: new ObjectId(),
        month: '03-2025',
        trainee: traineeId,
        course: { _id: courseId, hourlyPaymentPlan: hourlyPaymentPlan._id },
        file: { publicId: 'certif_03', link: 'test/certif_03' },
        vaeSupportRemainingMinutes: 100,
      },
      {
        _id: new ObjectId(),
        month: '04-2025',
        trainee: traineeId,
        course: courseId,
        file: { publicId: 'certif_04', link: 'test/certif_04' },
        vaeSupportRemainingMinutes: 0,
      },
    ];
    const course = {
      _id: courseId,
      slots: [],
      hourlyPaymentPlan: hourlyPaymentPlan._id,
      subProgram: { _id: new ObjectId(), steps: [], hourlyPaymentPlans: [hourlyPaymentPlan] },
    };
    const bills = [{ _id: new ObjectId() }, { _id: new ObjectId() }];
    const eLearningDuration = CompaniDuration('PT3600S');
    const durationPerStep = { [stepId]: CompaniDuration('PT7200S') };

    findOne.returns(SinonMongoose.stubChainedQueries(completionCertificates[0], ['populate', 'lean']));
    find.returns(SinonMongoose.stubChainedQueries([completionCertificates[1]], ['setOptions', 'lean']));
    findOneCourse.returns(SinonMongoose.stubChainedQueries(course, ['populate', 'lean']));
    getUnsubscribedAttendances.returns([]);
    getTraineeDurations.returns({ slotsWithAttendance: [], eLearningDuration });
    getDurationPerStep.returns(durationPerStep);
    getPriceFromDurations.onFirstCall().returns(150);
    getPriceFromDurations.onSecondCall().returns(90);
    findBills.onFirstCall().returns(SinonMongoose.stubChainedQueries([bills[0]], ['setOptions', 'lean']));
    findBills.onSecondCall().returns(SinonMongoose.stubChainedQueries([bills[1]], ['setOptions', 'lean']));

    await CompletionCertificatesHelper.deleteFile(completionCertificates[0]._id);

    sinon.assert.calledTwice(getPriceFromDurations);
    sinon.assert.calledTwice(findBills);
    sinon.assert.calledTwice(updateManyBills);
    sinon.assert.calledWithExactly(
      updateManyBills.getCall(0),
      { _id: { $in: [bills[0]._id] } },
      { $set: { 'mainFee.price': 0 } }
    );
    sinon.assert.calledWithExactly(
      updateManyBills.getCall(1),
      { _id: { $in: [bills[1]._id] } },
      { $set: { 'mainFee.price': 0 } }
    );
    sinon.assert.calledTwice(deleteCourseFile);
    sinon.assert.callOrder(deleteCourseFile, updateManyBills);
  });
});
