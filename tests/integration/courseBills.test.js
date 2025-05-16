const pick = require('lodash/pick');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const { omit, set } = require('lodash');
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

describe('COURSE BILL ROUTES - POST /coursebills', () => {
  let authToken;
  beforeEach(populateDB);
  const payload = {
    course: coursesList[2]._id,
    companies: [otherCompany._id],
    mainFee: { price: 120, count: 1, countUnit: GROUP, description: 'test' },
    payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
    maturityDate: '2025-04-29T22:00:00.000+00:00',
  };

  const payloadWithPercentage = {
    course: coursesList[13]._id,
    companies: [otherCompany._id, authCompany._id],
    mainFee: { price: 320, count: 2, countUnit: TRAINEE, percentage: 20 },
    payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
    maturityDate: '2025-04-29T22:00:00.000+00:00',
  };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a course bill with fundingOrganisation as payer (intra)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const count = await CourseBill.countDocuments();
      expect(count).toBe(courseBillsList.length + 1);
    });

    it('should create a course bill with company as payer (intra)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, payer: { company: otherCompany._id } },
      });

      expect(response.statusCode).toBe(200);

      const count = await CourseBill.countDocuments();
      expect(count).toBe(courseBillsList.length + 1);
    });

    it('should create a course bill (inter b2b)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: coursesList[9]._id },
      });

      expect(response.statusCode).toBe(200);

      const count = await CourseBill.countDocuments();
      expect(count).toBe(courseBillsList.length + 1);
    });

    it('should create a bill if expectedBillsCount higher than number of bills without creditNote', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: coursesList[1]._id, companies: [authCompany._id] },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should create a bill with percentage', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: payloadWithPercentage,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if course is single but payload has percentage', async () => {
      const singleCoursePayload = {
        course: coursesList[12]._id,
        companies: [otherCompany._id],
        mainFee: { price: 1500, count: 1, countUnit: TRAINEE, percentage: 10 },
        payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
        maturityDate: '2025-04-29T22:00:00.000+00:00',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: singleCoursePayload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if payload has percentage but some companies have no price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payloadWithPercentage, companies: [otherCompany._id, companyWithoutSubscription._id] },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if percentage sum is bigger than 100', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payloadWithPercentage, mainFee: { price: 1520, count: 2, countUnit: TRAINEE, percentage: 95 } },
      });

      expect(response.statusCode).toBe(409);
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
      it(`should return 400 as ${param} is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/coursebills',
          payload: omit(payloadWithPercentage, param),
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
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
    ];
    wrongValues.forEach((param) => {
      it(`should return 400 as ${param.key} has wrong value : ${param.value}`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/coursebills',
          payload: { ...payloadWithPercentage, mainFee: { ...payload.mainFee, [param.key]: param.value } },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return 400 if payer is funding organisation and company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        payload: {
          ...payload,
          payer: { fundingOrganisation: courseFundingOrganisationList[0]._id, company: otherCompany._id },
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if course is INTRA and count unit is trainee', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        payload: { ...payload, mainFee: { price: 120, count: 1, countUnit: TRAINEE } },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if course is SINGLE and count unit is group', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        payload: { ...payload, course: coursesList[12]._id, mainFee: { price: 120, count: 1, countUnit: GROUP } },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if course is SINGLE and count is not 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        payload: { ...payload, course: coursesList[12]._id, mainFee: { price: 120, count: 2, countUnit: TRAINEE } },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if no company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        payload: { ...payload, companies: [] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 as course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        payload: { ...payload, course: new ObjectId() },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 as companies don\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        payload: { ...payload, companies: [new ObjectId()] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    const wrongPayers = ['company', 'fundingOrganisation'];
    wrongPayers.forEach((payer) => {
      it(`should return 404 if ${payer} doesn't exists`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/coursebills',
          payload: { ...payload, payer: { [payer]: new ObjectId() } },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    it('should return 404 as company is not registered to course', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        payload: { ...payload, course: coursesList[0]._id },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if expectedBillsCount is 0', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: coursesList[10]._id },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if expectedBillsCount is equal to number of bills without creditNote', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursebills',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { ...payload, course: coursesList[0]._id, companies: [authCompany._id] },
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
          method: 'POST',
          url: '/coursebills',
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

describe('COURSE BILL ROUTES - DELETE /coursebills/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete course bill', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebills/${courseBillsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const countBill = await CourseBill.countDocuments({ _id: courseBillsList[0]._id });
      expect(countBill).toBe(0);
    });

    it('should return 404 if course bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebills/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course bill have billedAt', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/coursebills/${courseBillsList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
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
          method: 'DELETE',
          url: `/coursebills/${courseBillsList[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
