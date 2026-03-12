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
    const traineeIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const courseSlots = [
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
    ];

    findSlots.returns(SinonMongoose.stubChainedQueries(courseSlots));

    // eslint-disable-next-line no-console
    const server = { log: value => console.log(value) };
    const res = await sendingSmsRemindersJob.method(server);

    expect(res).toEqual({
      'Relance elearning avant évaluation': {
        sentReminders: [traineeIds[0]],
        notSentReminders: [traineeIds[1]],
      },
    });

    SinonMongoose.calledWithExactly(
      findSlots,
      [
        {
          query: 'find',
          args: [{
            step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
            startDate: {
              $gte: new Date('2026-01-17T23:00:00.000Z'),
              $lte: new Date('2026-01-18T22:59:59.999Z'),
            },
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
      ]
    );
    sinon.assert.calledOnceWithExactly(
      smsSend,
      {
        recipient: '+33987654321',
        sender: 'Compani',
        content: 'Formation VAEI :\nPrenez quelques minutes pour avancer sur vos e-learnings : préparez vous pour '
        + 'votre évaluation du 18/01/2026 à 16:00 !',
        tag: 'Formation VAEI',
      }
    );
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
