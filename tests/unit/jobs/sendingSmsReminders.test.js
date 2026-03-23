const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const SinonMongoose = require('../sinonMongoose');
const Course = require('../../../src/models/Course');
const CourseSlot = require('../../../src/models/CourseSlot');
const EmailHelper = require('../../../src/helpers/email');
const SmsHelper = require('../../../src/helpers/sms');
const UtilsMock = require('../../utilsMock');
const { sendingSmsRemindersJob } = require('../../../src/jobs/sendingSmsReminders');
const SubProgram = require('../../../src/models/SubProgram');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const { E_LEARNING } = require('../../../src/helpers/constants');

describe('method', () => {
  let findSlots;
  let smsSend;
  let findCourses;
  let findOneSubProgram;
  let findActivityHistories;

  beforeEach(() => {
    findSlots = sinon.stub(CourseSlot, 'find');
    findCourses = sinon.stub(Course, 'find');
    findOneSubProgram = sinon.stub(SubProgram, 'findOne');
    findActivityHistories = sinon.stub(ActivityHistory, 'find');
    smsSend = sinon.stub(SmsHelper, 'send');
    UtilsMock.mockCurrentDate('2026-01-04T15:00:00.000Z');
    process.env.TECH_EMAILS = 'tech@compani.fr';
    process.env.VAEI_EVALUATION_STEP_ID = new ObjectId();
    process.env.VAEI_CODEV_STEP_ID = new ObjectId();
    process.env.VAEI_TRIPARTITE_STEP_ID = new ObjectId();
    process.env.POEI_SUBPROGRAM_ID = new ObjectId();
    process.env.COLLECTIVE_STEP_IDS = new ObjectId();
  });

  afterEach(() => {
    findSlots.restore();
    findCourses.restore();
    findOneSubProgram.restore();
    findActivityHistories.restore();
    smsSend.restore();
    UtilsMock.unmockCurrentDate();
    process.env.TECH_EMAILS = '';
    process.env.VAEI_EVALUATION_STEP_ID = '';
    process.env.VAEI_CODEV_STEP_ID = '';
    process.env.VAEI_TRIPARTITE_STEP_ID = '';
    process.env.POEI_SUBPROGRAM_ID = '';
    process.env.COLLECTIVE_STEP_IDS = '';
  });

  it('should send reminders by sms', async () => {
    const traineeIds = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
    const tutorIds = [new ObjectId(), new ObjectId()];
    const trainerId = new ObjectId();
    const courseSlots2W = [
      {
        startDate: '2026-01-18T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
        course: { trainees: [{ _id: traineeIds[0], contact: { phone: '0987654321', countryCode: '+33' } }] },
      },
      {
        startDate: '2026-01-18T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
        course: { trainees: [{ _id: traineeIds[1] }] },
      },
      {
        startDate: '2026-01-18T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
        course: { interruptedAt: '2026-01-01T15:00:00.000Z', trainees: [{ _id: traineeIds[2] }] },
      },
      {
        startDate: '2026-01-18T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
        course: { archivedAt: '2026-01-01T15:00:00.000Z', trainees: [{ _id: traineeIds[3] }] },
      },
    ];
    const courseSlots1D = [
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          trainees: [{
            _id: traineeIds[0],
            contact: { phone: '0987654321', countryCode: '+33' },
            identity: { lastname: 'App', firstname: 'Jeanne' },
          }],
          tutors: [
            { _id: tutorIds[0], contact: { phone: '0987654321', countryCode: '+33' } },
            { _id: tutorIds[1], contact: {} },
          ],
        },
      },
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          trainees: [{ _id: traineeIds[1], identity: { lastname: 'App2', firstname: 'Max' } }],
          tutors: [],
        },
      },
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          interruptedAt: '2026-01-01T15:00:00.000Z',
          trainees: [{ _id: traineeIds[2], identity: { lastname: 'App3', firstname: 'Alice' } }],
          tutors: [],
        },
      },
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          archivedAt: '2026-01-01T15:00:00.000Z',
          trainees: [{ _id: traineeIds[3], identity: { lastname: 'App4', firstname: 'Bernard' } }],
          tutors: [],
        },
      },
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          trainees: [{
            _id: traineeIds[0],
            contact: { phone: '0987654321', countryCode: '+33' },
            identity: { lastname: 'App', firstname: 'Jeanne' },
          }],
          tutors: [
            { _id: tutorIds[0], contact: { phone: '0987654321', countryCode: '+33' } },
            { _id: tutorIds[1], contact: {} },
          ],
        },
      },
      {
        startDate: '2026-01-05T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_TRIPARTITE_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          trainees: [{
            _id: traineeIds[0],
            contact: { phone: '0987654321', countryCode: '+33' },
            identity: { lastname: 'App', firstname: 'Jeanne' },
          }],
          tutors: [
            { _id: tutorIds[0], contact: { phone: '0987654321', countryCode: '+33' } },
            { _id: tutorIds[1], contact: {} },
          ],
        },
      },
    ];
    const courseSlots1W = [
      {
        startDate: '2026-01-11T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          trainees: [{ _id: traineeIds[0], contact: { phone: '0987654321', countryCode: '+33' } }],
          slots: [
            { startDate: '2026-01-05T15:00:00.000Z', step: new ObjectId(process.env.VAEI_CODEV_STEP_ID) },
            { startDate: '2026-01-11T15:00:00.000Z', step: new ObjectId(process.env.VAEI_CODEV_STEP_ID) },
          ],
        },
      },
      {
        startDate: '2026-01-11T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          trainees: [{ _id: traineeIds[4], contact: { phone: '0987654321', countryCode: '+33' } }],
          slots: [{ startDate: '2026-01-11T15:00:00.000Z', step: new ObjectId(process.env.VAEI_CODEV_STEP_ID) }],
        },
      },
      {
        startDate: '2026-01-11T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          trainees: [{ _id: traineeIds[1] }],
          slots: [{ startDate: '2026-01-11T15:00:00.000Z', step: new ObjectId(process.env.VAEI_CODEV_STEP_ID) }],
        },
      },
      {
        startDate: '2026-01-11T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          interruptedAt: '2026-01-01T15:00:00.000Z',
          trainees: [{ _id: traineeIds[2] }],
          slots: [{ startDate: '2026-01-11T15:00:00.000Z', step: new ObjectId(process.env.VAEI_CODEV_STEP_ID) }],
        },
      },
      {
        startDate: '2026-01-11T15:00:00.000Z',
        step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
        trainers: [{
          _id: trainerId,
          identity: { lastname: 'Form', firstname: 'Claire' },
          contact: { countryCode: '+33', phone: '0987654321' },
        }],
        course: {
          archivedAt: '2026-01-01T15:00:00.000Z',
          trainees: [{ _id: traineeIds[3] }],
          slots: [{ startDate: '2026-01-11T15:00:00.000Z', step: new ObjectId(process.env.VAEI_CODEV_STEP_ID) }],
        },
      },
    ];
    const poeiCourses = [
      {
        subProgram: process.env.POEI_SUBPROGRAM_ID,
        trainees: [{ _id: traineeIds[0], contact: { phone: '0987654321', countryCode: '+33' } }],
        slots: [
          { startDate: '2025-12-21T15:00:00.000Z' },
        ],
      },
      {
        subProgram: process.env.POEI_SUBPROGRAM_ID,
        trainees: [{ _id: traineeIds[1] }],
        slots: [
          { startDate: '2025-11-09T15:00:00.000Z' },
        ],
      },
    ];
    const activitiesIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const subProgram = {
      _id: process.env.POEI_SUBPROGRAM_ID,
      steps: [{ activities: activitiesIds, type: E_LEARNING }],
    };
    const activityHistories = [{ user: traineeIds[0], activity: activitiesIds[0] }];

    findSlots.onCall(0).returns(SinonMongoose.stubChainedQueries(courseSlots2W));
    findSlots.onCall(1).returns(SinonMongoose.stubChainedQueries(courseSlots1D));
    findSlots.onCall(2).returns(SinonMongoose.stubChainedQueries(courseSlots1W));
    findCourses.returns(SinonMongoose.stubChainedQueries(poeiCourses));
    findOneSubProgram.returns(SinonMongoose.stubChainedQueries(subProgram));
    findActivityHistories.returns(SinonMongoose.stubChainedQueries(activityHistories, ['lean']));

    // eslint-disable-next-line no-console
    const server = { log: value => console.log(value) };
    const res = await sendingSmsRemindersJob.method(server);

    expect(res).toEqual({
      'Relance elearning avant évaluation': { sentReminders: [traineeIds[0]], notSentReminders: [traineeIds[1]] },
      'Veille d\'évaluation': { sentReminders: [traineeIds[0]], notSentReminders: [traineeIds[1]] },
      'Veille de CODEV': { sentReminders: [traineeIds[0]] },
      'Veille de tripartite (apprenant)': { sentReminders: [traineeIds[0]] },
      'Veille de tripartite (tuteur)': { sentReminders: [tutorIds[0]], notSentReminders: [tutorIds[1]] },
      '1 semaine avant 1er codev': { sentReminders: [traineeIds[4]], notSentReminders: [traineeIds[1]] },
      'Relance elearning POEI': { sentReminders: [traineeIds[0]] },
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
            step: {
              $in: [
                new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
                new ObjectId(process.env.VAEI_CODEV_STEP_ID),
                new ObjectId(process.env.VAEI_TRIPARTITE_STEP_ID),
              ],
            },
            startDate: { $gte: new Date('2026-01-04T23:00:00.000Z'), $lte: new Date('2026-01-05T22:59:59.999Z') },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'trainees tutors trainers interruptedAt archivedAt',
            populate: [{ path: 'trainees', select: 'contact identity' }, { path: 'tutors', select: 'contact' }],
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
    SinonMongoose.calledWithExactly(
      findSlots,
      [
        {
          query: 'find',
          args: [{
            step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
            startDate: { $gte: new Date('2026-01-10T23:00:00.000Z'), $lte: new Date('2026-01-11T22:59:59.999Z') },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'trainees interruptedAt archivedAt',
            populate: [
              { path: 'trainees', select: 'contact' },
              {
                path: 'slots',
                select: 'startDate',
                match: { step: new ObjectId(process.env.VAEI_CODEV_STEP_ID), startDate: { $exists: true } },
                options: { sort: { startDate: 1 } },
              },
            ],
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'trainers', select: 'identity contact' }],
        },
        { query: 'lean' },
      ],
      2
    );
    SinonMongoose.calledOnceWithExactly(
      findCourses,
      [
        {
          query: 'find',
          args: [{
            subProgram: new ObjectId(process.env.POEI_SUBPROGRAM_ID),
            archivedAt: { $exists: false },
            interruptedAt: { $exists: false },
          }],
        },
        { query: 'populate', args: [{ path: 'trainees', select: 'contact' }] },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'startDate step',
            match: { step: { $nin: [new ObjectId(process.env.COLLECTIVE_STEP_IDS)] }, startDate: { $exists: true } },
            options: { sort: { startDate: 1 } },
          }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneSubProgram,
      [
        { query: 'findOne', args: [{ _id: new ObjectId(process.env.POEI_SUBPROGRAM_ID) }, { steps: 1 }] },
        { query: 'populate', args: [{ path: 'steps', select: 'type activities', match: { type: E_LEARNING } }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findActivityHistories,
      [{ query: 'find', args: [{ user: traineeIds[0], activity: { $in: activitiesIds } }] }, { query: 'lean' }]
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
    sinon.assert.calledWithExactly(
      smsSend.getCall(2),
      {
        recipient: '+33987654321',
        sender: 'Compani',
        content: 'Formation VAEI :\nN\'oubliez pas votre rendez-vous d\'accompagnement collectif avec votre '
        + 'animateur.rice Claire FORM qui aura lieu demain à 16:00, en visio.'
        + ' Si besoin, contactez votre animateur.rice de CODEV (+33987654321).',
        tag: 'Formation VAEI',
      }
    );
    sinon.assert.calledWithExactly(
      smsSend.getCall(3),
      {
        recipient: '+33987654321',
        sender: 'Compani',
        content: 'Formation VAEI :\nN\'oubliez pas votre rendez-vous tripartite qui aura lieu demain à 16:00, dans '
        + 'votre structure. Si besoin, contactez votre coach (+33987654321).',
        tag: 'Formation VAEI',
      }
    );
    sinon.assert.calledWithExactly(
      smsSend.getCall(4),
      {
        recipient: '+33987654321',
        sender: 'Compani',
        content: 'Formation VAEI :\nN\'oubliez pas le rendez-vous tripartite qui aura lieu demain à 16:00, avec votre '
        + 'apprenant.e Jeanne APP. Si besoin, contactez le coach (+33987654321).',
        tag: 'Formation VAEI',
      }
    );
    sinon.assert.calledWithExactly(
      smsSend.getCall(5),
      {
        recipient: '+33987654321',
        sender: 'Compani',
        content: 'Formation VAEI :\nVotre première session d\'accompagnement collectif aura lieu le 11/01/2026 à 16:00 '
        + 'avec l\'animateur.rice Claire FORM. Veuillez vérifier vos mails pour vous connecter sur la visio. '
        + 'Si besoin, contactez votre coach.',
        tag: 'Formation VAEI',
      }
    );
    sinon.assert.calledWithExactly(
      smsSend.getCall(6),
      {
        recipient: '+33987654321',
        sender: 'Compani',
        content: 'Formation POEI :\nN\'oubliez pas de faire votre e-learning !',
        tag: 'Formation POEI',
      }
    );
  });

  it('should return empty result if no matching slot', async () => {
    findSlots.onCall(0).returns(SinonMongoose.stubChainedQueries([]));
    findSlots.onCall(1).returns(SinonMongoose.stubChainedQueries([]));
    findSlots.onCall(2).returns(SinonMongoose.stubChainedQueries([]));
    findCourses.returns(SinonMongoose.stubChainedQueries([]));
    findOneSubProgram.returns(SinonMongoose.stubChainedQueries({}));

    // eslint-disable-next-line no-console
    const server = { log: value => console.log(value) };
    const res = await sendingSmsRemindersJob.method(server);

    expect(res).toEqual({
      'Relance elearning avant évaluation': {},
      'Veille d\'évaluation': {},
      'Veille de CODEV': {},
      'Veille de tripartite (apprenant)': {},
      'Veille de tripartite (tuteur)': {},
      '1 semaine avant 1er codev': {},
      'Relance elearning POEI': {},
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
            step: {
              $in: [
                new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
                new ObjectId(process.env.VAEI_CODEV_STEP_ID),
                new ObjectId(process.env.VAEI_TRIPARTITE_STEP_ID),
              ],
            },
            startDate: { $gte: new Date('2026-01-04T23:00:00.000Z'), $lte: new Date('2026-01-05T22:59:59.999Z') },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'trainees tutors trainers interruptedAt archivedAt',
            populate: [{ path: 'trainees', select: 'contact identity' }, { path: 'tutors', select: 'contact' }],
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
    SinonMongoose.calledWithExactly(
      findSlots,
      [
        {
          query: 'find',
          args: [{
            step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
            startDate: { $gte: new Date('2026-01-10T23:00:00.000Z'), $lte: new Date('2026-01-11T22:59:59.999Z') },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'trainees interruptedAt archivedAt',
            populate: [
              { path: 'trainees', select: 'contact' },
              {
                path: 'slots',
                select: 'startDate',
                match: { step: new ObjectId(process.env.VAEI_CODEV_STEP_ID), startDate: { $exists: true } },
                options: { sort: { startDate: 1 } },
              },
            ],
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'trainers', select: 'identity contact' }],
        },
        { query: 'lean' },
      ],
      2
    );
    SinonMongoose.calledOnceWithExactly(
      findCourses,
      [
        {
          query: 'find',
          args: [{
            subProgram: new ObjectId(process.env.POEI_SUBPROGRAM_ID),
            archivedAt: { $exists: false },
            interruptedAt: { $exists: false },
          }],
        },
        { query: 'populate', args: [{ path: 'trainees', select: 'contact' }] },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'startDate step',
            match: { step: { $nin: [new ObjectId(process.env.COLLECTIVE_STEP_IDS)] }, startDate: { $exists: true } },
            options: { sort: { startDate: 1 } },
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findOneSubProgram);
    sinon.assert.notCalled(findActivityHistories);
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
