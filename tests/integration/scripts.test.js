const { expect } = require('expect');
const sinon = require('sinon');
const app = require('../../server');
const EmailHelper = require('../../src/helpers/email');
const SmsHelper = require('../../src/helpers/sms');
const UtilsMock = require('../utilsMock');
const { populateDB, courseList, userList, stepList } = require('./seed/scriptsSeed');
const { getToken } = require('./helpers/authentication');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('SCRIPTS ROUTES - GET /scripts/completioncertificates-generation', () => {
  let authToken;

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
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

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      smsSend = sinon.stub(SmsHelper, 'send');
      UtilsMock.mockCurrentDate('2023-01-08T09:00:00.000Z');
      process.env.TECH_EMAIL = 'tech@compani.fr';
      process.env.VAEI_EVALUATION_STEP_ID = stepList[0]._id;
      process.env.VAEI_CODEV_STEP_ID = stepList[1]._id;
      process.env.VAEI_TRIPARTITE_STEP_ID = stepList[3]._id;
    });

    afterEach(() => {
      smsSend.restore();
      UtilsMock.unmockCurrentDate('');
      process.env.TECH_EMAIL = '';
      process.env.VAEI_EVALUATION_STEP_ID = '';
      process.env.VAEI_CODEV_STEP_ID = '';
      process.env.VAEI_TRIPARTITE_STEP_ID = '';
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
        });
      sinon.assert.callCount(smsSend, 6);
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
