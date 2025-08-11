const { expect } = require('expect');
const app = require('../../server');
const { getToken } = require('./helpers/authentication');
const { populateDB } = require('./seed/vendorCompaniesSeed');
const VendorCompany = require('../../src/models/VendorCompany');
const { vendorAdmin, clientAdmin } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('VENDOR COMPANY ROUTES - GET /vendorcompanies', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get vendor company infos', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/vendorcompanies',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.vendorCompany).toMatchObject({
        name: 'Test Company',
        siret: '12345678901234',
        iban: 'FR9210096000302523177152Q14',
        bic: 'BPCEFRPP',
        ics: 'FR1234567890D',
        address: {
          fullAddress: '12 rue du test 92160 Antony',
          street: '12 rue du test',
          zipCode: '92160',
          city: 'Antony',
          location: { type: 'Point', coordinates: [2.377133, 48.801389] },
        },
        billingRepresentative: {
          _id: vendorAdmin._id,
          identity: { firstname: 'vendor_admin', lastname: 'SuperChef' },
          local: { email: 'vendor-admin@alenvi.io' },
        },
        shareCapital: 1230000,
      });
    });
  });

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get vendor company infos', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/vendorcompanies',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.vendorCompany).toMatchObject({
        name: 'Test Company',
        siret: '12345678901234',
        iban: 'FR9210096000302523177152Q14',
        bic: 'BPCEFRPP',
        address: {
          fullAddress: '12 rue du test 92160 Antony',
          street: '12 rue du test',
          zipCode: '92160',
          city: 'Antony',
          location: { type: 'Point', coordinates: [2.377133, 48.801389] },
        },
        billingRepresentative: {
          _id: vendorAdmin._id,
          identity: { firstname: 'vendor_admin', lastname: 'SuperChef' },
          local: { email: 'vendor-admin@alenvi.io' },
        },
        shareCapital: 1230000,
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/vendorcompanies',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('VENDOR COMPANY ROUTES - PUT /vendorcompanies', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    const payloads = [
      { key: 'name', value: 'Campanil' },
      {
        key: 'address',
        value: {
          fullAddress: '12 rue de ponthieu 75008 Paris',
          zipCode: '75008',
          city: 'Paris',
          street: '12 rue de Ponthieu',
          location: { type: 'Point', coordinates: [2.377133, 48.801389] },
        },
      },
      { key: 'siret', value: '12345678901235' },
      { key: 'iban', value: 'FR1517569000702248611955G54' },
      { key: 'bic', value: 'ASDTFRPP' },
      { key: 'activityDeclarationNumber', value: '10736353175' },
      { key: 'billingRepresentative', value: vendorAdmin._id },
      { key: 'shareCapital', value: 3210000 },
      { key: 'ics', value: 'FR234567ERTYU' },
    ];
    payloads.forEach((payload) => {
      it(`should update vendor company ${payload.key}`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/vendorcompanies',
          payload: { [payload.key]: payload.value },
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);

        const vendorCompany = await VendorCompany.findOne().lean();
        expect(vendorCompany[payload.key]).toEqual(payload.value);
      });
    });

    const wrongValues = [
      { key: 'name', value: '' },
      {
        key: 'address',
        value: {
          fullAddress: '',
          zipCode: '75008',
          city: 'Paris',
          street: '12 rue de Ponthieu',
          location: { type: 'Point', coordinates: [2.377133, 48.801389] },
        },
      },
      {
        key: 'address',
        value: '12 rue de ponthieu 75008 Paris',
      },
      { key: 'siret', value: '13244' },
      { key: 'iban', value: 'GD0314508000306574351512P33' },
      { key: 'bic', value: 'TJDKLK' },
      { key: 'ics', value: 'WEDDD' },
      { key: 'activityDeclarationNumber', value: '' },
      { key: 'shareCapital', value: '' },
      { key: 'shareCapital', value: '123000€' },
      { key: 'shareCapital', value: -200 },
      { key: 'shareCapital', value: 0 },
    ];
    wrongValues.forEach((payload) => {
      it(`should not update vendor company ${payload.key} with wrong value`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/vendorcompanies',
          payload: { [payload.key]: payload.value },
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return 403 if invalid billingRepresentative', async () => {
      const payload = {
        name: 'Test',
        billingRepresentative: clientAdmin._id,
      };
      const response = await app.inject({
        method: 'PUT',
        url: '/vendorcompanies',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
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
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: '/vendorcompanies',
          payload: { name: 'Campanil' },
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
