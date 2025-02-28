const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const sinon = require('sinon');
const omit = require('lodash/omit');
const get = require('lodash/get');
const pick = require('lodash/pick');
const app = require('../../server');
const User = require('../../src/models/User');
const ActivityHistory = require('../../src/models/ActivityHistory');
const Course = require('../../src/models/Course');
const CompanyLinkRequest = require('../../src/models/CompanyLinkRequest');
const Role = require('../../src/models/Role');
const UserCompany = require('../../src/models/UserCompany');
const Helper = require('../../src/models/Helper');
const UserHolding = require('../../src/models/UserHolding');
const {
  HELPER,
  COACH,
  AUXILIARY,
  TRAINER,
  MOBILE,
  WEBAPP,
  DAY,
  CLIENT_ADMIN,
  HOLDING_ADMIN,
} = require('../../src/helpers/constants');
const {
  usersSeedList,
  usersFromDifferentCompanyList,
  populateDB,
  helperFromOtherCompany,
  auxiliaryFromOtherCompany,
  coachFromOtherCompany,
} = require('./seed/usersSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const {
  otherCompany,
  authCompany,
  companyWithoutSubscription,
  authHolding,
  otherHolding,
} = require('../seed/authCompaniesSeed');
const {
  coach,
  trainer,
  userList,
  noRoleNoCompany,
  holdingAdminFromAuthCompany,
  holdingAdminFromOtherCompany,
} = require('../seed/authUsersSeed');
const { rolesList, auxiliaryRoleId, coachRoleId, trainerRoleId, helperRoleId } = require('../seed/authRolesSeed');
const GCloudStorageHelper = require('../../src/helpers/gCloudStorage');
const { CompaniDate } = require('../../src/helpers/dates/companiDates');
const UtilsHelper = require('../../src/helpers/utils');
const { generateFormData, getStream } = require('./utils');
const UtilsMock = require('../utilsMock');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('USERS ROUTES - POST /users', () => {
  let authToken;
  describe('NOT_CONNECTED', () => {
    beforeEach(populateDB);

    it('should create user', async () => {
      const payload = {
        identity: { firstname: 'Test', lastname: 'Kirk' },
        local: { email: 'newuser@alenvi.io', password: 'testpassword' },
        origin: MOBILE,
      };

      const res = await app.inject({ method: 'POST', url: '/users', payload });

      expect(res.statusCode).toBe(200);

      const { user } = res.result.data;
      expect(user._id).toEqual(expect.any(Object));
      expect(user.identity.firstname).toBe('Test');
      expect(user.identity.lastname).toBe('Kirk');
      expect(user.local.email).toBe('newuser@alenvi.io');
      expect(res.result.data.user.refreshToken).not.toBeDefined();
      expect(res.result.data.user.local.password).not.toBeDefined();
    });

    it('should not create user if password too short', async () => {
      const payload = {
        identity: { firstname: 'Test', lastname: 'Kirk' },
        local: { email: 'newuser@alenvi.io', password: 'test' },
        contact: { phone: '0606060606' },
        origin: MOBILE,
      };

      const res = await app.inject({ method: 'POST', url: '/users', payload });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('COACH', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should create a user', async () => {
      const payload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        role: auxiliaryRoleId,
        origin: WEBAPP,
      };
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.user._id).toEqual(expect.any(Object));
      expect(res.result.data.user.identity.firstname).toBe(payload.identity.firstname);
      expect(res.result.data.user.identity.lastname).toBe(payload.identity.lastname);
      expect(res.result.data.user.local.email).toBe(payload.local.email);
      expect(res.result.data.user.serialNumber).toEqual(expect.any(String));

      const userId = res.result.data.user._id;

      const userCompanyCount = await UserCompany.countDocuments({
        user: userId,
        company: authCompany._id,
        startDate: CompaniDate().startOf(DAY).toISO(),
      });
      expect(userCompanyCount).toEqual(1);
    });

    it('should return a 403 if password in payload', async () => {
      const payload = {
        identity: { firstname: 'Test', lastname: 'Kirk' },
        local: { email: 'newuser@alenvi.io', password: 'testpassword' },
        contact: { phone: '0606060606' },
        origin: MOBILE,
      };
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return a 400 if role provided does not exist', async () => {
      const payload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        origin: WEBAPP,
        role: new ObjectId(),
      };
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 403 user if not from his company', async () => {
      const payload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        origin: WEBAPP,
        contact: { phone: '0712345678' },
        company: otherCompany._id,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 400 user if payload has not company but has userCompanyStartDate', async () => {
      const payload = {
        identity: { firstname: 'Apprenant', lastname: 'Luce' },
        local: { email: 'apprenant.gary@alenvi.io' },
        origin: WEBAPP,
        contact: { phone: '0727274044' },
        userCompanyStartDate: '2022-12-13T11:00:11.000Z',
      };
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 409 if email provided already exists', async () => {
      const payload = {
        identity: { firstname: 'user', lastname: 'Kirk' },
        origin: WEBAPP,
        local: { email: usersSeedList[0].local.email },
        contact: { phone: '0712345678' },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 400 if phone number is not correct', async () => {
      const payload = {
        identity: { firstname: 'Bonjour', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        origin: WEBAPP,
        contact: { phone: '023' },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    ['local.email', 'identity.lastname', 'origin'].forEach((param) => {
      it(`should return a 400 error if '${param}' is missing in payload`, async () => {
        const payload = {
          identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
          local: { email: 'kirk@alenvi.io' },
          origin: WEBAPP,
          contact: { phone: '0712345678' },
        };
        const res = await app.inject({
          method: 'POST',
          url: '/users',
          payload: omit(payload, param),
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(res.statusCode).toBe(400);
      });
    });

    it('should return a 403 if created user has no role and payload has no phone', async () => {
      const payload = {
        identity: { firstname: 'Chloé', lastname: '6,022 140 76 × 10^(23) atomes' },
        local: { email: 'chlochlo@alenvi.io' },
        origin: WEBAPP,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should create a user', async () => {
      const payload = {
        identity: { firstname: 'user', lastname: 'FromThirdCompany' },
        local: { email: 'user.thirdcompany@alenvi.io' },
        origin: WEBAPP,
        company: companyWithoutSubscription._id,
        contact: { phone: '0987654321' },
      };
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 403 if company not in holding', async () => {
      const payload = {
        identity: { firstname: 'user', lastname: 'FromAuthCompany' },
        local: { email: 'user.authcompany@alenvi.io' },
        origin: WEBAPP,
        company: authCompany._id,
        contact: { phone: '0987654321' },
      };
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a user for another company', async () => {
      const payload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        role: coachRoleId,
        origin: WEBAPP,
        company: otherCompany._id,
        userCompanyStartDate: '2022-12-13T15:00:30.000Z',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const userCompanyCount = await UserCompany.countDocuments({
        user: response.result.data.user._id,
        company: otherCompany._id,
        startDate: '2022-12-12T23:00:00.000Z',
      });
      expect(userCompanyCount).toEqual(1);
    });

    it('should create a trainer', async () => {
      const payload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        role: trainerRoleId,
        origin: WEBAPP,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('TRAINER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should create a user with company and without role', async () => {
      const payload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        origin: WEBAPP,
        contact: { phone: '0712345678' },
        company: otherCompany._id,
        userCompanyStartDate: '2022-11-14T23:00:00.000Z',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const userId = response.result.data.user._id;

      const userCount = await User.countDocuments({ _id: userId });
      expect(userCount).toEqual(1);
      const updatedCompany = await UserCompany.countDocuments({ user: userId, startDate: '2022-11-14T23:00:00.000Z' });
      expect(updatedCompany).toBeTruthy();
    });

    it('should return 403 if create user without company', async () => {
      const payload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        origin: WEBAPP,
        contact: { phone: '0712345678' },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if create user with role', async () => {
      const payload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: 'kirk@alenvi.io' },
        role: trainerRoleId,
        origin: WEBAPP,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];
    beforeEach(populateDB);

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const payload = {
          identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
          local: { email: 'kirk@alenvi.io' },
          origin: MOBILE,
          contact: { phone: '0712345678' },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/users',
          payload,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - GET /users', () => {
  let authToken;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get all coachs users (company A), role as a string', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${authCompany._id}&role=coach`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(4);
      expect(res.result.data.users.every(u => get(u, 'role.client.name') === COACH)).toBeTruthy();
    });

    it(
      'should get all auxiliaries and helpers users (company A in present or future), role as an array of strings',
      async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/users?company=${authCompany._id}&role=helper&role=auxiliary`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(res.statusCode).toBe(200);
        expect(res.result.data.users.length).toBe(5);
        expect(res.result.data.users.every(u => [HELPER, AUXILIARY]
          .includes(get(u, 'role.client.name')))).toBeTruthy();
      }
    );

    it('should return 400 if wrong role in query', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${authCompany._id}&role=Babouin`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return a 403 if company is not the same and does not have a vendor role', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 403 if try to get holding users', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?holding=${authHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should get all client admin from another company from same holding', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${companyWithoutSubscription._id}&role=client_admin`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(1);
      expect(res.result.data.users.every(u => get(u, 'role.client.name') === CLIENT_ADMIN)).toBeTruthy();
    });

    it('should get all client admin from holding', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?holding=${otherHolding._id}&role=client_admin`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(1);
      expect(res.result.data.users.every(u => get(u, 'role.client.name') === CLIENT_ADMIN)).toBeTruthy();
    });

    it('should get 403 if no company or holding in query', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?role=client_admin',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should get 403 if wrong holding', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?holding=${authHolding._id}&role=client_admin`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return a 403 if company is not in holding and does not have a vendor role', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get all users from all companies', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const countUserInDB = userList.length + usersSeedList.length + usersFromDifferentCompanyList.length;
      expect(res.result.data.users.length).toBe(countUserInDB);
    });

    it('should get users from an other company', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(4);
    });

    it('should get users from a holding', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?holding=${authHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(23);
    });

    it('should get trainees with company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/users?withCompanyUsers=${true}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.users.length).toBe(27);
    });

    it('should get all coachs users from company, holding admins included, role as a string', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${companyWithoutSubscription._id}&role=coach&includeHoldingAdmins=true`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(1);
      expect(res.result.data.users.every(u => get(u, 'role.client.name') === COACH)).toBeTruthy();
    });

    it('should get all various roles from company, roles as a string', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${authCompany._id}&role=client_admin&role=holding_admin`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(3);
      expect(
        res.result.data.users
          .every(u => get(u, 'role.client.name') === CLIENT_ADMIN || get(u, 'role.holding.name') === HOLDING_ADMIN)
      ).toBeTruthy();
    });

    it('should return a 404 if company does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?company=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 if holding does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?holding=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 if holding and company in query', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?holding=${authHolding._id}&company=${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if holding, company and withCompanyUsers in query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/users?holding=${authHolding._id}&company=${authCompany._id}&withCompanyUsers=${true}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if includeHoldingAdmins and not company in query', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?holding=${authHolding._id}&includeHoldingAdmins=true`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 200 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/users?company=${authCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - GET /users/exists', () => {
  const fieldsToPick = ['_id', 'local.email', 'identity.firstname', 'identity.lastname', 'contact.phone', 'role'];
  let authToken;
  beforeEach(populateDB);

  describe('NOT LOGGED', () => {
    it('should return 200 if user not connected', async () => {
      const { email } = usersSeedList[0].local;
      const res = await app.inject({
        method: 'GET',
        url: `/users/exists?email=${email}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.exists).toBeTruthy();
      expect(res.result.data.user).toEqual({});
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return true and user if user exists', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/exists?email=${usersSeedList[0].local.email}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.exists).toBe(true);
      expect(res.result.data.user).toEqual({
        ...pick(usersSeedList[0], fieldsToPick),
        company: authCompany._id,
        userCompanyList: expect.arrayContaining([
          {
            company: companyWithoutSubscription._id,
            endDate: CompaniDate('2021-12-31T23:00:00.000Z').toDate(),
            startDate: CompaniDate('2021-01-01T23:00:00.000Z').toDate(),
          },
          { company: authCompany._id, startDate: CompaniDate('2022-01-01T23:00:00.000Z').toDate() },
        ]),
      });
    });

    it('should return false if user does not exists', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/exists?email=test@test.fr',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.exists).toBe(false);
      expect(res.result.data.user).toEqual({});
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 200, expectedOutput: {} },
      { name: 'auxiliary_without_company', expectedCode: 200, expectedOutput: {} },
      {
        name: 'coach',
        expectedCode: 200,
        expectedOutput: {
          ...pick(usersSeedList[0], fieldsToPick),
          company: authCompany._id,
          userCompanyList: [{ company: authCompany._id, startDate: CompaniDate('2022-01-01T23:00:00.000Z').toDate() }],
        },
      },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/users/exists?email=${usersSeedList[0].local.email}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);

        if (response.result.data) {
          expect(response.result.data.exists).toBe(true);
          expect(response.result.data.user).toEqual(role.expectedOutput);
        }
      });
    });
  });
});

describe('USERS ROUTES - GET /users/learners', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
      UtilsMock.mockCurrentDate('2022-12-20T15:00:00.000Z');
    });
    afterEach(() => {
      UtilsMock.unmockCurrentDate();
    });

    it('should return all learners', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/learners?action=directory',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const countUserInDB = userList.length + usersSeedList.length + usersFromDifferentCompanyList.length;
      expect(res.result.data.users.length).toEqual(countUserInDB);
      expect(res.result.data.users
        .every(user => ['activityHistoryCount', 'lastActivityHistory', 'blendedCoursesCount', 'eLearningCoursesCount']
          .every(key => Object.keys(user).includes(key))
        )
      )
        .toBeTruthy();
    });

    it('should return future or current learners from a specific company (potential trainees list)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${authCompany._id}&startDate=2022-12-20T15:00:00.000Z&action=course`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(18);
      expect(res.result.data.users
        .every(user => ['activityHistoryCount', 'lastActivityHistory', 'blendedCoursesCount', 'eLearningCoursesCount']
          .every(key => !Object.keys(user).includes(key))
        )
      )
        .toBeTruthy();
    });

    it('should return learners at a certain date from a specific company (attendances)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${authCompany._id}`
          + '&startDate=2021-12-19T23:00:00.000Z&endDate=2021-12-20T22:59:59.999Z&action=course',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(7);
    });

    it('should return active learners from a specific company', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${authCompany._id}&action=directory`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.every(u => UtilsHelper.areObjectIdsEquals(u.company._id, authCompany._id)))
        .toBeTruthy();
    });

    it('should return active learners from several companies', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${authCompany._id}&companies=${otherCompany._id}&action=course`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.every(u => UtilsHelper.areObjectIdsEquals(u.company._id, authCompany._id) ||
        UtilsHelper.areObjectIdsEquals(u.company._id, otherCompany._id))).toBeTruthy();
    });

    it('should return 400 if endDate but no startDate', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${authCompany._id}&endDate=2021-12-19T23:00:00.000Z&action=course`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if startDate greater than endDate', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${authCompany._id}`
        + '&startDate=2021-12-20T22:59:59.999Z&endDate=2021-12-19T23:00:00.000Z&action=course',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
      UtilsMock.mockCurrentDate('2022-12-20T15:00:00.000Z');
    });
    afterEach(() => {
      UtilsMock.unmockCurrentDate();
    });

    it('should return 200 if coach requests active learners from his company', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${authCompany._id}&action=directory`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(15);
      expect(res.result.data.users.every(u => UtilsHelper.areObjectIdsEquals(u.company._id, authCompany._id)))
        .toBeTruthy();
    });
  });

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should return 403 if client admin request learners from other company', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${otherCompany._id}&action=directory`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('HODLING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should return 200 if request learners from holding', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${otherCompany._id}&companies=${companyWithoutSubscription._id}&action=course`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.result.data.users.length).toBe(4);
    });

    it('should return 403 if request learners from other holding', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/learners?companies=${authCompany._id}&companies=${otherCompany._id}&action=course`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/users/learners?action=directory',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - GET /users/:id', () => {
  let authToken;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should return user', async () => {
      const userId = usersSeedList[0]._id;
      const res = await app.inject({
        method: 'GET',
        url: `/users/${userId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(UtilsHelper.areObjectIdsEquals(res.result.data.user._id, userId)).toBeTruthy();
    });

    it('should return 200 if user will be in company', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/${usersSeedList[13]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return a 404 if user is not from same company', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/${auxiliaryFromOtherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should return user from holding', async () => {
      const userId = userList[9]._id;
      const res = await app.inject({
        method: 'GET',
        url: `/users/${userId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(UtilsHelper.areObjectIdsEquals(res.result.data.user._id, userId)).toBeTruthy();
    });

    it('should return a 404 if user is not in holding', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/${holdingAdminFromAuthCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return trainer', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/${trainer._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(UtilsHelper.areObjectIdsEquals(res.result.data.user._id, trainer._id)).toBeTruthy();
      expect(res.result.data.user.role.vendor).toBeDefined();
    });
  });

  describe('NO_ROLE_NO_COMPANY', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
    });

    it('should return user if it is me - no role no company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/users/${noRoleNoCompany._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if it is not me - no role no company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/users/${usersSeedList[0]._id}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'GET',
          url: `/users/${usersSeedList[1]._id.toHexString()}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - PUT /users/:id', () => {
  let authToken;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should update the user', async () => {
      const userId = usersSeedList[0]._id.toHexString();
      const updatePayload = { identity: { firstname: 'Riri' }, local: { email: 'riri@alenvi.io' } };
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${userId}`,
        payload: updatePayload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);

      const userCount = await User
        .countDocuments({ _id: userId, 'identity.firstname': 'Riri', 'local.email': 'riri@alenvi.io' });
      expect(userCount).toEqual(1);
    });

    it('should update a user with vendor role', async () => {
      const roleTrainer = await Role.findOne({ name: TRAINER }).lean();
      const userId = usersSeedList[0]._id;
      const trainerPayload = {
        identity: { firstname: 'Auxiliary2', lastname: 'Kirk' },
        local: { email: usersSeedList[0].local.email },
        role: roleTrainer._id,
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${userId}`,
        payload: trainerPayload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const userCount = await User
        .countDocuments({ _id: userId, 'identity.lastname': 'Kirk', 'role.vendor': roleTrainer._id });
      expect(userCount).toEqual(1);
    });

    it('should return a 409 if the role switch is not allowed', async () => {
      const roleAuxiliary = await Role.findOne({ name: AUXILIARY }).lean();
      const userId = usersSeedList[2]._id;
      const auxiliaryPayload = {
        identity: { title: 'mr', lastname: 'Kitty', firstname: 'Admin3' },
        contact: { phone: '0600000001' },
        local: { email: usersSeedList[2].local.email },
        role: roleAuxiliary._id,
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${userId}`,
        payload: auxiliaryPayload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 404 error if user is not from the same company', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${helperFromOtherCompany._id}`,
        payload: {},
        headers: { Cookie: `alenvi_token=${authToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should not update a user if phone number is not correct', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/users/${usersSeedList[0]._id}`,
        payload: { contact: { phone: '09876' } },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should not update a user if title is not correct', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/users/${usersSeedList[0]._id}`,
        payload: { identity: { title: 'monsieur' } },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should not update a user if trying to update password', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/users/${usersSeedList[0]._id}`,
        payload: { local: { password: '123456!eR' } },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if try to update holding', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${coach._id.toHexString()}`,
        payload: { holding: authHolding._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should update user from other company in same holding', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${userList[9]._id.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { identity: { firstname: 'Test' } },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 if user is not from his holding', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${usersSeedList[0]._id.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { identity: { firstname: 'Test' } },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update trainer', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${usersSeedList[11]._id.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          identity: { firstname: 'trainerUpdate' },
          biography: 'It\'s my life',
        },
      });

      expect(res.statusCode).toBe(200);

      const updatedTrainer = await User
        .countDocuments({ _id: usersSeedList[11]._id, 'identity.firstname': 'trainerUpdate' });
      expect(updatedTrainer).toBeTruthy();
    });

    it('should update user with holding', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${usersSeedList[2]._id.toHexString()}`,
        payload: { holding: authHolding._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const userHolding = await UserHolding.countDocuments({ user: usersSeedList[2]._id, holding: authHolding._id });
      expect(userHolding).toBeTruthy();
    });

    it('should return 404 if holding does not exist', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${coach._id.toHexString()}`,
        payload: { holding: new ObjectId() },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 403 if company is not in holding', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${coachFromOtherCompany._id.toHexString()}`,
        payload: { holding: authHolding._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 409 if user is already in holding', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/users/${holdingAdminFromAuthCompany._id.toHexString()}`,
        payload: { holding: authHolding._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should update allowed field of user', async () => {
      const updatePayload = {
        identity: { firstname: 'Riri' },
        contact: { phone: '0102030405' },
        local: { email: 'norole.nocompany@userseed.fr' },
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${usersSeedList[12]._id.toHexString()}`,
        payload: updatePayload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const userUpdated = await User.countDocuments({ _id: usersSeedList[12]._id, 'identity.firstname': 'Riri' });
      expect(userUpdated).toBeTruthy();
    });

    it('should not update another field than allowed ones', async () => {
      const userId = noRoleNoCompany._id;
      const payload = {
        identity: { firstname: 'No', lastname: 'Body', socialSecurityNumber: 133333131 },
        contact: { phone: '0344543932' },
        local: { email: 'norole.nocompany@userseed.fr' },
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${userId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should not update email with new value', async () => {
      const userId = noRoleNoCompany._id;
      const payload = {
        identity: { firstname: 'No', lastname: 'Body' },
        contact: { phone: '0344543932' },
        local: { email: 'newemail@mail.com' },
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${userId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('NO_ROLE_NO_COMPANY', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(usersSeedList[12].local);
    });

    it('should update user if it is me', async () => {
      const updatePayload = { identity: { firstname: 'Riri' }, local: { email: 'riri@alenvi.io' } };

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${usersSeedList[12]._id.toHexString()}`,
        payload: updatePayload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const userUpdated = await User.countDocuments({ _id: usersSeedList[12]._id, 'identity.firstname': 'Riri' });
      expect(userUpdated).toBeTruthy();
    });

    it('should not update another field than allowed ones', async () => {
      const userId = usersSeedList[12]._id;
      const payload = {
        identity: { firstname: 'No', lastname: 'Body' },
        contact: { phone: '0344543932' },
        local: { email: usersSeedList[12].local.email },
        picture: { link: 'test' },
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${userId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'PUT',
          url: `/users/${usersSeedList[2]._id.toHexString()}`,
          payload: { identity: { firstname: 'Riri' } },
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - DELETE /users/:id', () => {
  let authToken;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    const usersToDelete = [
      { clientRole: 'coach', expectedCode: 403 },
      { clientRole: 'auxiliary', expectedCode: 403 },
      { clientRole: 'planning_referent', expectedCode: 403 },
      { clientRole: 'auxiliary_without_company', expectedCode: 403 },
      { clientRole: '', expectedCode: 403 },
    ];
    usersToDelete.forEach((test) => {
      it(`should return ${test.expectedCode} if deleting ${test.clientRole || 'user without role'}`, async () => {
        const role = rolesList.find(r => r.name === test.clientRole);
        const userToDelete = !test.clientRole
          ? usersSeedList.find(u => !u.role)
          : usersSeedList.find(u => UtilsHelper.areObjectIdsEquals(role._id, get(u, 'role.client')));

        let userCompanyExistBefore;
        let helperExistBefore;
        if (get(userToDelete, 'role.client') === helperRoleId) {
          userCompanyExistBefore = await UserCompany.countDocuments({ user: userToDelete._id });
          helperExistBefore = await Helper.countDocuments({ user: userToDelete._id });
        }

        const res = await app.inject({
          method: 'DELETE',
          url: `/users/${userToDelete._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(res.statusCode).toBe(test.expectedCode);

        if (get(userToDelete, 'role.client') === helperRoleId) {
          const userCompanyExistAfter = await UserCompany.countDocuments({ user: userToDelete._id });
          const helperExistAfter = await Helper.countDocuments({ user: userToDelete._id });

          expect(userCompanyExistBefore).toBeTruthy();
          expect(helperExistBefore).toBeTruthy();
          expect(userCompanyExistAfter).toBeFalsy();
          expect(helperExistAfter).toBeFalsy();
        }
      });
    });

    it('should return a 404 error if user is not from same company', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/users/${helperFromOtherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 403 if try to delete my own account', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${coach._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('NO_ROLE_NO_COMPANY', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(usersSeedList[12].local);
    });

    it('should delete user and its data', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${usersSeedList[12]._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);

      const companyLinkRequest = await CompanyLinkRequest.countDocuments({ user: usersSeedList[12]._id });
      expect(companyLinkRequest).toBe(0);

      const activityHistories = await ActivityHistory.countDocuments({ user: usersSeedList[12]._id });
      expect(activityHistories).toBe(0);

      const course = await Course.countDocuments({ trainees: usersSeedList[12]._id });
      expect(course).toBe(0);
    });

    it('should return 403 if try to delete other account', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${usersSeedList[0]._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HELPER', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(usersSeedList[3].local);
    });

    it('should return 403 if helper try to delete himself', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${usersSeedList[3]._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
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
          method: 'DELETE',
          url: `/users/${usersSeedList[3]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - POST /users/:id/upload', () => {
  let authToken;
  let uploadUserMediaStub;
  beforeEach(() => {
    uploadUserMediaStub = sinon.stub(GCloudStorageHelper, 'uploadUserMedia');
  });
  afterEach(() => {
    uploadUserMediaStub.restore();
  });

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add a user picture', async () => {
      const user = usersSeedList[0];
      const form = generateFormData({ fileName: 'user_image_test', file: 'yoyoyo' });
      uploadUserMediaStub.returns({ public_id: 'abcdefgh', link: 'https://alenvi.io' });

      const payload = await getStream(form);
      const response = await app.inject({
        method: 'POST',
        url: `/users/${user._id}/upload`,
        payload,
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const updatedUser = await User.countDocuments({ _id: user._id, 'picture.link': 'https://alenvi.io' });
      expect(updatedUser).toBeTruthy();
      sinon.assert.calledOnceWithExactly(uploadUserMediaStub, { fileName: 'user_image_test', file: 'yoyoyo' });
    });

    const wrongParams = ['file', 'fileName'];
    wrongParams.forEach((param) => {
      it(`should return a 400 error if missing '${param}' parameter`, async () => {
        const user = usersSeedList[0];
        const invalidForm = generateFormData(omit({ fileName: 'user_image_test', file: 'yoyoyo' }, param));
        const response = await app.inject({
          method: 'POST',
          url: `/users/${user._id}/upload`,
          payload: getStream(invalidForm),
          headers: { ...invalidForm.getHeaders(), Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    it('should upload picture if it is me', async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);

      const form = generateFormData({ fileName: 'user_image_test', file: 'yoyoyo' });
      uploadUserMediaStub.returns({ public_id: 'abcdefgh', link: 'https://alenvi.io' });

      const response = await app.inject({
        method: 'POST',
        url: `/users/${noRoleNoCompany._id.toHexString()}/upload`,
        payload: getStream(form),
        headers: { ...form.getHeaders(), 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);

      const updatedUser = await User.countDocuments({ _id: noRoleNoCompany._id, 'picture.link': 'https://alenvi.io' });
      expect(updatedUser).toBeTruthy();
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        uploadUserMediaStub.returns({ public_id: 'abcdefgh', secure_url: 'https://alenvi.io' });
        authToken = await getToken(role.name);
        const user = usersSeedList[0];
        const form = generateFormData({ fileName: 'user_image_test', file: 'yoyoyo' });

        const response = await app.inject({
          method: 'POST',
          url: `/users/${user._id}/upload`,
          payload: getStream(form),
          headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - DELETE /users/:id/upload', () => {
  let authToken;
  let deleteUserMediaStub;
  beforeEach(() => {
    deleteUserMediaStub = sinon.stub(GCloudStorageHelper, 'deleteUserMedia');
  });
  afterEach(() => {
    deleteUserMediaStub.restore();
  });

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete picture', async () => {
      const user = usersSeedList[0];
      const pictureExistsBeforeUpdate = await User
        .countDocuments({ _id: user._id, 'picture.publicId': { $exists: true } });

      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${user._id}/upload`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      sinon.assert.calledOnceWithExactly(deleteUserMediaStub, 'a/public/id');

      const isPictureDeleted = await User.countDocuments({ _id: user._id, 'picture.publicId': { $exists: false } });
      expect(pictureExistsBeforeUpdate).toBeTruthy();
      expect(isPictureDeleted).toBeTruthy();
    });

    it('should return 404 if invalid user id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${new ObjectId()}/upload`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    it('should delete picture if it is me', async () => {
      const user = usersSeedList[0];
      authToken = await getTokenByCredentials(user.local);
      const pictureExistsBeforeDeletion = await User
        .countDocuments({ _id: user._id, 'picture.publicId': { $exists: true } });
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${user._id}/upload`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);

      const isPictureDeleted = await User.countDocuments({ _id: user._id, 'picture.publicId': { $exists: false } });
      expect(pictureExistsBeforeDeletion).toBeTruthy();
      expect(isPictureDeleted).toBeTruthy();
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const user = usersSeedList[6];
        const response = await app.inject({
          method: 'DELETE',
          url: `/users/${user._id}/upload`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - POST /users/:id/expo-token', () => {
  let authToken;
  beforeEach(populateDB);

  describe('LOGGED_USER', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(usersSeedList[0].local);
    });

    it('should add a formationExpoToken to logged user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/users/${usersSeedList[0]._id.toHexString()}/expo-token`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { formationExpoToken: 'ExponentPushToken[jeSuisUnNouvelIdExpo]' },
      });

      expect(response.statusCode).toBe(200);
      const updatedToken = await User.countDocuments({
        _id: usersSeedList[0]._id,
        formationExpoTokenList: { $in: 'ExponentPushToken[jeSuisUnNouvelIdExpo]' },
      });
      expect(updatedToken).toBeTruthy();
    });

    it('should return 400 if formationExpoToken hasn\'t the right type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/users/${usersSeedList[0]._id.toHexString()}/expo-token`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { formationExpoToken: 'jeMeFaitPasserPourUnIdExpo' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if user is not loggedUser', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/users/${usersSeedList[1]._id.toHexString()}/expo-token`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { formationExpoToken: 'ExponentPushToken[jeSuisNouvelIdExpo]' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if token already exists for user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/users/${usersSeedList[0]._id.toHexString()}/expo-token`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { formationExpoToken: 'ExponentPushToken[jeSuisUnAutreIdExpo]' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'vendor_admin', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: `/users/${usersSeedList[0]._id.toHexString()}/expo-token`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { formationExpoToken: 'ExponentPushToken[jeSuisUnAutreIdExpo]' },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('USERS ROUTES - DELETE /users/:id/expo-token/:expoToken', () => {
  let authToken;
  beforeEach(populateDB);

  describe('LOGGED_USER', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(usersSeedList[0].local);
    });

    it('should remove formationExpoToken from formationExpoTokenList', async () => {
      const userId = usersSeedList[0]._id;
      const expoToken = usersSeedList[0].formationExpoTokenList[0];
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${userId}`
        + `/expo-token/${expoToken}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const tokenDeleted = await User.countDocuments({
        _id: userId,
        formationExpoTokenList: { $nin: expoToken },
      });
      expect(tokenDeleted).toBeTruthy();
    });

    it('should return 403 if user is not loggedUser', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${usersSeedList[1]._id.toHexString()}`
        + `/expo-token/${usersSeedList[0].formationExpoTokenList[0]}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'vendor_admin', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/users/${usersSeedList[0]._id.toHexString()}`
          + `/expo-token/${usersSeedList[0].formationExpoToken}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
