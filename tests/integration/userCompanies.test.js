const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const { getTokenByCredentials, getToken } = require('./helpers/authentication');
const UserCompany = require('../../src/models/UserCompany');
const { userCompanies, populateDB, usersSeedList } = require('./seed/userCompaniesSeed');
const UtilsMock = require('../utilsMock');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../seed/authCompaniesSeed');
const { holdingAdminFromOtherCompany } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('USER COMPANIES ROUTES - POST /usercompanies', () => {
  let authToken;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should create user company', async () => {
      const payload = { user: usersSeedList[10]._id, company: authCompany._id };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 if company is not client user company', async () => {
      const payload = { user: usersSeedList[10]._id, company: otherCompany._id };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should create user company', async () => {
      const payload = { user: usersSeedList[10]._id, company: companyWithoutSubscription._id };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 if company is not in user holding', async () => {
      const payload = { user: usersSeedList[10]._id, company: authCompany._id };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create user company', async () => {
      const payload = { user: usersSeedList[10]._id, company: authCompany._id };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 if user does not exist', async () => {
      const payload = { user: new ObjectId(), company: authCompany._id };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 if user already have a company', async () => {
      const payload = { user: usersSeedList[0]._id, company: authCompany._id };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(409);
      expect(res.result.message).toBe('Ce compte est déjà rattaché à une structure.');
    });

    it('should return good message if start date is before previous user company end date', async () => {
      const payload = { user: usersSeedList[7]._id, company: authCompany._id, startDate: '2021-10-19T23:00:00.000Z' };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(409);
      expect(res.result.message).toBe('Ce compte est déjà rattaché à une structure jusqu\'au 20/11/2021.');
    });

    it('should return 404 if company is does not exist', async () => {
      const payload = { user: usersSeedList[10]._id, company: new ObjectId() };

      const res = await app.inject({
        method: 'POST',
        url: '/usercompanies',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403, erp: true, message: 'Insufficient scope' },
      { name: 'planning_referent', expectedCode: 403, erp: true, message: 'Insufficient scope' },
      { name: 'trainer', expectedCode: 200, erp: false, message: 'Utilisateur rattaché à une structure.' },
    ];

    const payload = { user: usersSeedList[10]._id, company: authCompany._id };

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}${role.erp ? '' : ' without erp'}`, async () => {
        authToken = await getToken(role.name, role.erp);

        const res = await app.inject({
          method: 'POST',
          url: '/usercompanies',
          payload,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });
        expect(res.statusCode).toBe(role.expectedCode);
        expect(res.result.message).toBe(role.message);
      });
    });
  });
});

describe('USER COMPANIES ROUTES - PUT /usercompanies/{id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(usersSeedList[1].local);
    });

    it('should detach user company', async () => {
      const userCompanyId = userCompanies[1]._id.toHexString();
      const payload = { endDate: '2022-12-01T22:59:59.999Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(200);

      const userCount = await UserCompany.countDocuments({ _id: userCompanyId, endDate: '2022-12-01T22:59:59.999Z' });
      expect(userCount).toEqual(1);
    });

    it('should return a 400 if endDate is not defined in payload', async () => {
      const userCompanyId = userCompanies[1]._id.toHexString();
      const payload = { endDate: '' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return a 403 if user company doesnt exist', async () => {
      const userCompanyId = new ObjectId();
      const payload = { endDate: '2022-12-25T22:59:59.999Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.result.message)
        .toBe('Impossible de mettre à jour les informations liées à la structure de cet(te) apprenant(e).');
    });

    it('should return a 403 if user company startDate is in futur', async () => {
      UtilsMock.mockCurrentDate('2022-12-27T15:00:00.000Z');

      const userCompanyId = userCompanies[6]._id.toHexString();
      const payload = { endDate: '2022-08-17T10:00:00.000Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.result.message)
        .toBe('Impossible de mettre à jour les informations liées à la structure de cet(te) apprenant(e).');
      UtilsMock.unmockCurrentDate();
    });

    it('should return 403 if company is not allowed to detach its learners', async () => {
      const userCompanyId = userCompanies[3]._id.toHexString();
      const payload = { endDate: '2022-12-25T22:59:59.999Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.result.message)
        .toBe('Impossible de mettre à jour les informations liées à la structure de cet(te) apprenant(e).');
    });

    it('should return 403 if user is already detached', async () => {
      const userCompanyId = userCompanies[8]._id.toHexString();
      const payload = { endDate: '2022-12-25T22:59:59.999Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.result.message)
        .toBe('Impossible de mettre à jour les informations liées à la structure de cet(te) apprenant(e).');
    });

    it('should return a 403 if user has a role', async () => {
      const userCompanyId = userCompanies[7]._id;
      const payload = { endDate: '2022-12-25T22:59:59.999Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return a 403 if detachment date is before user company startdate', async () => {
      const userCompanyId = userCompanies[1]._id.toHexString();
      const payload = { endDate: '2022-08-01T10:00:00.000Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.result.message)
        .toBe('La date de détachement de l\'utilisateur ne peut être antérieure à son rattachement.');
    });

    it('should return a 403 if detachment date is before first trainee\'s addition in course history', async () => {
      const userCompanyId = userCompanies[9]._id.toHexString();
      const payload = { endDate: '2022-09-05T10:00:00.000Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.result.message).toBe('Vous ne pouvez pas détacher cette personne avant le 10/09/2022.');
    });
  });

  describe('COACH FROM OTHER COMPANY', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should return a 403 if user is from an other company', async () => {
      const userCompanyId = userCompanies[1]._id.toHexString();
      const payload = { endDate: '2022-12-01T22:59:59.999Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.result.message).toBe('Error: user is not from right company.');
    });
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should detach user company', async () => {
      const userCompanyId = userCompanies[5]._id.toHexString();
      const payload = { endDate: '2022-12-01T22:59:59.999Z' };

      const res = await app.inject({
        method: 'PUT',
        url: `/usercompanies/${userCompanyId}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(res.statusCode).toBe(200);

      const userCount = await UserCompany.countDocuments({ _id: userCompanyId, endDate: '2022-12-01T22:59:59.999Z' });
      expect(userCount).toEqual(1);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403, erp: true, message: 'Insufficient scope' },
      { name: 'planning_referent', expectedCode: 403, erp: true, message: 'Insufficient scope' },
      { name: 'trainer', expectedCode: 403, erp: false, message: 'Error: user\'s role does\'nt allow this action.' },
    ];

    const userCompanyId = userCompanies[1]._id.toHexString();
    const payload = { endDate: '2022-12-01T22:59:59.999Z' };

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}${role.erp ? '' : ' without erp'}`, async () => {
        authToken = await getToken(role.name, role.erp);

        const res = await app.inject({
          method: 'PUT',
          url: `/usercompanies/${userCompanyId}`,
          payload,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });
        expect(res.statusCode).toBe(role.expectedCode);
        expect(res.result.message).toBe(role.message);
      });
    });
  });
});
