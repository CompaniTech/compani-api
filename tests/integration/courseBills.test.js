const pick = require('lodash/pick');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const set = require('lodash/set');
const omit = require('lodash/omit');
const CourseBill = require('../../src/models/CourseBill');
const app = require('../../server');
const {
  populateDB,
  courseBillsList,
  coursesList,
  courseFundingOrganisationList,
  billingItemList,
} = require('./seed/courseBillsSeed');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../seed/authCompaniesSeed');

const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { CompaniDate } = require('../../src/helpers/dates/companiDates');
const { GROUP, TRAINEE } = require('../../src/helpers/constants');
const { holdingAdminFromOtherCompany } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COURSE BILL ROUTES - GET /coursebills', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get course bill for intra course (with company as payer)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?course=${coursesList[0]._id}&action=list`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBills.length).toEqual(2);
      expect(response.result.data.courseBills).toEqual(expect.arrayContaining([
        expect.objectContaining({
          course: coursesList[0]._id,
          companies: [pick(authCompany, ['_id', 'name'])],
          payer: pick(authCompany, ['_id', 'name']),
          mainFee: { price: 120, count: 1, countUnit: GROUP },
          billingPurchaseList: expect.arrayContaining([
            expect.objectContaining({ billingItem: billingItemList[0]._id, price: 90, count: 1 }),
            expect.objectContaining({ billingItem: billingItemList[1]._id, price: 400, count: 1 }),
          ]),
          netInclTaxes: 610,
        }),
        expect.objectContaining({
          course: coursesList[0]._id,
          companies: [pick(authCompany, ['_id', 'name'])],
          payer: pick(authCompany, ['_id', 'name']),
          mainFee: { price: 200, count: 2, description: 'yoyo', countUnit: GROUP },
          billingPurchaseList: [expect.objectContaining({ billingItem: billingItemList[0]._id, price: 9, count: 1 })],
          netInclTaxes: 409,
          billedAt: new Date('2022-04-07T00:00:00.000Z'),
          number: 'FACT-00006',
        }),
      ]));
    });

    it('should get course bill for intra course (with funding organisation as payer)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?course=${coursesList[1]._id}&action=list`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBills.length).toEqual(2);
      expect(response.result.data.courseBills).toEqual(expect.arrayContaining([
        expect.objectContaining({
          course: coursesList[1]._id,
          companies: [pick(authCompany, ['_id', 'name'])],
          mainFee: { price: 120, count: 1, description: 'Lorem ipsum', countUnit: GROUP },
          netInclTaxes: 120,
          payer: pick(courseFundingOrganisationList[0], ['_id', 'name']),
        }),
        expect.objectContaining({
          course: coursesList[1]._id,
          companies: [pick(authCompany, ['_id', 'name'])],
          mainFee: { price: 200, count: 2, description: 'yoyo', countUnit: GROUP },
          netInclTaxes: 409,
          billingPurchaseList: [expect.objectContaining({ billingItem: billingItemList[0]._id, price: 9, count: 1 })],
          payer: pick(authCompany, ['_id', 'name']),
        }),
      ]));
    });

    it('should get company bills', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?company=${authCompany._id}&action=balance`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBills.length).toEqual(5);
    });

    it('should get draft bills between 2 dates', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/coursebills?startDate=2025-01-10T22:00:00.000Z&endDate=2025-04-30T23:00:00.000Z&action=dashboard',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBills.length).toEqual(1);
      const everyBillIsBetweenDates = response.result.data.courseBills
        .every(bill => CompaniDate(bill.maturityDate).isSameOrBefore('2025-04-30T23:00:00') &&
          CompaniDate(bill.maturityDate).isSameOrAfter('2025-01-10T22:00:00'));
      expect(everyBillIsBetweenDates).toBeTruthy();
    });

    it('should get validated bills between 2 dates', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/coursebills?startDate=2022-04-06T22:00:00.000Z&endDate=2022-04-08T22:00:00.000Z&action=dashboard'
          + '&isValidated=true',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBills.length).toEqual(7);
      const everyBillIsBetweenDates = response.result.data.courseBills
        .every(bill => CompaniDate(bill.billedAt).isSameOrBefore('2022-04-08T22:00:00') &&
          CompaniDate(bill.billedAt).isSameOrAfter('2022-04-06T22:00:00'));
      expect(everyBillIsBetweenDates).toBeTruthy();
    });

    it('should get every validated bills', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/coursebills?action=dashboard&isValidated=true',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBills.length).toEqual(8);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?course=${new ObjectId()}&action=list`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if company doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?company=${new ObjectId()}&action=balance`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if query is company but wrong action', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?company=${authCompany._id}&action=list`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if query is course but wrong action', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?course=${coursesList[1]._id}&action=balance`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if query is dashboard but no start date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/coursebills?endDate=2022-04-08T22:00:00.000Z&action=dashboard&isValidated=true',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if query is dashboard but no end date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/coursebills?startDate=2022-04-06T22:00:00.000Z&action=dashboard&isValidated=true',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if end date is before start date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/coursebills?startDate=2023-04-06T22:00:00.000Z&endDate=2022-04-08T22:00:00.000Z&action=dashboard'
          + '&isValidated=true',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should get company bills', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?company=${authCompany._id}&action=balance`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBills.length).toEqual(5);
    });

    it('should return 403 if wrong company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?company=${otherCompany._id}&action=balance`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if wrong action in query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?course=${coursesList[0]._id}&action=list`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should get bills from another company but in holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?company=${companyWithoutSubscription._id}&action=balance`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courseBills.length).toEqual(2);
    });

    it('should return 403 if company not in holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills?company=${authCompany._id}&action=balance`,
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
          url: `/coursebills?course=${coursesList[0]._id}&action=list`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILL ROUTES - GET /coursebills/{_id}/pdfs', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should download course bill for intra course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${courseBillsList[2]._id}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${new ObjectId()}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if bill is not validated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${courseBillsList[0]._id}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should download own course bill for intra course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${courseBillsList[2]._id}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should download course bill for intra course (as payer)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${courseBillsList[6]._id}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if bill has wrong company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${courseBillsList[7]._id}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should download holding course bill for intra course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${courseBillsList[10]._id}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should download course bill for intra course (as payer)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${courseBillsList[11]._id}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if bill has wrong company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursebills/${courseBillsList[8]._id}/pdfs`,
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        const response = await app.inject({
          method: 'GET',
          url: `/coursebills/${coursesList[2]._id}/pdfs`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILL ROUTES - POST /coursebills/list-creation', () => {
  let authToken;
  beforeEach(populateDB);

  const payload = {
    quantity: 2,
    course: coursesList[0]._id,
    companies: [authCompany._id],
    mainFee: { count: 1, countUnit: GROUP, description: 'test' },
    payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
  };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create several bills with fundingOrganisation as payer (intra)', async () => {
      const billsCountBefore = await CourseBill.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const billsCountAfter = await CourseBill.countDocuments();
      expect(billsCountAfter).toBe(billsCountBefore + 2);
    });

    it('should create a bill with fundingOrganisation as payer (intra)', async () => {
      const billsCountBefore = await CourseBill.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          ...payload,
          quantity: 1,
          maturityDate: '2025-04-29T22:00:00.000+00:00',
          mainFee: { ...payload.mainFee, price: 120 },
        },
      });
      expect(response.statusCode).toBe(200);

      const billsCountAfter = await CourseBill.countDocuments();
      expect(billsCountAfter).toBe(billsCountBefore + 1);
    });

    it('should create several bills with company as payer (intra)', async () => {
      const billsCountBefore = await CourseBill.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, payer: { company: authCompany._id } },
      });

      expect(response.statusCode).toBe(200);

      const billsCountAfter = await CourseBill.countDocuments();
      expect(billsCountAfter).toBe(billsCountBefore + 2);
    });

    it('should create several bills (inter b2b)', async () => {
      const billsCountBefore = await CourseBill.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: coursesList[13]._id },
      });

      expect(response.statusCode).toBe(200);

      const billsCountAfter = await CourseBill.countDocuments();
      expect(billsCountAfter).toBe(billsCountBefore + 2);
    });

    it('should create a bill (inter b2b)', async () => {
      const billsCountBefore = await CourseBill.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          ...payload,
          course: coursesList[13]._id,
          quantity: 1,
          maturityDate: '2025-04-29T22:00:00.000+00:00',
          mainFee: { ...payload.mainFee, price: 120, percentage: 40 },
        },
      });

      expect(response.statusCode).toBe(200);

      const billsCountAfter = await CourseBill.countDocuments();
      expect(billsCountAfter).toBe(billsCountBefore + 1);
    });

    const missingParams = [
      'course',
      'companies',
      'mainFee',
      'mainFee.price',
      'mainFee.count',
      'mainFee.percentage',
      'payer',
      'mainFee.countUnit',
      'maturityDate',
    ];
    missingParams.forEach((param) => {
      it(`should return 400 as ${param} is missing in payload`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/coursebills/list-creation',
          payload: { ...omit(payload, param), ...omit(coursesList[0]._id, 'companies') },
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return 400 if course price exist and percentage is not defined (intra)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { course: coursesList[15]._id, ...omit(payload.mainFee, 'percentage') },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if countUnit is trainee (intra)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, mainFee: { ...payload.mainFee, countUnit: TRAINEE } },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if count is greater than 1 (intra)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, mainFee: { ...payload.mainFee, count: 2 } },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if one bill exist, course price is not defined and not bill price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, quantity: 1 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if any bill exist, course price is defined and not bill percentage', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: coursesList[15]._id, expectedBillsCount: 0, quantity: 1 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if bill percentage and course price is not defined', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          ...payload,
          quantity: 1,
          maturityDate: '2025-04-29T22:00:00.000+00:00',
          mainFee: { ...payload.mainFee, percentage: 40 },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    const wrongValues = [
      { key: 'price', value: -200 },
      { key: 'price', value: 0 },
      { key: 'price', value: '200€' },
      { key: 'count', value: -200 },
      { key: 'count', value: 0 },
      { key: 'count', value: 1.23 },
      { key: 'count', value: '1x' },
      { key: 'percentage', value: -20 },
      { key: 'percentage', value: 0 },
      { key: 'percentage', value: 10.5 },
      { key: 'percentage', value: 105 },
      { key: 'percentage', value: '10%' },
      { key: 'countUnit', value: 'learner' },
      { key: 'quantity', value: -1 },
      { key: 'quantity', value: '1' },
      { key: 'quantity', value: 0 },
    ];

    wrongValues.forEach((wrongValue) => {
      it(`should return 400 as ${wrongValue.key} has wrong value : ${wrongValue.value}`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/coursebills/list-creation',
          payload: {
            ...payload,
            quantity: 1,
            maturityDate: '2025-04-29T22:00:00.000+00:00',
            mainFee: { ...payload.mainFee, [wrongValue.key]: wrongValue.value },
          },
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return 404 if course does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: new ObjectId() },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if company is not registered to course', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, companies: [otherCompany._id] },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if fundingOrganisation (payer) does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, payer: { fundingOrganisation: new ObjectId() } },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if company (payer) does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          ...payload,
          payer: { company: new ObjectId() },
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course is interruptedAt', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: coursesList[14]._id },
      });

      expect(response.statusCode).toBe(403);
    });
    it('should return 403 if payload has percentage but some companies have no price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          ...payload,
          quantity: 1,
          maturityDate: '2025-04-29T22:00:00.000+00:00',
          course: coursesList[13]._id,
          companies: [otherCompany._id, companyWithoutSubscription._id],
          mainFee: { ...payload.mainFee, price: 480, percentage: 40 },
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if expectedCount is not defined (intra)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: coursesList[10]._id, companies: [otherCompany._id] },
      });

      expect(response.statusCode).toBe(409);
    });
    it('should return 409 if number of bills without CN + quantity is greater than expectedBillsCount'
      + '(intra)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, quantity: 4 },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if company sum percentage is bigger than 100', async () => {
      const payloadWithPercentage = {
        quantity: 1,
        maturityDate: '2025-04-29T22:00:00.000+00:00',
        course: coursesList[13]._id,
        mainFee: { price: 320, count: 2, countUnit: GROUP, percentage: 70 },
        payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
        companies: [otherCompany._id, authCompany._id],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-creation',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: payloadWithPercentage,
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('Other roles', () => {
    const roles = [{ name: 'client_admin', expectedCode: 403 }, { name: 'trainer', expectedCode: 403 }];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/coursebills/list-creation',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILL ROUTES - PUT /coursebills/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add a fundingOrganisation as payer to course bill', async () => {
      const countBefore = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        'payer.fundingOrganisation': { $exists: false },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { payer: { fundingOrganisation: courseFundingOrganisationList[0]._id } },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
      });
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should add a company as payer to course bill', async () => {
      const countBefore = await CourseBill.countDocuments({
        _id: courseBillsList[1]._id,
        'payer.company': { $exists: false },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { payer: { company: authCompany._id } },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        payer: { company: authCompany._id },
      });
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should change fundingOrganisation to course bill', async () => {
      const countBefore = await CourseBill.countDocuments({
        _id: courseBillsList[1]._id,
        payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { payer: { fundingOrganisation: courseFundingOrganisationList[1]._id } },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments({
        _id: courseBillsList[1]._id,
        payer: { fundingOrganisation: courseFundingOrganisationList[1]._id },
      });
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should update main fee on course bill', async () => {
      const countBefore = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        mainFee: { price: 120, count: 1, countUnit: GROUP },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { mainFee: { price: 130, count: 1, countUnit: GROUP } },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        mainFee: { price: 130, count: 1, countUnit: GROUP },
      });
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should update maturityDate on course bill', async () => {
      const countBefore = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        maturityDate: '2025-04-29T22:00:00.000+00:00',
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { maturityDate: '2025-05-02T22:00:00.000+00:00' },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        maturityDate: '2025-05-02T22:00:00.000+00:00',
      });
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should add main fee description to course bill', async () => {
      const countBefore = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        'mainFee.description': { $exists: false },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { mainFee: { price: 130, count: 1, description: 'Nouvelle description' } },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments({
        _id: courseBillsList[0]._id,
        mainFee: { price: 130, count: 1, description: 'Nouvelle description' },
      });
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should change main fee description on course bill', async () => {
      const countBefore = await CourseBill.countDocuments({
        _id: courseBillsList[1]._id,
        mainFee: { description: 'Lorem ipsum' },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { mainFee: { price: 130, count: 1, description: 'Nouvelle description' } },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments({
        _id: courseBillsList[1]._id,
        mainFee: { price: 130, count: 1, description: 'Nouvelle description' },
      });
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should remove main fee description on course bill', async () => {
      const countBefore = await CourseBill
        .countDocuments({ _id: courseBillsList[1]._id, 'mainFee.description': { $exists: true } });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { mainFee: { price: 130, count: 1, description: '' } },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments(
        { _id: courseBillsList[1]._id, mainFee: { price: 130, count: 1 }, 'mainFee.description': { $exists: false } }
      );
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should update percentage on course bill', async () => {
      const countBefore = await CourseBill.countDocuments({
        _id: courseBillsList[13]._id,
        mainFee: { price: 120, count: 1, countUnit: TRAINEE, percentage: 10 },
        billingPurchaseList: { $elemMatch: { price: 12, count: 1, percentage: 10 } },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[13]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { mainFee: { price: 240, count: 1, countUnit: TRAINEE, percentage: 20 } },
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await CourseBill.countDocuments({
        _id: courseBillsList[13]._id,
        mainFee: { price: 240, count: 1, countUnit: TRAINEE, percentage: 20 },
        billingPurchaseList: { $elemMatch: { price: 24, count: 1, percentage: 20 } },
      });
      expect(countBefore).toBeTruthy();
      expect(countAfter).toBeTruthy();
    });

    it('should invoice course bill', async () => {
      const isBilledBefore = await CourseBill.countDocuments({ number: 'FACT-00009' });
      expect(isBilledBefore).toBeFalsy();

      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { billedAt: '2022-03-08T00:00:00.000Z' },
      });

      expect(response.statusCode).toBe(200);
      const isBilledAfter = await CourseBill
        .countDocuments({ _id: courseBillsList[0]._id, billedAt: '2022-03-08T00:00:00.000Z', number: 'FACT-00009' });
      expect(isBilledAfter).toBeTruthy();
    });

    it('should update description on invoiced course bill', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          payer: { fundingOrganisation: courseBillsList[4].payer.fundingOrganisation },
          mainFee: { price: 200, count: 2, description: 'desk rip Sean' },
        },
      });

      expect(response.statusCode).toBe(200);

      const isUpdated = await CourseBill
        .countDocuments({
          _id: courseBillsList[4]._id,
          billedAt: '2022-04-07T00:00:00.000Z',
          mainFee: { price: 200, count: 2, description: 'desk rip Sean' },
        });
      expect(isUpdated).toBeTruthy();
    });

    const wrongValuesMainFee = { price: 120, count: 1, description: 'lorem ipsum', percentage: 10 };
    const wrongValues = [
      { key: 'price', value: -200 },
      { key: 'price', value: 0 },
      { key: 'price', value: '200€' },
      { key: 'count', value: -200 },
      { key: 'count', value: 0 },
      { key: 'count', value: 1.23 },
      { key: 'count', value: '1x' },
      { key: 'percentage', value: -20 },
      { key: 'percentage', value: 0 },
      { key: 'percentage', value: 10.5 },
      { key: 'percentage', value: 105 },
      { key: 'percentage', value: '10%' },
      { key: 'countUnit', value: '' },
    ];
    wrongValues.forEach((param) => {
      it(`should return 400 as ${param.key} has wrong value : ${param.value}`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/coursebills/${courseBillsList[13]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { mainFee: { ...wrongValuesMainFee, [param.key]: param.value } },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return 400 if payer is funding organisation and company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        payload: { payer: { fundingOrganisation: courseFundingOrganisationList[0]._id, company: authCompany._id } },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if course is intra and count unit is trainee', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        payload: { countUnit: TRAINEE },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if course is single and count unit is group', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[12]._id}`,
        payload: { countUnit: GROUP },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if course is single and count is not 1', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[12]._id}`,
        payload: { count: 2 },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${new ObjectId()}`,
        payload: { payer: { fundingOrganisation: courseFundingOrganisationList[0]._id } },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if funding organisation as payer doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        payload: { payer: { fundingOrganisation: new ObjectId() } },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if company as payer doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        payload: { payer: { company: new ObjectId() } },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if payload has billedAt and mainFee fields', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { mainFee: { price: 130, count: 1 }, billedAt: '2022-03-08T00:00:00.000Z' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if requesting invoice on already invoiced bill', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { billedAt: '2022-03-08T00:00:00.000Z' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if requesting invoice and client company has no address', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[5]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { billedAt: '2022-03-08T00:00:00.000Z' },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual('L\'adresse de la structure cliente est manquante.');
    });

    it('should return 403 if update percentage on course bill without percentage', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[12]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { mainFee: { price: 240, count: 1, countUnit: TRAINEE, percentage: 20 } },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if adding payer on validated bill', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {
          payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
          mainFee: { price: 120, count: 1, description: 'Lorem ipsum' },
        },
      });

      expect(response.statusCode).toBe(403);
    });

    const forbiddenUpdatesPayload = {
      payer: { fundingOrganisation: courseBillsList[4].payer.fundingOrganisation },
      mainFee: { price: 200, count: 2, description: 'Salut' },
    };
    const forbiddenUpdates = [
      { key: 'mainFee.price', value: 333 },
      { key: 'mainFee.count', value: 12 },
      { key: 'payer.fundingOrganisation', value: courseFundingOrganisationList[1]._id },
    ];
    forbiddenUpdates.forEach((param) => {
      it(`should return 403 if updating ${param.key}`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/coursebills/${courseBillsList[4]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: set(forbiddenUpdatesPayload, param.key, param.value),
        });

        expect(response.statusCode).toBe(403);
      });
    });

    it('should return 409 if company sum percentage is bigger than 100', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillsList[13]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { mainFee: { price: 1080, count: 1, countUnit: TRAINEE, percentage: 90 } },
      });

      expect(response.statusCode).toBe(409);
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
          url: `/coursebills/${courseBillsList[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { payer: { fundingOrganisation: courseFundingOrganisationList[0]._id } },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILL ROUTES - POST /coursebills/list-edition', () => {
  let authToken;
  beforeEach(populateDB);
  const courseBillsToValidate = [courseBillsList[0]._id, courseBillsList[1]._id, courseBillsList[3]._id];

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should validate course bills', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-edition',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: courseBillsToValidate, billedAt: '2022-03-08T00:00:00.000Z' },
      });

      expect(response.statusCode).toBe(200);

      const countBill = await CourseBill
        .countDocuments({ _id: { $in: courseBillsToValidate }, billedAt: { $exists: true } });
      expect(countBill).toBe(3);
    });

    it('should return 400 if no course bill in payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-edition',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: [], billedAt: '2022-03-08T00:00:00.000Z' },

      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-edition',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: [...courseBillsToValidate, new ObjectId()], billedAt: '2022-03-08T00:00:00.000Z' },

      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course bill have billedAt', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-edition',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: [...courseBillsToValidate, courseBillsList[2]._id], billedAt: '2022-03-08T00:00:00.000Z' },
      });

      expect(response.statusCode).toBe(403);
    });
    it('should return 403 if course bill payer has no address', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-edition',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: [...courseBillsToValidate, courseBillsList[5]._id], billedAt: '2022-03-08T00:00:00.000Z' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'POST',
          url: '/coursebills/list-edition',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { _ids: courseBillsToValidate, billedAt: '2022-03-08T00:00:00.000Z' },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILL ROUTES - POST /coursebills/{_id}/billingpurchases', () => {
  let authToken;
  beforeEach(populateDB);
  const payload = { billingItem: billingItemList[2]._id, price: 7, count: 5, description: 'croissant du matin' };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add a billing item to course bill', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/coursebills/${courseBillsList[0]._id}/billingpurchases`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseBillAfter = await CourseBill.findOne({ _id: courseBillsList[0]._id }).lean();
      expect(courseBillAfter.billingPurchaseList.length).toBe(courseBillsList[0].billingPurchaseList.length + 1);
    });

    const wrongValues = [
      { key: 'price', value: -200 },
      { key: 'price', value: 0 },
      { key: 'price', value: '200€' },
      { key: 'count', value: -200 },
      { key: 'count', value: 0 },
      { key: 'count', value: 1.23 },
      { key: 'count', value: '1x' },
    ];
    wrongValues.forEach((param) => {
      it(`should return 400 as ${param.key} has wrong value : ${param.value}`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: `/coursebills/${courseBillsList[0]._id}/billingpurchases`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { ...payload, [param.key]: param.value },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return 404 if course bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/coursebills/${new ObjectId()}/billingpurchases`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if billing item doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/coursebills/${courseBillsList[0]._id}/billingpurchases`,
        payload: { ...payload, billingItem: new ObjectId() },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if billing item is already added to course bill', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/coursebills/${courseBillsList[0]._id}/billingpurchases`,
        payload: { ...payload, billingItem: billingItemList[1]._id },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 403 if bill is invoiced', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/coursebills/${courseBillsList[2]._id}/billingpurchases`,
        payload,
        headers: { 'x-access-token': authToken },
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
          method: 'POST',
          url: `/coursebills/${courseBillsList[0]._id}/billingpurchases`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILL ROUTES - PUT /coursebills/{_id}/billingpurchases/{billingPurchaseId}', () => {
  let authToken;
  beforeEach(populateDB);
  const courseBillId = courseBillsList[0]._id;
  const billingPurchaseId = courseBillsList[0].billingPurchaseList[0]._id;
  const courseBillInvoicedId = courseBillsList[2]._id;
  const billingPurchaseInvoicedId = courseBillsList[2].billingPurchaseList[0]._id;
  const billWithPercentageId = courseBillsList[13]._id;
  const trainerFeesWithPercentageId = courseBillsList[13].billingPurchaseList[0]._id;

  const payload = { price: 22, count: 2, description: 'café du midi' };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update purchase with new description', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillId}/billingpurchases/${billingPurchaseId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseBillAfter = await CourseBill.countDocuments({
        _id: courseBillId,
        'billingPurchaseList._id': billingPurchaseId,
        'billingPurchaseList.price': 22,
        'billingPurchaseList.count': 2,
        'billingPurchaseList.description': 'café du midi',
      });
      expect(courseBillAfter).toBeTruthy();
    });

    it('should update purchase and remove description', async () => {
      const courseBillWithDescriptionId = courseBillsList[3]._id;
      const billingPurchaseWithDescriptionId = courseBillsList[3].billingPurchaseList[0]._id;
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillWithDescriptionId}/billingpurchases/${billingPurchaseWithDescriptionId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { price: 100, count: 3, description: '' },
      });

      expect(response.statusCode).toBe(200);

      const courseBillAfter = await CourseBill.countDocuments({
        _id: courseBillWithDescriptionId,
        'billingPurchaseList._id': billingPurchaseWithDescriptionId,
        'billingPurchaseList.price': 100,
        'billingPurchaseList.count': 3,
        'billingPurchaseList.description': { $exists: false },
      });
      expect(courseBillAfter).toBeTruthy();
    });

    it('should update description even if bill is invoiced', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillInvoicedId}/billingpurchases/${billingPurchaseInvoicedId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { price: 9, count: 1, description: 'Salade de gésier du matin' },
      });

      expect(response.statusCode).toBe(200);

      const courseBillAfter = await CourseBill.countDocuments({
        _id: courseBillInvoicedId,
        'billingPurchaseList._id': billingPurchaseInvoicedId,
        'billingPurchaseList.price': 9,
        'billingPurchaseList.count': 1,
        'billingPurchaseList.description': 'Salade de gésier du matin',
      });
      expect(courseBillAfter).toBeTruthy();
    });

    it('should update description of trainer fees with percentage', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${billWithPercentageId}/billingpurchases/${trainerFeesWithPercentageId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { price: 12, count: 1, description: 'description' },
      });

      expect(response.statusCode).toBe(200);

      const courseBillAfter = await CourseBill.countDocuments({
        _id: billWithPercentageId,
        'billingPurchaseList._id': trainerFeesWithPercentageId,
        'billingPurchaseList.price': 12,
        'billingPurchaseList.count': 1,
        'billingPurchaseList.percentage': 10,
        'billingPurchaseList.description': 'description',
      });
      expect(courseBillAfter).toBeTruthy();
    });

    const wrongValues = [
      { key: 'price', value: -200 },
      { key: 'price', value: 0 },
      { key: 'price', value: '200€' },
      { key: 'count', value: -200 },
      { key: 'count', value: 0 },
      { key: 'count', value: 1.23 },
      { key: 'count', value: '1x' },
    ];
    wrongValues.forEach((param) => {
      it(`should return 400 as ${param.key} has wrong value : ${param.value}`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/coursebills/${courseBillId}/billingpurchases/${billingPurchaseId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { ...payload, [param.key]: param.value },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return 404 if course bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${new ObjectId()}/billingpurchases/${billingPurchaseId}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if billing purchase is not related to course bill', async () => {
      const purchaseRelatedToOtherBillId = courseBillsList[3].billingPurchaseList[0]._id;
      const response = await app.inject({
        method: 'PUT',
        url: `/coursebills/${courseBillId}/billingpurchases/${purchaseRelatedToOtherBillId}`,
        headers: { 'x-access-token': authToken },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    const forbiddenUpdatesPayload = { price: 9, count: 1, description: 'BN du goûter' };
    const forbiddenUpdates = [
      { key: 'price', value: 19 },
      { key: 'count', value: 77 },
    ];
    forbiddenUpdates.forEach((param) => {
      it(`should return 403 if updating ${param.key} when bill is invoiced`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/coursebills/${courseBillInvoicedId}/billingpurchases/${billingPurchaseInvoicedId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: set(forbiddenUpdatesPayload, param.key, param.value),
        });

        expect(response.statusCode).toBe(403);
      });
    });

    forbiddenUpdates.forEach((param) => {
      it(`should return 403 if updating ${param.key} of trainer fees with percentage`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/coursebills/${billWithPercentageId}/billingpurchases/${trainerFeesWithPercentageId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: set(forbiddenUpdatesPayload, param.key, param.value),
        });

        expect(response.statusCode).toBe(403);
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
          method: 'PUT',
          url: `/coursebills/${courseBillId}/billingpurchases/${billingPurchaseId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILL ROUTES - DELETE /coursebills/{_id}/billingpurchases/{billingPurchaseId}', () => {
  let authToken;
  beforeEach(populateDB);
  const courseBillId = courseBillsList[0]._id;
  const billingPurchaseId = courseBillsList[0].billingPurchaseList[0]._id;

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete purchase in course bill', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebills/${courseBillId}/billingpurchases/${billingPurchaseId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const billingPurchaseDeleted = await CourseBill.countDocuments({
        _id: courseBillId,
        'billingPurchaseList._id': { $nin: billingPurchaseId },
      });
      expect(billingPurchaseDeleted).toBeTruthy();
    });

    it('should return 403 if course bill already validated', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebills/${courseBillsList[2]._id}/billingpurchases/${courseBillsList[2].billingPurchaseList[0]._id}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if course trainer fees with percentage', async () => {
      const billWithPercentageId = courseBillsList[13]._id;
      const trainerFeesWithPercentageId = courseBillsList[13].billingPurchaseList[0]._id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebills/${billWithPercentageId}/billingpurchases/${trainerFeesWithPercentageId}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if course bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebills/${new ObjectId()}/billingpurchases/${billingPurchaseId}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if billing purchase is not related to course bill', async () => {
      const purchaseRelatedToOtherBillId = courseBillsList[3].billingPurchaseList[0]._id;
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebills/${courseBillId}/billingpurchases/${purchaseRelatedToOtherBillId}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
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
          method: 'DELETE',
          url: `/coursebills/${courseBillId}/billingpurchases/${billingPurchaseId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE BILL ROUTES - POST /coursebills/list-deletion', () => {
  let authToken;
  beforeEach(populateDB);
  const courseBillsToDelete = [courseBillsList[0]._id, courseBillsList[1]._id, courseBillsList[3]._id];

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete course bills', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-deletion',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: courseBillsToDelete },
      });

      expect(response.statusCode).toBe(200);

      const countBill = await CourseBill.countDocuments({ _id: { $in: courseBillsToDelete } });
      expect(countBill).toBe(0);
    });

    it('should return 400 if no course bill in payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-deletion',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: [] },

      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-deletion',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: [...courseBillsToDelete, new ObjectId()] },

      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course bill have billedAt', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills/list-deletion',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { _ids: [...courseBillsToDelete, courseBillsList[2]._id] },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'POST',
          url: '/coursebills/list-deletion',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { _ids: courseBillsToDelete },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
