const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const GDriveStorageHelper = require('../../src/helpers/gDriveStorage');
const Company = require('../../src/models/Company');
const CompanyHolding = require('../../src/models/CompanyHolding');
const app = require('../../server');
const { companies, populateDB, usersList } = require('./seed/companiesSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const {
  authCompany,
  otherCompany,
  otherHolding,
  authHolding,
  companyWithoutSubscription,
} = require('../seed/authCompaniesSeed');
const {
  noRoleNoCompany,
  coach,
  holdingAdminFromOtherCompany,
  vendorAdmin,
  userList: authUsersList,
} = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COMPANIES ROUTES - PUT /companies/:id', () => {
  let authToken;
  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update company', async () => {
      const payload = {
        name: 'Alenvi Alenvi',
        iban: 'FR3514508000505917721779B12',
        bic: 'RTYUIKJHBFRG',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.company).toMatchObject(payload);
    });

    it('should update billingRepresentative with holding admin from another company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companyWithoutSubscription._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { billingRepresentative: holdingAdminFromOtherCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update name even if only case or diacritics have changed', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: 'Tèst' },
      });

      expect(response.statusCode).toBe(200);
      const updatedCompany = await Company.countDocuments({ _id: companies[0]._id, name: 'Tèst' });
      expect(updatedCompany).toBe(1);
    });

    it('should update salesRepresentative', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { salesRepresentative: vendorAdmin._id },
      });

      expect(response.statusCode).toBe(200);
      const updatedCompany = await Company
        .countDocuments({ _id: companies[0]._id, salesRepresentative: vendorAdmin._id });
      expect(updatedCompany).toBe(1);
    });

    it('should return 409 if other company has exact same name', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: authCompany.name },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if other company has same name (case and diacritics insensitive)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: 'tEST sas' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if company is not found', async () => {
      const payload = { name: 'Alenvi Alenvi' };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if billingRepresentative is from other company', async () => {
      const payload = { name: 'Alenvi Alenvi', billingRepresentative: usersList[1]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if billingRepresentative is from other company and other holding', async () => {
      const payload = { name: 'Alenvi Alenvi', billingRepresentative: usersList[1]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if billingRepresentative is not client_admin or holding_admin', async () => {
      const payload = { name: 'Alenvi Alenvi', billingRepresentative: coach._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if salesRepresentative has wrong role', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { salesRepresentative: usersList[1]._id },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('CLIENT_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(usersList[0].local);
    });

    it('should update company', async () => {
      const payload = { name: 'Alenvi Alenvi' };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.company).toMatchObject(payload);
    });

    it('should return 403 if not its company', async () => {
      const payload = { name: 'Alenvi Alenvi' };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if billingRepresentative is from other company', async () => {
      const payload = { name: 'Alenvi Alenvi', billingRepresentative: usersList[1]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if billingRepresentative is not client_admin or holding_admin', async () => {
      const payload = { name: 'Alenvi Alenvi', billingRepresentative: coach._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    const falsyAssertions = [
      { payload: { address: { street: '38 rue de ponthieu' } }, case: 'wrong address' },
    ];
    falsyAssertions.forEach((assertion) => {
      it(`should return a 400 error if ${assertion.case}`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/companies/${companies[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: assertion.payload,
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('CLIENT_ADMIN from third company', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(authUsersList[9].local);
    });

    it('should update billingRepresentative with holding admin from another company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companyWithoutSubscription._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { billingRepresentative: holdingAdminFromOtherCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should update company from holding', async () => {
      const payload = { name: 'Nouveau nom' };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companies[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.company).toMatchObject(payload);
    });

    it('should return 403 if company not in holding', async () => {
      const payload = { name: 'Alenvi Alenvi' };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if billingRepresentative is from other company not in holding', async () => {
      const payload = { name: 'Alenvi Alenvi', billingRepresentative: usersList[0]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/companies/${companyWithoutSubscription._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const payload = { name: 'SuperTest' };
        const response = await app.inject({
          method: 'PUT',
          url: `/companies/${companies[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COMPANIES ROUTES - POST /companies', () => {
  let authToken;
  let createFolderForCompany;
  let createFolder;
  beforeEach(async () => {
    createFolderForCompany = sinon.stub(GDriveStorageHelper, 'createFolderForCompany');
    createFolder = sinon.stub(GDriveStorageHelper, 'createFolder');
  });
  afterEach(() => {
    createFolderForCompany.restore();
    createFolder.restore();
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    const payload = { name: 'Test SARL', salesRepresentative: vendorAdmin._id };

    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a new company (without holding)', async () => {
      const companiesBefore = await Company.find().lean();
      createFolderForCompany.returns({ id: '1234567890' });
      createFolder.onCall(0).returns({ id: '0987654321' });
      createFolder.onCall(1).returns({ id: 'qwerty' });
      createFolder.onCall(2).returns({ id: 'asdfgh' });

      const response = await app.inject({
        method: 'POST',
        url: '/companies',
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const companiesCount = await Company.countDocuments();
      expect(companiesCount).toEqual(companiesBefore.length + 1);
    });

    it('should create a new company (with holding)', async () => {
      const companiesBefore = await Company.find().lean();
      const auhtHoldingCompaniesBefore = await CompanyHolding.countDocuments({ holding: authHolding._id });
      createFolderForCompany.returns({ id: '1234567890' });
      createFolder.onCall(0).returns({ id: '0987654321' });
      createFolder.onCall(1).returns({ id: 'qwerty' });
      createFolder.onCall(2).returns({ id: 'asdfgh' });

      const response = await app.inject({
        method: 'POST',
        url: '/companies',
        payload: { ...payload, holding: authHolding._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const companiesCount = await Company.countDocuments();
      expect(companiesCount).toEqual(companiesBefore.length + 1);
      const authHoldingCompaniesCount = await CompanyHolding.countDocuments({ holding: authHolding._id });
      expect(authHoldingCompaniesCount).toEqual(auhtHoldingCompaniesBefore + 1);
    });

    it('should return 409 if other company has exact same name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/companies',
        payload: { name: 'Test' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if other company has same name (case and diacritics insensitive)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/companies',
        payload: { name: 'TèsT' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 400 error if missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/companies',
        payload: {},
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if salesRepresentative has wrong role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/companies',
        payload: { name: 'Test other company', salesRepresentative: usersList[1]._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if holding doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/companies',
        payload: { ...payload, holding: new ObjectId() },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const payload = { name: 'Test SARL' };

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
          url: '/companies',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COMPANIES ROUTES - GET /companies', () => {
  let authToken;
  describe('LOGGED USER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
    });

    it('should list all companies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/companies',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.companies.length).toEqual(5);
    });

    it('should list companies not in holdings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/companies?withoutHoldingCompanies=true',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.companies.length).toEqual(1);
    });
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should list company in holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies?holding=${otherHolding._id.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.companies.length).toEqual(3);
    });

    it('should return 404 if holding doesn\'t exists', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies?holding=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if holding and withoutHoldingCompanies in query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies?holding=${otherHolding._id.toHexString()}&withoutHoldingCompanies=true`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should list company in own holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies?holding=${otherHolding._id.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if other holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies?holding=${authHolding._id.toHexString()}`,
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
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name} and holding query`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/companies?holding=${otherHolding._id.toHexString()}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COMPANIES ROUTES - GET /companies/:id', () => {
  let authToken;
  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);

    it('should return company', async () => {
      authToken = await getToken('training_organisation_manager');
      const response = await app.inject({
        method: 'GET',
        url: `/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.company._id).toEqual(authCompany._id);
    });

    it('should return 404 if company doesnt exist', async () => {
      authToken = await getToken('training_organisation_manager');
      const response = await app.inject({
        method: 'GET',
        url: `/companies/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('CLIENT_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should return company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if other company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies/${otherCompany._id}`,
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

    it('should return company from holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies/${companyWithoutSubscription._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if company not in holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/companies/${authCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
