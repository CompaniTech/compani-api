const { expect } = require('expect');
const app = require('../../server');
const { populateDB } = require('./seed/scriptsSeed');
const { getToken } = require('./helpers/authentication');
const { courseList } = require('./seed/scriptsSeed');

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
      const response = await app.inject({
        method: 'GET',
        url: '/scripts/completioncertificates-generation?month=02-2025',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data).toEqual([courseList[0]._id, courseList[2]._id]);
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
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
