const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const omit = require('lodash/omit');
const app = require('../../server');
const { coursePaymentList, populateDB } = require('./seed/xmlSEPAFileInfosSeed');
const { getToken } = require('./helpers/authentication');
const { XML_GENERATED } = require('../../src/helpers/constants');
const CoursePayment = require('../../src/models/CoursePayment');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('XMLSEPAFILEINFOS ROUTE - POST /xmlsepafileinfos', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create xmlSEPAFileInfos and update payments status', async () => {
      const payload = {
        payments: [coursePaymentList[0]._id, coursePaymentList[2]._id],
        name: 'Compani - Septembre 2025',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result).toBeDefined();
      const paymentsCountAfter = await CoursePayment
        .countDocuments({ _id: { $in: [coursePaymentList[0]._id, coursePaymentList[2]._id] }, status: XML_GENERATED });
      expect(paymentsCountAfter).toEqual(2);
    });

    const missingParams = ['payments', 'name'];
    missingParams.forEach((param) => {
      it(`should return 400 if ${param} is missing in payload`, async () => {
        const payload = {
          payments: [coursePaymentList[0]._id, coursePaymentList[2]._id],
          name: 'Compani - Septembre 2025',
        };

        const response = await app.inject({
          method: 'POST',
          url: '/xmlsepafileinfos',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: omit(payload, param),
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return 400 if there is no payment', async () => {
      const payload = { payments: [], name: 'Compani - Septembre 2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if a payment does not exist', async () => {
      const payload = {
        payments: [coursePaymentList[0]._id, new ObjectId()],
        name: 'Compani - Septembre 2025',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if a payment is not a direct_debit', async () => {
      const payload = {
        payments: [coursePaymentList[0]._id, coursePaymentList[1]._id],
        name: 'Compani - Septembre 2025',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if a payment is not pending', async () => {
      const payload = {
        payments: [coursePaymentList[0]._id, coursePaymentList[5]._id],
        name: 'Compani - Septembre 2025',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if a payment is linked to a bill with a funding organisation as payer', async () => {
      const payload = { payments: [coursePaymentList[3]._id], name: 'Compani - Septembre 2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if a payer has no signedMandate', async () => {
      const payload = { payments: [coursePaymentList[6]._id], name: 'Compani - Septembre 2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if a payer has no BIC', async () => {
      const payload = { payments: [coursePaymentList[7]._id], name: 'Compani - Septembre 2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if a payer has no IBAN', async () => {
      const payload = { payments: [coursePaymentList[8]._id], name: 'Compani - Septembre 2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if a payment is already linked to a xml file', async () => {
      const payload = { payments: [coursePaymentList[4]._id], name: 'Compani - Juillet 2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if a xml file exists with same name', async () => {
      const payload = { payments: [coursePaymentList[0]._id], name: 'sepaInfos' };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });
  });
});
