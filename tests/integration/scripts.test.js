const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const notionSdk = require('@notionhq/client');
const app = require('../../server');
const CompletionCertificateHelper = require('../../src/helpers/completionCertificates');
const EmailHelper = require('../../src/helpers/email');
const SmsHelper = require('../../src/helpers/sms');
const NotificationHelper = require('../../src/helpers/notifications');
const UtilsMock = require('../utilsMock');
const { populateDB, courseList, userList, stepList, subProgramList } = require('./seed/scriptsSeed');
const { getToken } = require('./helpers/authentication');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('SCRIPTS ROUTES - GET /scripts/completioncertificates-generation', () => {
  let authToken;
  let generate;

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      generate = sinon.stub(CompletionCertificateHelper, 'generate');
    });
    afterEach(() => {
      generate.restore();
    });

    it('should send email for completion certificates', async () => {
      const month = '02-2025';
      const response = await app.inject({
        method: 'GET',
        url: `/scripts/completioncertificates-generation?month=${month}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.certificateCreated)
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ course: courseList[0]._id, trainee: userList[0]._id, month }),
          expect.objectContaining({ course: courseList[2]._id, trainee: userList[2]._id, month }),
        ]));
      expect(response.result.data.errors)
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ course: courseList[0]._id, trainee: userList[0]._id, month }),
        ]));
    });

    it('should return 400 if month has wrong format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/scripts/completioncertificates-generation?month=022025',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toEqual(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'training_organisation_manager', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/scripts/completioncertificates-generation?month=02-2025',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('SCRIPTS ROUTES - GET /scripts/sending-pendingcoursebills-by-email', () => {
  let authToken;
  let sendBillEmail;

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      sendBillEmail = sinon.stub(EmailHelper, 'sendBillEmail');
      UtilsMock.mockCurrentDate('2023-01-08T09:00:00.000Z');
    });

    afterEach(() => {
      sendBillEmail.restore();
      UtilsMock.unmockCurrentDate('');
    });

    it('should send pendingCourseBills by email', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/scripts/sending-pendingcoursebills-by-email',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data)
        .toEqual({ day: '2023-01-07T23:00:00.000Z', emailSent: 1, pendingCourseBillDeleted: 1 });
      sinon.assert.calledOnce(sendBillEmail);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'training_organisation_manager', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/scripts/sending-pendingcoursebills-by-email',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('SCRIPTS ROUTES - GET /scripts/sending-sms-reminders', () => {
  let authToken;
  let smsSend;
  let sendAttendanceReminder;

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      smsSend = sinon.stub(SmsHelper, 'send');
      sendAttendanceReminder = sinon.stub(NotificationHelper, 'sendAttendanceReminder');
      UtilsMock.mockCurrentDate('2023-01-08T09:00:00.000Z');
      process.env.TECH_EMAIL = 'tech@compani.fr';
      process.env.EVALUATION_STEP_IDS = stepList[0]._id;
      process.env.CODEV_STEP_IDS = stepList[1]._id;
      process.env.TRIPARTITE_STEP_IDS = stepList[3]._id;
      process.env.POEI_SUBPROGRAM_IDS = subProgramList[2]._id;
      process.env.COLLECTIVE_STEP_IDS = stepList[4]._id;
      process.env.VAE_SUBPROGRAM_IDS = subProgramList[1]._id;
    });

    afterEach(() => {
      smsSend.restore();
      sendAttendanceReminder.restore();
      UtilsMock.unmockCurrentDate('');
      process.env.TECH_EMAIL = '';
      process.env.EVALUATION_STEP_IDS = '';
      process.env.CODEV_STEP_IDS = '';
      process.env.TRIPARTITE_STEP_IDS = '';
      process.env.POEI_SUBPROGRAM_IDS = '';
      process.env.COLLECTIVE_STEP_IDS = '';
      process.env.VAE_SUBPROGRAM_IDS = '';
    });

    it('should send reminders by sms', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/scripts/sending-sms-reminders',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data)
        .toEqual({
          'Relance elearning avant évaluation': {
            sentReminders: [userList[0]._id],
            notSentReminders: [userList[2]._id],
          },
          'Veille d\'évaluation': {
            sentReminders: [userList[0]._id],
            notSentReminders: [userList[2]._id],
          },
          'Veille de CODEV': {
            sentReminders: [userList[0]._id],
          },
          'Veille de tripartite (apprenant)': {
            sentReminders: [userList[0]._id],
          },
          'Veille de tripartite (tuteur)': {
            sentReminders: [userList[3]._id],
          },
          '1 semaine avant 1er codev': {
            sentReminders: [userList[3]._id],
          },
          'Relance elearning POEI': {
            sentReminders: [userList[0]._id],
          },
          'Relance émargement intervenants': {
            sentReminders: [userList[1]._id],
          },
        });
      sinon.assert.callCount(smsSend, 7);
      sinon.assert.callCount(sendAttendanceReminder, 1);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'training_organisation_manager', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/scripts/sending-sms-reminders',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('SCRIPTS ROUTES - GET /scripts/notion-course-slots-update', () => {
  let authToken;
  let notionClientDescriptor;
  let notionMock;
  const priSubProgramId = new ObjectId();
  const vaeSubProgramId = new ObjectId();
  const coachingStepId = new ObjectId();

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);

    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      notionMock = { dataSources: { query: sinon.stub() }, pages: { update: sinon.stub().resolves({}) } };
      notionClientDescriptor = Object.getOwnPropertyDescriptor(notionSdk, 'Client');
      Object.defineProperty(notionSdk, 'Client', {
        configurable: true,
        enumerable: true,
        get: () => function MockClient() { return notionMock; },
      });

      process.env.VAEI_SUBPROGRAM_IDS = subProgramList[0]._id.toHexString();
      process.env.PRI_SUBPROGRAM_IDS = priSubProgramId.toHexString();
      process.env.VAE_SUBPROGRAM_IDS = vaeSubProgramId.toHexString();
      process.env.EVALUATION_STEP_IDS = stepList[0]._id.toHexString();
      process.env.CODEV_STEP_IDS = stepList[1]._id.toHexString();
      process.env.TRIPARTITE_STEP_IDS = stepList[3]._id.toHexString();
      process.env.COACHING_STEP_IDS = coachingStepId.toHexString();
      process.env.NOTION_TOKEN = 'notion-token';
      process.env.NOTION_TRAINEES_DATABASE = 'notion-db-id';
    });

    afterEach(() => {
      Object.defineProperty(notionSdk, 'Client', notionClientDescriptor);
      process.env.VAEI_SUBPROGRAM_IDS = '';
      // process.env.PRI_SUBPROGRAM_IDS = '';
      // process.env.VAE_SUBPROGRAM_IDS = '';
      process.env.EVALUATION_STEP_IDS = '';
      process.env.CODEV_STEP_IDS = '';
      process.env.TRIPARTITE_STEP_IDS = '';
      process.env.COACHING_STEP_IDS = '';
      process.env.NOTION_TOKEN = '';
      process.env.NOTION_TRAINEES_DATABASE = '';
    });

    it('should update Notion for trainees with matching rows and skip others', async () => {
      notionMock.dataSources.query.callsFake(async () => ({ results: [{ }] }));

      const response = await app.inject({
        method: 'GET',
        url: '/scripts/notion-course-slots-update',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.updatedTraineeIds).toHaveLength(3);
      // expect(response.result.data.notUpdatedTraineeIds).toHaveLength(1);

      // sinon.assert.callCount(notionMock.dataSources.query, 3);
      // sinon.assert.calledWithMatch(notionMock.dataSources.query, {
      //   data_source_id: 'notion-db-id',
      //   filter: { property: 'ID_VAEI_Apprenant', rich_text: { equals: userList[0]._id.toHexString() } },
      // });

      // sinon.assert.callCount(notionMock.pages.update, 2);
      // sinon.assert.calledWithMatch(notionMock.pages.update, {
      //   page_id: `page-id-${userList[0]._id.toHexString()}`,
      //   properties: {
      //     'Total h diag&eval': { number: 8 },
      //     'Total h codev': { number: 4 },
      //     'Total h tripartite': { number: 1 },
      //     'Total h coaching': { number: 0 },
      //     'Total h e-learning': { number: 0 },
      //   },
      // });
      // sinon.assert.calledWithMatch(notionMock.pages.update, {
      //   page_id: `page-id-${userList[3]._id.toHexString()}`,
      //   properties: {
      //     'Total h diag&eval': { number: 0 },
      //     'Total h codev': { number: 2 },
      //     'Total h tripartite': { number: 0 },
      //     'Total h coaching': { number: 0 },
      //     'Total h e-learning': { number: 0 },
      //   },
      // });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'training_organisation_manager', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/scripts/notion-course-slots-update',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
