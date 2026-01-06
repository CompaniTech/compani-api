const { expect } = require('expect');
const sinon = require('sinon');
const app = require('../../server');
const EmailHelper = require('../../src/helpers/email');
const UtilsMock = require('../utilsMock');
const { populateDB, courseList, userList } = require('./seed/scriptsSeed');
const { getToken } = require('./helpers/authentication');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('SCRIPTS ROUTES - GET /scripts/completioncertificates-generation', () => {
  let authToken;
  let completionCertificateCreationEmail;

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      completionCertificateCreationEmail = sinon.stub(EmailHelper, 'completionCertificateCreationEmail');
    });

    afterEach(() => {
      completionCertificateCreationEmail.restore();
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
  let completionSendingPendingBillsEmail;

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      sendBillEmail = sinon.stub(EmailHelper, 'sendBillEmail');
      completionSendingPendingBillsEmail = sinon.stub(EmailHelper, 'completionSendingPendingBillsEmail');
      UtilsMock.mockCurrentDate('2023-01-08T09:00:00.000Z');
    });

    afterEach(() => {
      sendBillEmail.restore();
      completionSendingPendingBillsEmail.restore();
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
