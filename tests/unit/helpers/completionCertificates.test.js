const sinon = require('sinon');
const { expect } = require('expect');
const { get } = require('lodash');
const { ObjectId } = require('mongodb');
const SinonMongoose = require('../sinonMongoose');
const Attendance = require('../../../src/models/Attendance');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const CompletionCertificatesHelper = require('../../../src/helpers/completionCertificates');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const CoursesHelper = require('../../../src/helpers/courses');
const CompletionCertificatePdf = require('../../../src/data/pdf/completionCertificate');
const { VENDOR_ROLES, OFFICIAL } = require('../../../src/helpers/constants');
const UtilsHelper = require('../../../src/helpers/utils');
const UtilsMock = require('../../utilsMock');
const ActivityHistory = require('../../../src/models/ActivityHistory');

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
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'setOptions', 'lean'])
    );

    const result = await CompletionCertificatesHelper.list(query);

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
              select: 'companies subProgram misc',
              populate: [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              ],
            },
            { path: 'trainee', select: 'identity' },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
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
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'setOptions', 'lean'])
    );

    const result = await CompletionCertificatesHelper.list(query);

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
              select: 'companies subProgram misc',
              populate: [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              ],
            },
            { path: 'trainee', select: 'identity' },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
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
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'setOptions', 'lean'])
    );

    const query = { course: courseId };
    const result = await CompletionCertificatesHelper.list(query);

    expect(result).toEqual(completionCertificates);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ course: courseId }] },
        { query: 'populate', args: [[{ path: 'trainee', select: 'identity' }]] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('generate', () => {
  let findOneCompletionCeritificate;
  let findAttendance;
  let formatIdentity;
  let getPdf;
  let uploadCourseFile;
  let updateOne;
  let findActivityHistories;
  let getTotalDuration;
  let getELearningDuration;
  const VAEI_SUBPROGRAM_IDS = new ObjectId();

  beforeEach(() => {
    findOneCompletionCeritificate = sinon.stub(CompletionCertificate, 'findOne');
    findAttendance = sinon.stub(Attendance, 'find');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    getPdf = sinon.stub(CompletionCertificatePdf, 'getPdf');
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    updateOne = sinon.stub(CompletionCertificate, 'updateOne');
    UtilsMock.mockCurrentDate('2025-03-24T10:00:00.000Z');
    findActivityHistories = sinon.stub(ActivityHistory, 'find');
    getTotalDuration = sinon.stub(UtilsHelper, 'getTotalDuration');
    getELearningDuration = sinon.stub(CoursesHelper, 'getELearningDuration');
    process.env.VAEI_SUBPROGRAM_IDS = VAEI_SUBPROGRAM_IDS;
  });

  afterEach(() => {
    findOneCompletionCeritificate.restore();
    findAttendance.restore();
    formatIdentity.restore();
    getPdf.restore();
    uploadCourseFile.restore();
    updateOne.restore();
    UtilsMock.unmockCurrentDate();
    findActivityHistories.restore();
    getTotalDuration.restore();
    getELearningDuration.restore();
    process.env.VAEI_SUBPROGRAM_IDS = '';
  });

  it('should generate completion certificate', async () => {
    const completionCertificateId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
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
    const completionCertificate = {
      _id: completionCertificateId,
      course: {
        slots: slotList,
        subProgram: {
          _id: new ObjectId(),
          program: { name: 'program' },
          steps: [
            {
              type: 'e_learning',
              theoreticalDuration: '3h30',
              activities: [activitiesIds[0], activitiesIds[1]],
            },
          ],
        },
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
    const attendances = [{ trainee: traineeId, courseSlot: slotList[1]._id, company: companyId }];

    findOneCompletionCeritificate.returns(
      SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'setOptions', 'lean'])
    );
    findAttendance.returns(SinonMongoose.stubChainedQueries(attendances, ['setOptions', 'lean']));
    getTotalDuration.returns('4h00');
    findActivityHistories.returns(SinonMongoose.stubChainedQueries(activityHistories, ['lean']));
    getELearningDuration.returns('PT3H30M');
    formatIdentity.returns('Jean SAITRIEN');
    getPdf.returns('pdf');
    uploadCourseFile.returns({ publicId: '1234', link: 'tests/1234' });

    await CompletionCertificatesHelper.generate(completionCertificateId);

    SinonMongoose.calledOnceWithExactly(
      findOneCompletionCeritificate,
      [
        { query: 'findOne', args: [{ _id: completionCertificateId }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'subProgram slots',
              populate: [
                { path: 'slots', select: 'startDate endDate' },
                {
                  path: 'subProgram',
                  select: 'program steps',
                  populate: [
                    { path: 'program', select: 'name' },
                    {
                      path: 'steps',
                      select: 'activities type theoreticalDuration',
                    },
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
        { query: 'find', args: [{ trainee: traineeId, courseSlot: { $in: courseSlotIdsOnMonth } }] },
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
    sinon.assert.calledOnceWithExactly(getTotalDuration, [slotList[1]]);
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
          attendanceDuration: '4h00',
          eLearningDuration: '3h30',
          companyName: 'Alenvi',
        },
        startDate: startOfMonth,
        endDate: endOfMonth,
        date: '24/03/2025',
        isVAEISubProgram: false,
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
      { file: { publicId: '1234', link: 'tests/1234' } }
    );
  });
});
