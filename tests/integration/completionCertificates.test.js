const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const { getToken } = require('./helpers/authentication');
const { populateDB, courseList } = require('./seed/completionCertificatesSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COMPLETION CERTIFICATES ROUTES - GET /completioncertificates', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get completion certificates for specified months', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/completioncertificates?months=02-2025',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(2);
    });

    it('should get completion certificates for a specific course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?course=${courseList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(3);
    });

    it('should return 400 if month has wrong format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/completioncertificates?months=12_2024',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if neither months nor course are defined', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/completioncertificates',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if both months and course are defined', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?months=02-2025&course=${courseList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?course=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'trainer', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/completioncertificates?months=02-2025',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
