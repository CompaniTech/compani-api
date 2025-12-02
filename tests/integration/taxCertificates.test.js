const { expect } = require('expect');
const app = require('../../server');
const { populateDB, taxCertificatesList } = require('./seed/taxCertificatesSeed');
const { getToken } = require('./helpers/authentication');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('TAX CERTIFICATES ROUTES - GET /{_id}/pdf', () => {
  let authToken;
  describe('COACH', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get tax certificates pdf', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/taxcertificates/${taxCertificatesList[0]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should should return 404 if tax certificate from another organisation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/taxcertificates/${taxCertificatesList[2]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'vendor_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'helper', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/taxcertificates/${taxCertificatesList[0]._id}/pdfs`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
