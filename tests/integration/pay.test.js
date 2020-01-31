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
const { getToken, authCompany } = require('./seed/authenticationSeed');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('PAY ROUTES - GET /pay/draft', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('Admin', () => {
    beforeEach(async () => {
      authToken = await getToken('admin');
    });
    it('should compute draft pay', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pay/draft?startDate=2019-04-30T22:00:00.000Z&endDate=2019-05-31T21:59:59.999Z',
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.draftPay).toBeDefined();
      expect(response.result.data.draftPay.length).toEqual(2);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/pay/draft?startDate=2019-04-30T22:00:00.000Z&endDate=2019-05-31T21:59:59.999Z',
          headers: { 'x-access-token': authToken },
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
    startDate: '2019-04-30T22:00:00',
    endDate: '2019-05-28T14:34:04',
    month: '05-2019',
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
    otherFees: 0,
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
      surchargedAndNotExemptDetails: {
        [new ObjectID()]: {
          planName: 'Toto',
          custom: { hours: 20, percentage: 10 },
        },
      },
      paidTransportHours: 3,
      internalHours: 9,
      absencesHours: 5,
      workedHours: 20,
    },
  }];

  describe('Admin', () => {
    beforeEach(async () => {
      authToken = await getToken('admin');
    });

    it('should create a new pay', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/pay',
        headers: { 'x-access-token': authToken },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const payList = await Pay.find({ company: authCompany._id }).lean();
      expect(payList.length).toEqual(1);
    });

    it('should not create a new pay if user is not from the same company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/pay',
        headers: { 'x-access-token': authToken },
        payload: [{ ...payload[0], auxiliary: new ObjectID(auxiliaryFromOtherCompany._id) }],
      });

      expect(response.statusCode).toBe(403);
    });

    Object.keys(payload[0]).forEach((key) => {
      it(`should return a 400 error if missing '${key}' parameter`, async () => {
        const invalidPayload = { ...payload };
        delete invalidPayload[key];

        const res = await app.inject({
          method: 'POST',
          url: '/pay',
          payload: invalidPayload,
          headers: { 'x-access-token': authToken },
        });
        expect(res.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/pay',
          headers: { 'x-access-token': authToken },
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

  describe('Admin', () => {
    beforeEach(async () => {
      authToken = await getToken('admin');
    });

    it('should get hours balance details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?auxiliary=${auxiliaries[0]._id}&month=10-2019`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursBalanceDetail).toBeDefined();
    });

    it('should get hours balance details for a sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[0]._id}&month=10-2019`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursBalanceDetail).toBeDefined();
    });

    it('should get hours balance details for many sectors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[0]._id}&sector=${sectors[1]._id}&month=10-2019`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursBalanceDetail.length).toEqual(2);
    });

    it('should not get hours balance details if user is not from the same company as auxiliary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?auxiliary=${auxiliaryFromOtherCompany._id}&month=10-2019`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should not get hours balance details if user is not from the same company as sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[2]._id}&month=10-2019`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should not get hours balance details if there is both sector and auxiliary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-balance-details?sector=${sectors[0]._id}&auxiliary=${auxiliaries[0]._id}&month=10-2019`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 200 },
      { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/pay/hours-balance-details?auxiliary=${auxiliaries[0]._id}&month=10-2019`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PAY ROUTES - GET /hours-to-work', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('Admin', () => {
    beforeEach(async () => {
      authToken = await getToken('admin');
    });

    it('should get hours to work by sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-to-work?sector=${sectors[0]._id}&month=12-2018`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursToWork).toBeDefined();
    });

    it('should get relevant hours to work by sector if an auxiliary has changed sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-to-work?sector=${sectors[0]._id}&sector=${sectors[1]._id}&month=12-2019`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.hoursToWork).toBeDefined();
      const oldSectorResult = response.result.data.hoursToWork.find(res =>
        res.sector.toHexString() === sectors[0]._id.toHexString());
      const newSectorResult = response.result.data.hoursToWork.find(res =>
        res.sector.toHexString() === sectors[1]._id.toHexString());

      expect(oldSectorResult.hoursToWork).toEqual(13.5);
      expect(newSectorResult.hoursToWork).toEqual(24);
    });

    it('should not get hours to work if user is not from the same company as sector', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/pay/hours-to-work?sector=${sectorFromOtherCompany._id}&month=12-2018`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
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
          url: `/pay/hours-to-work?sector=${sectors[0]._id}&month=12-2018`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
