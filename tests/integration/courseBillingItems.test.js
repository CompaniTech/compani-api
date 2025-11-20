const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const CourseBillingItem = require('../../src/models/CourseBillingItem');
const app = require('../../server');
const { populateDB, courseBillingItemsList } = require('./seed/courseBillingItemsSeed');
const { getToken } = require('./helpers/authentication');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COURSE BILLING ITEM ROUTES - GET /coursebillingitems', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get all course billing items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/coursebillingitems',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBillingItems.length).toEqual(courseBillingItemsList.length);
    });
  });

  describe('Other roles', () => {
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
          method: 'GET',
          url: '/coursebillingitems',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILLING ITEM ROUTES - POST /coursebillingitems', () => {
  let authToken;
  beforeEach(populateDB);
  const payload = { name: 'article' };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a course billing item', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebillingitems',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      const count = await CourseBillingItem.countDocuments();

      expect(response.statusCode).toBe(200);
      expect(count).toBe(courseBillingItemsList.length + 1);
    });

    it('should return 409 if other billing item has exact same name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebillingitems',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { name: 'frais formateur' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if other billing item has same name (case and diacritics insensitive)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebillingitems',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { name: 'Frais Formateur' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 400 as name is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebillingitems',
        payload: {},
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
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
          url: '/coursebillingitems',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILLING ITEM ROUTES - DELETE /coursebillingitems', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete course billing item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebillingitems/${courseBillingItemsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      const count = await CourseBillingItem.countDocuments();

      expect(response.statusCode).toBe(200);
      expect(count).toBe(courseBillingItemsList.length - 1);
    });

    it('should return 404 if course billing item does not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebillingitems/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course billing item has bills', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebillingitems/${courseBillingItemsList[1]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/coursebillingitems/${courseBillingItemsList[0]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
