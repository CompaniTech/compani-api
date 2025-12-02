const { expect } = require('expect');
const app = require('../../server');
const { populateDB, rolesList } = require('./seed/rolesSeed');
const { getToken } = require('./helpers/authentication');
const { rolesList: authRolesList } = require('../seed/authRolesSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('ROLES ROUTES - GET /roles', () => {
  let authToken;
  describe('COACH', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should return all roles', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/roles',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.result.data.roles.length).toBe(rolesList.length + authRolesList.length);
    });

    it('should return a specific role', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/roles?name=chef',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.result.data.roles.length).toBe(1);
    });

    it('should return an array of roles', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/roles?name=chef&name=general',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.result.data.roles.length).toBe(2);
    });

    it('should return 404 if role doesn\'t exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/roles?name=caporal',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/roles',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
