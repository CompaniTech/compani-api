const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const SinonMongoose = require('../sinonMongoose');
const Course = require('../../../src/models/Course');
const Attendance = require('../../../src/models/Attendance');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const { INTER_B2B, MONTHLY } = require('../../../src/helpers/constants');
const EmailHelper = require('../../../src/helpers/email');
const CompletionCertificateCreationJob = require('../../../src/jobs/completionCertificateCreation');

describe('completionCertificateCreation', () => {
  let findCourse;
  let findAttendance;
  let findActivityHistory;
  let findOneCompletionCertificate;
  let createCompletionCertificate;
  let completionCertificateCreationEmail;

  beforeEach(() => {
    findCourse = sinon.stub(Course, 'find');
    findAttendance = sinon.stub(Attendance, 'find');
    findActivityHistory = sinon.stub(ActivityHistory, 'find');
    findOneCompletionCertificate = sinon.stub(CompletionCertificate, 'findOne');
    createCompletionCertificate = sinon.stub(CompletionCertificate, 'create');
    completionCertificateCreationEmail = sinon.stub(EmailHelper, 'completionCertificateCreationEmail');
  });

  afterEach(() => {
    findCourse.restore();
    findAttendance.restore();
    findActivityHistory.restore();
    findOneCompletionCertificate.restore();
    createCompletionCertificate.restore();
    completionCertificateCreationEmail.restore();
  });

  it('should create completion certificates for courses with attendances or activity histories on month', async () => {
    const activityIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const slotIds = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
    const traineeIds = [new ObjectId(), new ObjectId()];
    const companyIds = [new ObjectId(), new ObjectId()];
    const courseIds = [new ObjectId(), new ObjectId()];
    const month = '02-2025';

    const courses = [
      {
        _id: courseIds[0],
        misc: 'test',
        type: INTER_B2B,
        hasCertifyingTest: false,
        companies: [{ _id: companyIds[0], name: 'Alenvi' }],
        trainers: [{ _id: new ObjectId(), identity: { lastname: 'For', firstname: 'Matrice' } }],
        trainees: [{ _id: traineeIds[0], identity: { firstname: 'Franck', lastname: 'Moto' } }],
        subProgram: {
          program: { name: 'program' },
          steps: [
            { theoreticalDuration: 'PT7200S', type: 'e_learning', activities: [activityIds[0]] },
            { theoreticalDuration: 'PT7200S', type: 'e_learning', activities: [activityIds[1]] },
          ],
        },
        slots: [
          {
            _id: slotIds[0],
            startDate: '2025-02-12T10:00:00.000Z',
            endDate: '2025-02-12T12:00:00.000Z',
            address: { fullAddress: '3 rue du château' },
          },
          {
            _id: slotIds[1],
            startDate: '2025-03-13T10:00:00.000Z',
            endDate: '2025-03-13T12:00:00.000Z',
            address: { fullAddress: '6 rue du château' },
          },
        ],
      },
      {
        _id: courseIds[1],
        misc: 'test bis',
        type: INTER_B2B,
        hasCertifyingTest: false,
        companies: [{ _id: companyIds[1], name: 'Compani' }],
        trainers: [{ _id: new ObjectId(), identity: { lastname: 'For', firstname: 'Matrice' } }],
        trainees: [{ _id: traineeIds[1], identity: { firstname: 'Franck', lastname: 'Moto' } }],
        subProgram: {
          program: { name: 'program' },
          steps: [
            { theoreticalDuration: 'PT7200S', type: 'e_learning', activities: [activityIds[0]] },
            { theoreticalDuration: 'PT7200S', type: 'e_learning', activities: [activityIds[1], activityIds[2]] },
          ],
        },
        slots: [
          {
            _id: slotIds[2],
            startDate: '2025-02-12T10:00:00.000Z',
            endDate: '2025-02-12T12:00:00.000Z',
            address: { fullAddress: '3 rue du château' },
          },
          {
            _id: slotIds[3],
            startDate: '2025-02-13T10:00:00.000Z',
            endDate: '2025-02-13T12:00:00.000Z',
            address: { fullAddress: '6 rue du château' },
          },
        ],
      },
    ];

    const attendances = [{
      user: traineeIds[0],
      courseSlot: {
        _id: slotIds[0],
        startDate: '2025-02-12T10:00:00.000Z',
        endDate: '2025-02-12T12:00:00.000Z',
        course: courseIds[0],
      },
      company: companyIds[0],
    }];

    const activityHistories = [
      { activity: activityIds[1], user: traineeIds[1] },
      { activity: activityIds[2], user: traineeIds[1] },
    ];

    findCourse.returns(SinonMongoose.stubChainedQueries(courses));
    findAttendance.returns(SinonMongoose.stubChainedQueries(attendances, ['populate', 'setOptions', 'lean']));
    findActivityHistory.returns(SinonMongoose.stubChainedQueries(activityHistories, ['lean']));
    findOneCompletionCertificate.onCall(0).returns(SinonMongoose.stubChainedQueries(undefined, ['setOptions', 'lean']));
    findOneCompletionCertificate.onCall(1).returns(SinonMongoose.stubChainedQueries(undefined, ['setOptions', 'lean']));
    completionCertificateCreationEmail.returns({ msg: 'Script correctement exécuté.' });

    await CompletionCertificateCreationJob.completionCertificateCreation({ query: { month } });

    SinonMongoose.calledOnceWithExactly(
      findCourse,
      [
        { query: 'find', args: [{ archivedAt: { $exists: false }, certificateGenerationMode: MONTHLY }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'steps', populate: [{ path: 'steps', select: 'activities' }] }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findAttendance,
      [
        { query: 'find', args: [{}] },
        { query: 'populate', args: [{ path: 'courseSlot', select: 'startDate endDate course' }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findActivityHistory,
      [
        { query: 'find', args: [{ activity: { $in: activityIds }, user: traineeIds[1] }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledWithExactly(
      findOneCompletionCertificate,
      [
        { query: 'findOne', args: [{ course: courseIds[0], month }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findOneCompletionCertificate,
      [
        { query: 'findOne', args: [{ course: courseIds[1], month }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.calledWithExactly(
      createCompletionCertificate,
      { course: courseIds[0], trainee: traineeIds[0], month }
    );
    sinon.assert.calledWithExactly(
      createCompletionCertificate,
      { course: courseIds[1], trainee: traineeIds[1], month }
    );
    sinon.assert.calledWithExactly(completionCertificateCreationEmail, courseIds, [], month);
  });
});
