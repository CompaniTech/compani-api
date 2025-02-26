const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const SinonMongoose = require('../sinonMongoose');
const Course = require('../../../src/models/Course');
const Attendance = require('../../../src/models/Attendance');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const { INTER_B2B, MONTHLY, MM_YYYY } = require('../../../src/helpers/constants');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');
const EmailHelper = require('../../../src/helpers/email');
const { completionCertificateCreationJob } = require('../../../src/jobs/completionCertificateCreation');

describe('completionCertificateCreation', () => {
  let findCourse;
  let findAttendance;
  let countDocumentsActivityHistory;
  let countDocumentsCompletionCertificate;
  let createCompletionCertificate;
  let completionCertificateCreationEmail;

  beforeEach(() => {
    findCourse = sinon.stub(Course, 'find');
    findAttendance = sinon.stub(Attendance, 'find');
    countDocumentsActivityHistory = sinon.stub(ActivityHistory, 'countDocuments');
    countDocumentsCompletionCertificate = sinon.stub(CompletionCertificate, 'countDocuments');
    createCompletionCertificate = sinon.stub(CompletionCertificate, 'create');
    completionCertificateCreationEmail = sinon.stub(EmailHelper, 'completionCertificateCreationEmail');
  });

  afterEach(() => {
    findCourse.restore();
    findAttendance.restore();
    countDocumentsActivityHistory.restore();
    countDocumentsCompletionCertificate.restore();
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
    const startOfMonth = CompaniDate(month, MM_YYYY).startOf('month').toISO();
    const endOfMonth = CompaniDate(month, MM_YYYY).endOf('month').toISO();

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
    countDocumentsActivityHistory.returns(activityHistories.length);
    countDocumentsCompletionCertificate.onCall(0).returns(0);
    countDocumentsCompletionCertificate.onCall(1).returns(0);
    completionCertificateCreationEmail.returns({ msg: 'Script correctement exécuté.' });

    // eslint-disable-next-line no-console
    const server = { query: { month }, log: value => console.log(value) };
    const res = await completionCertificateCreationJob.method(server);

    expect(res.certificateCreated.length).toBe(2);
    SinonMongoose.calledOnceWithExactly(
      findCourse,
      [
        { query: 'find', args: [{ archivedAt: { $exists: false }, certificateGenerationMode: MONTHLY }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'steps', populate: [{ path: 'steps', select: 'activities' }] }],
        },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findAttendance,
      [
        { query: 'find', args: [{ courseSlot: { $in: [slotIds[0], slotIds[2], slotIds[3]] } }] },
        { query: 'populate', args: [{ path: 'courseSlot', select: 'startDate endDate course' }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      countDocumentsActivityHistory,
      [
        {
          query: 'countDocuments',
          args: [{
            activity: { $in: activityIds },
            user: traineeIds[1],
            date: { $gte: startOfMonth, $lte: endOfMonth },
          }],
        },
      ]
    );
    SinonMongoose.calledWithExactly(
      countDocumentsCompletionCertificate,
      [{ query: 'countDocuments', args: [{ course: courseIds[0], month }] }],
      0
    );
    SinonMongoose.calledWithExactly(
      countDocumentsCompletionCertificate,
      [{ query: 'countDocuments', args: [{ course: courseIds[1], month }] }],
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
