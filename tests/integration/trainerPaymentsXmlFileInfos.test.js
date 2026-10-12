const { expect } = require('expect');
const app = require('../../server');
const TrainerPayment = require('../../src/models/TrainerPayment');
const VendorCompany = require('../../src/models/VendorCompany');
const {
  populateDB,
  trainerPaymentId,
  noBankDetailsPaymentId,
  linkedPaymentId,
  paidUnlinkedPaymentId,
} = require('./seed/trainerPaymentsXmlFileInfosSeed');
const { getToken } = require('./helpers/authentication');
const { XML_GENERATED } = require('../../src/helpers/constants');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('TRAINERPAYMENTSXMLFILEINFOS ROUTE - POST /trainerpaymentsxmlfileinfos', () => {
  let authToken;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should generate the credit transfer file and set the payment to xml_generated', async () => {
      const payload = { payments: [trainerPaymentId], name: 'Virement - Janvier 2024' };

      const response = await app.inject({
        method: 'POST',
        url: '/trainerpaymentsxmlfileinfos',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result).toBeDefined();

      const paymentCount = await TrainerPayment
        .countDocuments({ _id: trainerPaymentId, status: XML_GENERATED });
      expect(paymentCount).toBe(1);
    });

    it('should return 403 if a trainer has no bic or iban', async () => {
      const payload = { payments: [noBankDetailsPaymentId], name: 'Virement - Janvier 2024' };

      const response = await app.inject({
        method: 'POST',
        url: '/trainerpaymentsxmlfileinfos',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if the vendor company has no bic or iban', async () => {
      await VendorCompany.updateOne({}, { $unset: { bic: '', iban: '' } });
      const payload = { payments: [trainerPaymentId], name: 'Virement - Janvier 2024' };

      const response = await app.inject({
        method: 'POST',
        url: '/trainerpaymentsxmlfileinfos',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if the name is already used by an existing xml file', async () => {
      const payload = { payments: [trainerPaymentId], name: 'alreadyGenerated' };

      const response = await app.inject({
        method: 'POST',
        url: '/trainerpaymentsxmlfileinfos',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if a payment is already linked to an existing xml file', async () => {
      const payload = { payments: [linkedPaymentId], name: 'Virement - Février 2024' };

      const response = await app.inject({
        method: 'POST',
        url: '/trainerpaymentsxmlfileinfos',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if a payment is not pending', async () => {
      const payload = { payments: [paidUnlinkedPaymentId], name: 'Virement - Janvier 2024' };

      const response = await app.inject({
        method: 'POST',
        url: '/trainerpaymentsxmlfileinfos',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'POST',
          url: '/trainerpaymentsxmlfileinfos',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: { payments: [trainerPaymentId], name: 'Virement - Janvier 2024' },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
