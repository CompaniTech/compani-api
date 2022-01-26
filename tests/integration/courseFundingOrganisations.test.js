const expect = require('expect');
const omit = require('lodash/omit');
const CourseFundingOrganisation = require('../../src/models/CourseFundingOrganisation');
const app = require('../../server');
const { populateDB, courseFundingOrganisationsList } = require('./seed/courseFundingOrganisationsSeed');
const { getToken } = require('./helpers/authentication');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COURSE FUNDING ORGANISATION ROUTES - GET /coursefundingorganisation', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get all course funding organisations', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/coursefundingorganisations',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseFundingOrganisations.length).toEqual(courseFundingOrganisationsList.length);
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
          url: '/coursefundingorganisations',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE FUNDING ORGANISATION ROUTES - POST /coursefundingorganisation', () => {
  let authToken;
  beforeEach(populateDB);
  const payload = {
    name: 'mon organisation',
    address: {
      street: '37 rue de Ponthieu',
      zipCode: '75008',
      city: 'Paris',
      fullAddress: '37 rue de Ponthieu 75008 Paris',
      location: { type: 'Point', coordinates: [2.0987, 1.2345] },
    },
  };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a course funding organisation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursefundingorganisations',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      const count = await CourseFundingOrganisation.countDocuments();

      expect(response.statusCode).toBe(200);
      expect(count).toBe(courseFundingOrganisationsList.length + 1);
    });

    it('should return 409 if name is already taken', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursefundingorganisations',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          ...payload,
          name: 'APA Paris',
        },
      });

      expect(response.statusCode).toBe(409);
    });

    const missingParams = ['name', 'address'];
    missingParams.forEach((param) => {
      it(`should return 400 as ${param} is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/coursefundingorganisations',
          payload: omit(payload, param),
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
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
          url: '/coursefundingorganisations',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
