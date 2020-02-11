const expect = require('expect');
const app = require('../../server');
const { populateDB, rolesList } = require('./seed/rolesSeed');
const { getToken, rolesList: authRolesList } = require('./seed/authenticationSeed');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('ROLES ROUTES', () => {
  let token = null;

  describe('GET /roles', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        token = await getToken('coach');
      });

      it('should return all roles', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/roles',
          headers: { 'x-access-token': token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.roles.length).toBe(rolesList.length + authRolesList.length);
        expect(res.result.data.roles[0]).toEqual(expect.objectContaining({
          name: expect.any(String),
          rights: expect.arrayContaining([
            expect.objectContaining({
              permission: expect.any(String),
              description: expect.any(String),
              hasAccess: expect.any(Boolean),
              right_id: expect.any(Object),
            }),
          ]),
        }));
      });

      it('should return a 400 error if query parameter does not exist', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/roles?toto=test',
          headers: { 'x-access-token': token },
        });
        expect(res.statusCode).toBe(400);
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          token = await getToken(role.name);
          const response = await app.inject({
            method: 'GET',
            url: '/roles',
            headers: { 'x-access-token': token },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });
});
