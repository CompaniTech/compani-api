const expect = require('expect');
const app = require('../../server');
const { ObjectID } = require('mongodb');
const Activity = require('../../src/models/Activity');
const { populateDB, activitiesList } = require('./seed/activitiesSeed');
const { getToken } = require('./seed/authenticationSeed');
const { TITLE_TEXT_MEDIA } = require('../../src/helpers/constants');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('ACTIVITY ROUTES - GET /activity/{_id}', () => {
  let authToken = null;
  beforeEach(populateDB);
  const activityId = activitiesList[0]._id;

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should get activity', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/activities/${activityId.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.activity).toEqual(expect.objectContaining({
        _id: activityId,
        name: 'manger',
        cards: expect.arrayContaining([expect.objectContaining({
          _id: expect.any(ObjectID),
          template: 'transition',
        }),
        expect.objectContaining({
          _id: expect.any(ObjectID),
          template: 'flashcard',
          backText: 'ceci est un backText',
        })]),
      }));
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/activities/${activityId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('ACTIVITY ROUTES - PUT /activity/{_id}', () => {
  let authToken = null;
  beforeEach(populateDB);
  const activityId = activitiesList[0]._id;
  const payload = { name: 'rigoler' };

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it("should update activity's name", async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/activities/${activityId.toHexString()}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      const activityUpdated = await Activity.findById(activityId);

      expect(response.statusCode).toBe(200);
      expect(activityUpdated).toEqual(expect.objectContaining({ _id: activityId, name: 'rigoler' }));
    });

    it("should return a 400 if name is equal to '' ", async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/activities/${activityId.toHexString()}`,
        payload: { name: '' },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          payload,
          url: `/activities/${activityId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('ACTIVITIES ROUTES - POST /activities/{_id}/card', () => {
  let authToken = null;
  const activityId = activitiesList[0]._id;
  beforeEach(populateDB);
  const payload = { template: TITLE_TEXT_MEDIA };

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should create card', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/activities/${activityId.toHexString()}/card`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      const activityUpdated = await Activity.findById(activityId);

      expect(response.statusCode).toBe(200);
      expect(activityUpdated._id).toEqual(activityId);
      expect(activityUpdated.cards.length).toEqual(2);
    });

    it('should return a 400 if invalid template', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/activities/${activityId.toHexString()}/card`,
        payload: { template: 'invalid template' },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if missing template', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/activities/${activityId.toHexString()}/card`,
        payload: {},
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if activity does not exist', async () => {
      const wrongId = new ObjectID();
      const response = await app.inject({
        method: 'POST',
        url: `/activities/${wrongId}/card`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          payload: { template: 'transition' },
          url: `/activities/${activityId.toHexString()}/card`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
