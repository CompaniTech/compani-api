const expect = require('expect');
const { ObjectID } = require('mongodb');
const {
  populateDB,
  auxiliaries,
  auxiliaryFromOtherCompany,
  sectors,
  sectorFromOtherCompany,
} = require('./seed/paySeed');
const app = require('../../server');
const Pay = require('../../src/models/Pay');
const { getToken } = require('./seed/authenticationSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('PAY ROUTES - GET /pay/draft', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should compute draft pay', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/draft?startDate=2022-04-30T22:00:00.000Z&endDate=2022-05-31T21:59:59.999Z',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.draftPay.length).toEqual(2);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/pay/draft?startDate=2022-04-30T22:00:00.000Z&endDate=2022-05-31T21:59:59.999Z',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PAY ROUTES - POST /pay', () => {
  let authToken = null;
  beforeEach(populateDB);
  const payload = [{
    auxiliary: auxiliaries[0]._id,
    startDate: '2022-04-30T22:00:00',
    endDate: '2022-05-28T14:34:04',
    month: '05-2022',
    contractHours: 38.97,
    workedHours: 2,
    surchargedAndNotExemptDetails: {},
    surchargedAndExemptDetails: {},
    notSurchargedAndNotExempt: 2,
    surchargedAndNotExempt: 0,
    notSurchargedAndExempt: 0,
    surchargedAndExempt: 0,
    hoursBalance: -36.97,
    hoursCounter: -36.97,
    overtimeHours: 0,
    additionalHours: 0,
    mutual: true,
    transport: 0,
    phoneFees: 0,
    bonus: 0,
    hoursToWork: 10,
    previousMonthHoursCounter: -2,
    paidTransportHours: 3,
    internalHours: 9,
    absencesHours: 5,
    holidaysHours: 7,
    diff: {
      hoursBalance: 20,
      notSurchargedAndExempt: 20,
      notSurchargedAndNotExempt: 20,
      surchargedAndExempt: 20,
      surchargedAndExemptDetails: {},
      surchargedAndNotExempt: 20,
      surchargedAndNotExemptDetails: { [new ObjectID()]: { planName: 'Toto', custom: { hours: 20, percentage: 10 } } },
      paidTransportHours: 3,
      internalHours: 9,
      absencesHours: 5,
      workedHours: 20,
    },
  }];

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should create a new pay', async () => {
      const payListBefore = await Pay.countDocuments({});

      const response = await app.inject({
        method: 'POST',
        url: '/pay',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const payListCount = await Pay.countDocuments({});
      expect(payListCount).toEqual(payListBefore + 1);
    });

    it('should return 404 if user is not from the same company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/pay',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: [{ ...payload[0], auxiliary: new ObjectID(auxiliaryFromOtherCompany._id) }],
      });

      expect(response.statusCode).toBe(404);
    });

    Object.keys(payload[0]).forEach((key) => {
      it(`should return a 400 error if missing '${key}' parameter`, async () => {
        const invalidPayload = { ...payload };
        delete invalidPayload[key];

        const res = await app.inject({
          method: 'POST',
          url: '/pay',
          payload: invalidPayload,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });
        expect(res.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403, erp: true },
      { name: 'planning_referent', expectedCode: 403, erp: true },
      { name: 'coach', expectedCode: 403, erp: true },
      { name: 'client_admin', expectedCode: 403, erp: false },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}${role.erp ? '' : ' without erp'}`, async () => {
        authToken = await getToken(role.name, role.erp);
        const response = await app.inject({
          method: 'POST',
          url: '/pay',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PAY ROUTES - GET /hours-balance-details', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get hours balance details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?auxiliary=${auxiliaries[0]._id}&month=10-2022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursBalanceDetail.auxiliaryId).toEqual(auxiliaries[0]._id);
    });

    it('should get hours balance details for a sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[0]._id}&month=10-2022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursBalanceDetail.length).toEqual(1);
    });

    it('should get hours balance details for many sectors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[0]._id}&sector=${sectors[1]._id}&month=10-2022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursBalanceDetail.length).toEqual(2);
    });

    it('should return a 404 if user is not from the same company as auxiliary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?auxiliary=${auxiliaryFromOtherCompany._id}&month=10-2022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 if user is not from the same company as sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[2]._id}&month=10-2022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a if there is both sector and auxiliary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[0]._id}&auxiliary=${auxiliaries[0]._id}&month=10-2022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if missing both sector and auxiliary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/hours-balance-details?&month=10-2022',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toEqual(400);
    });

    it('should return a 400 if month does not correspond to regex', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[0]._id}&month=102022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toEqual(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 200 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/pay/hours-balance-details?auxiliary=${auxiliaries[0]._id}&month=10-2022`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PAY ROUTES - GET /hours-to-work', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get hours to work by sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-to-work?sector=${sectors[0]._id}&month=12-2021`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursToWork).toBeDefined();
    });

    it('should get relevant hours to work by sector if an auxiliary has changed sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-to-work?sector=${sectors[0]._id}&sector=${sectors[1]._id}&month=12-2022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursToWork).toBeDefined();
      const oldSectorResult = response.result.data.hoursToWork
        .find(res => res.sector.toHexString() === sectors[0]._id.toHexString());
      const newSectorResult = response.result.data.hoursToWork
        .find(res => res.sector.toHexString() === sectors[1]._id.toHexString());

      expect(oldSectorResult.hoursToWork).toEqual(13);
      expect(newSectorResult.hoursToWork).toEqual(26);
    });

    it('should return a 404 if user is not from the same company as sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-to-work?sector=${sectorFromOtherCompany._id}&month=12-2021`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 400 if missing sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/hours-to-work?&month=10-2022',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toEqual(400);
    });

    it('should return a 400 if month does not correspond to regex', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-to-work?sector=${sectors[0]._id}&month=102022`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toEqual(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 200 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/pay/hours-to-work?sector=${sectors[0]._id}&month=12-2021`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PAY ROUTES - GET /pays/export/{type}', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should export identification for pay', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/identification?startDate=2022-11-01T00:00:00&endDate=2022-11-30T23:00:00',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should export contract versions for pay', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/contract_version?startDate=2022-10-01T00:00:00&endDate=2022-10-31T23:59:59',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should export absences for pay', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/absence?startDate=2022-11-01T00:00:00&endDate=2022-11-30T23:00:00',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should export contract ends for pay', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/contract_end?startDate=2022-11-01T00:00:00&endDate=2022-11-30T23:59:59',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should export hours for pay', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/pay?startDate=2022-11-01T00:00:00&endDate=2022-11-30T23:59:59',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 if invalid type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/toto?startDate=2022-11-01T00:00:00&endDate=2022-11-30T23:00:00',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if missing endDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/identification?startDate=2022-11-01T00:00:00',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if missing startDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/identification?endDate=2022-11-30T23:00:00',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if startDate is after endDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/export/identification?startDate=2022-12-01T00:00:00&endDate=2022-11-30T23:00:00',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/pay/export/identification?endDate=2020-11-30T23:00:00',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
