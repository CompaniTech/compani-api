const { ObjectID } = require('mongodb');
const expect = require('expect');
const fs = require('fs');
const path = require('path');
const GetStream = require('get-stream');
const sinon = require('sinon');
const omit = require('lodash/omit');
const app = require('../../server');
const User = require('../../src/models/User');
const {
  usersSeedList,
  userPayload,
  populateDB,
  isExistingRole,
  isInList,
} = require('./seed/usersSeed');
const { getToken, userList, getTokenByCredentials } = require('./seed/authenticationSeed');
const GdriveStorage = require('../../src/helpers/gdriveStorage');
const { generateFormData } = require('./utils');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('USERS ROUTES', () => {
  let authToken = null;

  describe('POST /users', () => {
    describe('Admin', () => {
      let res = null;
      let user = null;
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin');
      });
      it('should not create a user if missing parameters', async () => {
        const payload = { ...userPayload };
        delete payload.role;
        const response = await app.inject({
          method: 'POST',
          url: '/users',
          payload,
          headers: { 'x-access-token': authToken },
        });
        expect(response.statusCode).toBe(400);
      });

      it('should create a user', async () => {
        res = await app.inject({
          method: 'POST',
          url: '/users',
          payload: userPayload,
          headers: { 'x-access-token': authToken },
        });

        expect(res.statusCode).toBe(200);
        expect(res.result.data.user._id).toEqual(expect.any(Object));
        expect(res.result.data.user.role).toMatchObject({
          name: 'auxiliary',
          rights: expect.arrayContaining([
            expect.objectContaining({
              description: expect.any(String),
              hasAccess: expect.any(Boolean),
              permission: expect.any(String),
              right_id: expect.any(Object),
            }),
          ]),
        });
        user = await User.findById(res.result.data.user._id);
        expect(user.firstname).toBe(userPayload.firstname);
        expect(user.identity.lastname).toBe(userPayload.identity.lastname);
        expect(user.local.email).toBe(userPayload.local.email);
        expect(user.local.password).toBeDefined();
        expect(user).toHaveProperty('picture');
        expect(user.procedure).toBeDefined();
        expect(user.procedure.length).toBeGreaterThan(0);
      });

      it('should not create a user if role provided does not exist', async () => {
        const payload = { ...userPayload, role: new ObjectID() };
        const response = await app.inject({
          method: 'POST',
          url: '/users',
          payload,
          headers: { 'x-access-token': authToken },
        });
        expect(response.statusCode).toBe(400);
      });

      it('should not create a user if email provided already exists', () => {
        const userPayload2 = {
          idenity: {
            firstname: 'Test',
            lastname: 'Test',
          },
          local: {
            email: 'horseman@alenvi.io',
            password: '123456',
          },
          role: new ObjectID(),
        };
        expect(async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/users',
            payload: userPayload2,
            headers: { 'x-access-token': authToken },
          });
          expect(response).toThrow('NoRole');
          expect(response.statusCode).toBe(409);
        });
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name);
          const response = await app.inject({
            method: 'POST',
            url: '/users',
            payload: { ...userPayload },
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('POST /users/authenticate', () => {
    beforeEach(populateDB);
    it('should authenticate a user', async () => {
      const credentials = {
        email: 'horseman@alenvi.io',
        password: '123456',
      };
      const response = await app.inject({
        method: 'POST',
        url: '/users/authenticate',
        payload: credentials,
      });
      expect(response.statusCode).toBe(200);
      expect(response.result.data).toEqual(expect.objectContaining({
        token: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
        user: expect.objectContaining({
          _id: expect.any(String),
          role: expect.any(String),
        }),
      }));
    });

    it('should authenticate a user if email has capitals', async () => {
      const credentials = {
        email: 'Horseman@alenvi.io',
        password: '123456',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/users/authenticate',
        payload: credentials,
      });
      expect(res.statusCode).toBe(200);
    });

    it('should not authenticate a user if missing parameter', async () => {
      const credentials = {
        email: 'horseman@alenvi.io',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/users/authenticate',
        payload: credentials,
      });
      expect(res.statusCode).toBe(400);
    });

    it('should not authenticate a user if user does not exist', async () => {
      const credentials = {
        email: 'test@alenvi.io',
        password: '123456',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/users/authenticate',
        payload: credentials,
      });
      expect(res.statusCode).toBe(404);
    });

    it('should not authenticate a user if wrong password', async () => {
      const credentials = {
        email: 'horseman@alenvi.io',
        password: '7890',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/users/authenticate',
        payload: credentials,
      });
      expect(res.statusCode).toBe(401);
    });

    it('should not authenticate a user if refreshToken is missing', async () => {
      const credentials = {
        email: 'white@alenvi.io',
        password: '123456',
      };
      await User.findOneAndUpdate({ 'local.email': 'white@alenvi.io' }, { $unset: { refreshToken: '' } });
      const res = await app.inject({
        method: 'POST',
        url: '/users/authenticate',
        payload: credentials,
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /users', () => {
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin');
      });

      it('should get all users (company A)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/users',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.users.length).toBe(userList.length);
        expect(res.result.data.users[0]).toHaveProperty('role');
        expect(res.result.data.users[0].role._id.toHexString()).toEqual(expect.any(String));
      });

      it('should get all users (company B)', async () => {
        authToken = await getTokenByCredentials(usersSeedList[0].local);

        const res = await app.inject({
          method: 'GET',
          url: '/users',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.users.length).toBe(usersSeedList.length);
        expect(res.result.data.users[0]).toHaveProperty('role');
        expect(res.result.data.users[0].role._id.toHexString()).toEqual(expect.any(String));
      });

      it('should get all coachs users (company A)', async () => {
        const coachUsers = userList.filter(u => isExistingRole(u.role, 'coach'));

        const res = await app.inject({
          method: 'GET',
          url: '/users?role=coach',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.users.length).toBe(coachUsers.length);
        expect(res.result.data.users[0]).toHaveProperty('role');
        expect(res.result.data.users[0].role.name).toEqual('coach');
      });

      it('should get all coachs users (company B)', async () => {
        authToken = await getTokenByCredentials(usersSeedList[0].local);
        const coachUsers = usersSeedList.filter(u => isExistingRole(u.role, 'coach'));

        const res = await app.inject({
          method: 'GET',
          url: '/users?role=coach',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.users.length).toBe(coachUsers.length);
        expect(res.result.data.users[0]).toHaveProperty('role');
        expect(res.result.data.users[0].role.name).toEqual('coach');
      });

      it("should not get users if role given doesn't exist", async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/users?role=Babouin',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(404);
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 200 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name);
          const response = await app.inject({
            method: 'GET',
            url: '/users',
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('GET /users/active', () => {
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin');
      });

      it('should get all active users (company A)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/users/active',
          headers: { 'x-access-token': authToken },
        });

        expect(res.statusCode).toBe(200);
        const activeUsers = userList.filter(u => isInList(res.result.data.users, u));
        expect(res.result.data.users.length).toBe(activeUsers.length);
        expect(res.result.data.users).toEqual(expect.arrayContaining([
          expect.objectContaining({ isActive: true }),
        ]));
        expect(res.result.data.users[0].isActive).toBeTruthy();
      });

      it('should get all active users (company B)', async () => {
        authToken = await getTokenByCredentials(usersSeedList[0].local);

        const res = await app.inject({
          method: 'GET',
          url: '/users/active',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        const activeUsers = usersSeedList.filter(u => isInList(res.result.data.users, u));
        expect(res.result.data.users.length).toBe(activeUsers.length);
        expect(res.result.data.users).toEqual(expect.arrayContaining([
          expect.objectContaining({ isActive: true }),
        ]));
        expect(res.result.data.users[0].isActive).toBeTruthy();
      });

      it('should get all active auxiliary users (company A)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/users/active?role=auxiliary',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        const activeUsers = userList.filter(u => isInList(res.result.data.users, u) && isExistingRole(u.role, 'auxiliary'));
        expect(res.result.data.users.length).toBe(activeUsers.length);
      });

      it('should get all active auxiliary users (company B)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/users/active?role=auxiliary',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.users[0]).toHaveProperty('role');
        expect(res.result.data.users[0].role.name).toEqual('auxiliary');
        expect(res.result.data.users[0]).toHaveProperty('isActive');
        expect(res.result.data.users[0].isActive).toBeTruthy();
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 200 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name);
          const response = await app.inject({
            method: 'GET',
            url: '/users/active',
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('GET /users/:id', () => {
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin', usersSeedList);
      });
      it('should return user', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/users/${usersSeedList[0]._id.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(res.statusCode).toBe(200);
        expect(res.result.data.user).toBeDefined();
        expect(res.result.data.user).toEqual(expect.objectContaining({
          identity: expect.objectContaining({
            firstname: usersSeedList[0].identity.firstname,
            lastname: usersSeedList[0].identity.lastname,
          }),
          local: expect.objectContaining({ email: usersSeedList[0].local.email }),
          role: expect.objectContaining({ name: 'auxiliary' }),
          isActive: expect.any(Boolean),
        }));
      });

      it('should return a 404 error if no user found', async () => {
        const id = new ObjectID().toHexString();
        const res = await app.inject({
          method: 'GET',
          url: `/users/${id}`,
          headers: { 'x-access-token': authToken },
        });

        expect(res.statusCode).toBe(404);
      });

      it('should return a 403 error if user is not from same company', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/users/${userList[0]._id}`,
          headers: { 'x-access-token': authToken },
        });

        expect(res.statusCode).toBe(403);
      });
    });

    describe('Other roles', () => {
      it('should return user if it is me', async () => {
        authToken = await getToken('auxiliary', usersSeedList);

        const response = await app.inject({
          method: 'GET',
          url: `/users/${usersSeedList[0]._id.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
      });

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name, usersSeedList);

          const response = await app.inject({
            method: 'GET',
            url: `/users/${usersSeedList[1]._id.toHexString()}`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('PUT /users/:id/', () => {
    const updatePayload = {
      identity: {
        firstname: 'Riri',
      },
      local: {
        email: 'riri@alenvi.io',
        password: '098765',
      },
      role: userPayload.role,
    };
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin', usersSeedList);
      });
      it('should update the user', async () => {
        const res = await app.inject({
          method: 'PUT',
          url: `/users/${usersSeedList[0]._id.toHexString()}`,
          payload: updatePayload,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.updatedUser).toBeDefined();
        expect(res.result.data.updatedUser).toMatchObject({
          _id: usersSeedList[0]._id,
          identity: expect.objectContaining({
            firstname: updatePayload.identity.firstname,
          }),
          local: expect.objectContaining({ email: updatePayload.local.email, password: expect.any(String) }),
          role: { _id: updatePayload.role },
        });
        const updatedUser = await User.findById(res.result.data.updatedUser._id).populate({ path: 'role' });
        expect(updatedUser.identity.firstname).toBe(updatePayload.identity.firstname);
        expect(updatedUser.local.email).toBe(updatePayload.local.email);
        expect(updatedUser.role._id).toEqual(updatePayload.role);
      });

      it('should return a 404 error if no user found', async () => {
        const id = new ObjectID().toHexString();
        const res = await app.inject({
          method: 'PUT',
          url: `/users/${id}`,
          payload: {},
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(404);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      it('should update user if it is me', async () => {
        authToken = await getToken('auxiliary', usersSeedList);

        const response = await app.inject({
          method: 'PUT',
          url: `/users/${usersSeedList[0]._id.toHexString()}`,
          payload: updatePayload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
      });

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name);

          const response = await app.inject({
            method: 'PUT',
            url: `/users/${userList[1]._id.toHexString()}`,
            payload: updatePayload,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('DELETE /users/:id', () => {
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin', usersSeedList);
      });
      it('should delete a user by id', async () => {
        const res = await app.inject({
          method: 'DELETE',
          url: `/users/${usersSeedList[0]._id}`,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
      });

      it('should return a 404 error if user is not found', async () => {
        const objectId = new ObjectID();
        const res = await app.inject({
          method: 'DELETE',
          url: `/users/${objectId}`,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(404);
      });

      it('should return a 400 error _id query is not an objectId', async () => {
        const res = await app.inject({
          method: 'DELETE',
          url: '/users/123',
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(400);
      });

      it('should return a 403 error if user is not from same company', async () => {
        const res = await app.inject({
          method: 'DELETE',
          url: `/users/${userList[0]._id}`,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(403);
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name, usersSeedList);
          const response = await app.inject({
            method: 'DELETE',
            url: `/users/${usersSeedList[0]._id}`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('POST /users/refreshToken', () => {
    beforeEach(populateDB);
    it('should return refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/users/refreshToken',
        payload: {
          refreshToken: usersSeedList[1].refreshToken,
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return a 404 error when refresh token isn\'t good', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/users/refreshToken',
        payload: {
          refreshToken: 'b171c888-6874-45fd-9c4e-1a9daf0231ba',
        },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /users/:id/certificates', () => {
    const updatePayload = {
      'administrative.certificates': { driveId: usersSeedList[0].administrative.certificates.driveId },
    };
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin', usersSeedList);
      });

      it('should update user certificates', async () => {
        const res = await app.inject({
          method: 'PUT',
          url: `/users/${usersSeedList[0]._id.toHexString()}/certificates`,
          payload: updatePayload,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.updatedUser.administrative.certificates.length)
          .toBe(usersSeedList[0].administrative.certificates.length - 1);
      });

      it('should return a 404 error if no user found', async () => {
        const id = new ObjectID().toHexString();
        const res = await app.inject({
          method: 'PUT',
          url: `/users/${id}`,
          payload: {},
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(404);
      });

      it('should return a 403 error if user is not from same company', async () => {
        const res = await app.inject({
          method: 'PUT',
          url: `/users/${userList[2]._id.toHexString()}/certificates`,
          payload: updatePayload,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(403);
      });
    });

    describe('Other roles', () => {
      it('should update user certificate if it is me', async () => {
        authToken = await getToken('auxiliary', usersSeedList);

        const response = await app.inject({
          method: 'PUT',
          url: `/users/${usersSeedList[0]._id.toHexString()}/certificates`,
          payload: updatePayload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
      });

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name, usersSeedList);

          const response = await app.inject({
            method: 'PUT',
            url: `/users/${usersSeedList[1]._id.toHexString()}/certificates`,
            payload: updatePayload,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('PUT /users/:id/tasks/:task_id', () => {
    const taskPayload = { isDone: true };
    const userId = usersSeedList[0]._id.toHexString();
    const taskId = usersSeedList[0].procedure[0].task;

    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin', usersSeedList);
      });
      it('should update a user task', async () => {
        const res = await app.inject({
          method: 'PUT',
          url: `/users/${userId}/tasks/${taskId}`,
          payload: taskPayload,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        const user = await User.findById(usersSeedList[0]._id, { procedure: 1 }).lean();
        expect(user.procedure[0].check).toMatchObject({ isDone: true, at: expect.any(Date) });
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name, usersSeedList);
          const response = await app.inject({
            method: 'PUT',
            url: `/users/${usersSeedList[1]._id.toHexString()}/tasks/${taskId}`,
            payload: taskPayload,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('GET /users/:id/tasks', () => {
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin', usersSeedList);
      });
      it('should return user tasks', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/users/${usersSeedList[0]._id.toHexString()}/tasks`,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.data.user).toBeDefined();
        expect(res.result.data.tasks.length).toBe(usersSeedList[0].procedure.length);
      });

      it('should return a 404 error if no user found', async () => {
        const id = new ObjectID().toHexString();
        const res = await app.inject({
          method: 'GET',
          url: `/users/${id}`,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(404);
      });

      it('should return a 403 error if user not from same company', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/users/${userList[2]._id}`,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(403);
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name, usersSeedList);
          const response = await app.inject({
            method: 'GET',
            url: `/users/${usersSeedList[1]._id.toHexString()}/tasks`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('POST /users/:id/gdrive/:drive_id/upload', () => {
    const userFolderId = usersSeedList[0].administrative.driveFolder.driveId;
    let docPayload;
    let form;
    let addFileStub;
    beforeEach(() => {
      docPayload = {
        mutualFund: fs.createReadStream(path.join(__dirname, 'assets/test_esign.pdf')),
        fileName: 'mutual_fund_doc',
      };
      form = generateFormData(docPayload);
      addFileStub = sinon
        .stub(GdriveStorage, 'addFile')
        .returns({ id: 'qwerty', webViewLink: 'http://test.com/file.pdf' });
    });

    afterEach(() => {
      addFileStub.restore();
    });
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin', usersSeedList);
      });
      it('should add an administrative document for a user', async () => {
        const response = await app.inject({
          method: 'POST',
          url: `/users/${usersSeedList[0]._id}/gdrive/${userFolderId}/upload`,
          payload: await GetStream(form),
          headers: { ...form.getHeaders(), 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.uploadedFile).toMatchObject({ id: 'qwerty' });
        const user = await User.findById(usersSeedList[0]._id, { administrative: 1 }).lean();
        expect(user.administrative.mutualFund).toMatchObject({
          driveId: 'qwerty',
          link: 'http://test.com/file.pdf',
        });
        sinon.assert.calledOnce(addFileStub);
      });

      it('should return a 403 error if user is not from same company', async () => {
        authToken = await getToken('admin', usersSeedList);

        const response = await app.inject({
          method: 'POST',
          url: `/users/${userList[2]._id}/gdrive/${new ObjectID()}/upload`,
          payload: await GetStream(form),
          headers: { ...form.getHeaders(), 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(403);
      });

      const wrongParams = ['mutualFund', 'fileName'];
      wrongParams.forEach((param) => {
        it(`should return a 400 error if missing '${param}' parameter`, async () => {
          form = generateFormData(omit(docPayload, param));
          const response = await app.inject({
            method: 'POST',
            url: `/users/${usersSeedList[0]._id}/gdrive/${userFolderId}/upload`,
            payload: await GetStream(form),
            headers: { ...form.getHeaders(), 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(400);
        });
      });
    });

    describe('Other roles', () => {
      it('should add administrative document if it is me', async () => {
        authToken = await getToken('auxiliary', usersSeedList);

        const response = await app.inject({
          method: 'POST',
          url: `/users/${usersSeedList[0]._id}/gdrive/${userFolderId}/upload`,
          payload: await GetStream(form),
          headers: { ...form.getHeaders(), 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
      });

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name, usersSeedList);

          const response = await app.inject({
            method: 'POST',
            url: `/users/${usersSeedList[1]._id}/gdrive/${usersSeedList[1].administrative.driveFolder}/upload`,
            payload: await GetStream(form),
            headers: { ...form.getHeaders(), 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('POST /users/:id/drivefolder', () => {
    let createFolderStub;
    const folderPayload = { parentFolderId: '0987654321' };

    beforeEach(() => {
      createFolderStub = sinon
        .stub(GdriveStorage, 'createFolder')
        .returns({ id: '1234567890', webViewLink: 'http://test.com' });
    });

    afterEach(() => {
      createFolderStub.restore();
    });

    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin', usersSeedList);
      });

      it('should create a drive folder for a user', async () => {
        const response = await app.inject({
          method: 'POST',
          url: `/users/${usersSeedList[0]._id.toHexString()}/drivefolder`,
          payload: folderPayload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.updatedUser).toBeDefined();
        expect(response.result.data.updatedUser.administrative.driveFolder)
          .toMatchObject({ driveId: '1234567890', link: 'http://test.com' });
        sinon.assert.calledWithExactly(
          createFolderStub,
          sinon.match(usersSeedList[0].identity),
          folderPayload.parentFolderId
        );
      });
    });

    describe('Other roles', () => {
      it('should create a drive folder if it is me', async () => {
        authToken = await getToken('auxiliary', usersSeedList);

        const response = await app.inject({
          method: 'POST',
          url: `/users/${usersSeedList[0]._id.toHexString()}/drivefolder`,
          payload: folderPayload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
      });

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name, usersSeedList);

          const response = await app.inject({
            method: 'POST',
            url: `/users/${usersSeedList[1]._id.toHexString()}/drivefolder`,
            payload: folderPayload,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });
});
