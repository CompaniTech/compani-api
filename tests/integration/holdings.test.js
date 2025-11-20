const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const CompanyHolding = require('../../src/models/CompanyHolding');
const Holding = require('../../src/models/Holding');
const { populateDB, holdings, companies } = require('./seed/holdingsSeed');
const { getToken } = require('./helpers/authentication');
const { authCompany, otherCompany, authHolding } = require('../seed/authCompaniesSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('HOLDINGS ROUTES - POST /holdings', () => {
  let authToken;
  describe('TRAINING_ORGANISATION_MANAGER', () => {
    const payload = { name: 'Holding SARL', address: '24 avenue Daumesnil 75012 Paris' };

    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a new holding', async () => {
      const holdingsBefore = await Holding.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/holdings',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const holdingsCount = await Holding.countDocuments();
      expect(holdingsCount).toEqual(holdingsBefore + 1);
    });

    it('should return 409 if other holding has exact same name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/holdings',
        payload: { name: 'Auth Holding' },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if other holding has same name (case and diacritics insensitive)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/holdings',
        payload: { name: 'Aûth Holding' },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 400 error if missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/holdings',
        payload: { address: '24 avenue Daumesnil 75012 Paris' },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const payload = { name: 'Holding SARL' };

    beforeEach(populateDB);

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/holdings',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('HOLDINGS ROUTES - GET /holdings', () => {
  let authToken;
  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);

    it('should list holdings', async () => {
      authToken = await getToken('training_organisation_manager');
      const response = await app.inject({
        method: 'GET',
        url: '/holdings',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.holdings.length).toEqual(3);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/holdings',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('HOLDINGS ROUTES - PUT /holdings/{_id}', () => {
  let authToken;
  const payload = { companies: [companies[0]._id] };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should link a company to a holding', async () => {
      const companyHoldingsBefore = await CompanyHolding.countDocuments({ holding: holdings[0]._id });

      const response = await app.inject({
        method: 'PUT',
        url: `/holdings/${holdings[0]._id}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const companyHoldingsCount = await CompanyHolding.countDocuments({ holding: holdings[0]._id });
      expect(companyHoldingsCount).toEqual(companyHoldingsBefore + 1);
    });

    it('should link some companies to a holding', async () => {
      const companyHoldingsBefore = await CompanyHolding.countDocuments({ holding: holdings[0]._id });

      const response = await app.inject({
        method: 'PUT',
        url: `/holdings/${holdings[0]._id}`,
        payload: { companies: [companies[0]._id, companies[1]._id] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const companyHoldingsCount = await CompanyHolding.countDocuments({ holding: holdings[0]._id });
      expect(companyHoldingsCount).toEqual(companyHoldingsBefore + 2);
    });

    it('should return 403 if company is linked to other holding', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/holdings/${holdings[0]._id}`,
        payload: { companies: [companies[0]._id, otherCompany._id] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 404 error if holding doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/holdings/${new ObjectId()}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 error if company doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/holdings/${holdings[0]._id}`,
        payload: { companies: [companies[0]._id, new ObjectId()] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 400 if there is no companies in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/holdings/${holdings[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { companies: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if there is no companies field in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/holdings/${holdings[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/holdings/${holdings[0]._id}`,
          payload,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('HOLDINGS ROUTES - GET /holdings/{_id}', () => {
  let authToken;

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get a holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/holdings/${authHolding._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.holding).toMatchObject({
        _id: authHolding._id,
        name: 'Auth Holding',
        companies: [expect.objectContaining({ _id: authCompany._id, name: 'Test SAS' })],
      });
    });

    it('should return a 404 error if holding doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/holdings/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/holdings/${authHolding._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
