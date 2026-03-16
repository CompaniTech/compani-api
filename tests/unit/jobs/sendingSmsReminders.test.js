const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const SinonMongoose = require('../sinonMongoose');
const CourseSlot = require('../../../src/models/CourseSlot');
const EmailHelper = require('../../../src/helpers/email');
const SmsHelper = require('../../../src/helpers/sms');
const UtilsMock = require('../../utilsMock');
const { sendingSmsRemindersJob } = require('../../../src/jobs/sendingSmsReminders');

describe('method', () => {
  let findSlots;
  let smsSend;

  beforeEach(() => {
    findSlots = sinon.stub(CourseSlot, 'find');
    smsSend = sinon.stub(SmsHelper, 'send');
    UtilsMock.mockCurrentDate('2026-01-04T15:00:00.000Z');
    process.env.TECH_EMAILS = 'tech@compani.fr';
    process.env.VAEI_EVALUATION_STEP_ID = new ObjectId();
  });

  afterEach(() => {
    findSlots.restore();
    smsSend.restore();
    UtilsMock.unmockCurrentDate();
    process.env.TECH_EMAILS = '';
    process.env.VAEI_EVALUATION_STEP_ID = '';
  });

  it('should send reminders by sms', async () => {
    const traineeIds = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
    const trainerId = new ObjectId();
    const courseSlots2W = [
      {
        startDate: '2026-01-18T15:00:00.000Z',
        step: process.env.VAEI_EVALUATION_STEP_ID,
        course: { trainees: [{ _id: traineeIds[0], contact: { phone: '0987654321', countryCode: '+33' } }] },
      },
      {
        startDate: '2026-01-18T15:00:00.000Z',
        step: process.env.VAEI_EVALUATION_STEP_ID,
        course: { trainees: [{ _id: traineeIds[1] }] },
      },
      {
        startDate: '2026-01-18T15:00:00.000Z',
        step: process.env.VAEI_EVALUATION_STEP_ID,
        course: { interruptedAt: '2026-01-01T15:00:00.000Z', trainees: [{ _id: traineeIds[2] }] },
      },
      {
        startDate: '2026-01-18T15:00:00.000Z',
        step: process.env.VAEI_EVALUATION_STEP_ID,
        course: { archivedAt: '2026-01-01T15:00:00.000Z', trainees: [{ _id: traineeIds[3] }] },
      },
    ];
    const courseSlots1D = [
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: process.env.VAEI_EVALUATION_STEP_ID,
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: { trainees: [{ _id: traineeIds[0], contact: { phone: '0987654321', countryCode: '+33' } }] },
      },
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: process.env.VAEI_EVALUATION_STEP_ID,
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: { trainees: [{ _id: traineeIds[1] }] },
      },
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: process.env.VAEI_EVALUATION_STEP_ID,
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: { interruptedAt: '2026-01-01T15:00:00.000Z', trainees: [{ _id: traineeIds[2] }] },
      },
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: process.env.VAEI_EVALUATION_STEP_ID,
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: { archivedAt: '2026-01-01T15:00:00.000Z', trainees: [{ _id: traineeIds[0] }] },
      },
    ];

    findSlots.onCall(0).returns(SinonMongoose.stubChainedQueries(courseSlots2W));
    findSlots.onCall(1).returns(SinonMongoose.stubChainedQueries(courseSlots1D));

    // eslint-disable-next-line no-console
    const server = { log: value => console.log(value) };
    const res = await sendingSmsRemindersJob.method(server);

    expect(res).toEqual({
      'Relance elearning avant évaluation': { sentReminders: [traineeIds[0]], notSentReminders: [traineeIds[1]] },
      'Veille d\'évaluation': { sentReminders: [traineeIds[0]], notSentReminders: [traineeIds[1]] },
    });

    SinonMongoose.calledWithExactly(
      findSlots,
      [
        {
          query: 'find',
          args: [{
            step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
            startDate: { $gte: new Date('2026-01-17T23:00:00.000Z'), $lte: new Date('2026-01-18T22:59:59.999Z') },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'trainees interruptedAt archivedAt',
            populate: { path: 'trainees', select: 'contact' },
          }],
        },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findSlots,
      [
        {
          query: 'find',
          args: [{
            step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
            startDate: { $gte: new Date('2026-01-04T23:00:00.000Z'), $lte: new Date('2026-01-05T22:59:59.999Z') },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'trainees trainers interruptedAt archivedAt',
            populate: { path: 'trainees', select: 'contact' },
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'trainers', select: 'identity contact' }],
        },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.calledWithExactly(
      smsSend.getCall(0),
      {
        recipient: '+33987654321',
        sender: 'Compani',
        content: 'Formation VAEI :\nPrenez quelques minutes pour avancer sur vos e-learnings : préparez vous pour '
        + 'votre évaluation du 18/01/2026 à 16:00 !',
        tag: 'Formation VAEI',
      }
    );
    sinon.assert.calledWithExactly(
      smsSend.getCall(1),
      {
        recipient: '+33987654321',
        sender: 'Compani',
        content: 'Formation VAEI :\nN\'oubliez pas votre évaluation avec votre architecte de parcours Claire FORM qui '
        + 'aura lieu demain à 16:00, en visio. Si besoin, contactez votre architecte de parcours (+33987654321).',
        tag: 'Formation VAEI',
      }
    );
  });

  it('should return empty result if no matching slot', async () => {
    findSlots.onCall(0).returns(SinonMongoose.stubChainedQueries([]));
    findSlots.onCall(1).returns(SinonMongoose.stubChainedQueries([]));

    // eslint-disable-next-line no-console
    const server = { log: value => console.log(value) };
    const res = await sendingSmsRemindersJob.method(server);

    expect(res).toEqual({
      'Relance elearning avant évaluation': {},
      'Veille d\'évaluation': {},
    });

    SinonMongoose.calledWithExactly(
      findSlots,
      [
        {
          query: 'find',
          args: [{
            step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
            startDate: { $gte: new Date('2026-01-17T23:00:00.000Z'), $lte: new Date('2026-01-18T22:59:59.999Z') },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'trainees interruptedAt archivedAt',
            populate: { path: 'trainees', select: 'contact' },
          }],
        },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findSlots,
      [
        {
          query: 'find',
          args: [{
            step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
            startDate: { $gte: new Date('2026-01-04T23:00:00.000Z'), $lte: new Date('2026-01-05T22:59:59.999Z') },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'trainees trainers interruptedAt archivedAt',
            populate: { path: 'trainees', select: 'contact' },
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'trainers', select: 'identity contact' }],
        },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.notCalled(smsSend);
  });
});

describe('onComplete', () => {
  let completionSendingSmsRemindersEmail;
  let serverLogStub;
  // eslint-disable-next-line no-console
  const server = { log: value => console.log(value) };

  beforeEach(() => {
    completionSendingSmsRemindersEmail = sinon.stub(EmailHelper, 'completionSendingSmsRemindersEmail');
    serverLogStub = sinon.stub(server, 'log');
  });

  afterEach(() => {
    completionSendingSmsRemindersEmail.restore();
    serverLogStub.restore();
  });

  it('should send an email after sms sending', async () => {
    const result = {
      'Relance elearning avant évaluation': {
        sentReminders: [new ObjectId()],
        notSentReminders: [new ObjectId()],
      },
    };

    await sendingSmsRemindersJob.onComplete(server, result);
    sinon.assert.calledOnceWithExactly(completionSendingSmsRemindersEmail, result);
  });
});
