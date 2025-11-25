const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const {
  populateDB,
  userWithCompanyLinkRequestList,
  companyLinkRequestList,
  usersSeedList,
} = require('./seed/companyLinkRequestsSeed');
const { getTokenByCredentials, getToken } = require('./helpers/authentication');
const { noRole } = require('../seed/authUsersSeed');
const { authCompany } = require('../seed/authCompaniesSeed');
const CompanyLinkRequest = require('../../src/models/CompanyLinkRequest');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COMPANY LINK REQUESTS ROUTES - POST /companylinkrequests', () => {
  let authToken;
  beforeEach(populateDB);

  describe('LOGGED USER', () => {
    it('should create a company link request', async () => {
      authToken = await getTokenByCredentials(usersSeedList[0].local);

      const response = await app.inject({
        method: 'POST',
        url: '/companylinkrequests',
        payload: { company: authCompany._id },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const companyLinkRequestsCount = await CompanyLinkRequest.countDocuments({ user: usersSeedList[0]._id });
      expect(companyLinkRequestsCount).toEqual(1);
    });

    it('should return 403 if user already has a company', async () => {
      authToken = await getTokenByCredentials(noRole.local);

      const response = await app.inject({
        method: 'POST',
        url: '/companylinkrequests',
        payload: { company: authCompany._id },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if user will have a company in the future', async () => {
      authToken = await getTokenByCredentials(usersSeedList[1].local);

      const response = await app.inject({
        method: 'POST',
        url: '/companylinkrequests',
        payload: { company: authCompany._id },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if company does not exist', async () => {
      authToken = await getTokenByCredentials(usersSeedList[0].local);

      const response = await app.inject({
        method: 'POST',
        url: '/companylinkrequests',
        payload: { company: new ObjectId() },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if user already has a company link request', async () => {
      authToken = await getTokenByCredentials(userWithCompanyLinkRequestList[0].local);

      const response = await app.inject({
        method: 'POST',
        url: '/companylinkrequests',
        payload: { company: authCompany._id },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('COMPANY LINK REQUESTS ROUTES - GET /companylinkrequests', () => {
  let authToken;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });
    it('should get all company link requests for company A', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/companylinkrequests',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.companyLinkRequests.length).toEqual(1);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'vendor_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/companylinkrequests',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COMPANY LINK REQUESTS ROUTES - DELETE /companylinkrequests', () => {
  let authToken;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });
    it('should remove company link request', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/companylinkrequests/${companyLinkRequestList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const companyLinkRequest = await CompanyLinkRequest.countDocuments({ _id: companyLinkRequestList[0]._id });
      expect(companyLinkRequest).toEqual(0);
    });

    it('should return 404 if company link request is for another company', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/companylinkrequests/${companyLinkRequestList[1]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'vendor_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/companylinkrequests/${userWithCompanyLinkRequestList[0]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
