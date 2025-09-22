const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const omit = require('lodash/omit');
const app = require('../../server');
const { coursePaymentList, populateDB } = require('./seed/xmlSEPAFileInfosSeed');
const { getToken } = require('./helpers/authentication');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('XMLSEPAFILEINFOS ROUTE - POST /xmlsepafileinfos #tag', () => {
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
      expect(response.result).toEqual({ name: 'Prelevements_SEPA_Compani - Septembre 2025.xml' });
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

    it('should return 409 if a payment is already linked to a xml file', async () => {
      const payload = { payments: [coursePaymentList[4]._id], name: 'Compani - Juillet 2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/xmlsepafileinfos',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
