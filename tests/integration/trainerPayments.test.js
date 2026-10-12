const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const app = require('../../server');
const TrainerBill = require('../../src/models/TrainerBill');
const TrainerPayment = require('../../src/models/TrainerPayment');
const CourseSlot = require('../../src/models/CourseSlot');
const GCloudStorageHelper = require('../../src/helpers/gCloudStorage');
const {
  populateDB,
  trainerBillId,
  trainerPaymentId,
  paidTrainerPaymentId,
  linkedPaymentId,
} = require('./seed/trainerPaymentsSeed');
const { getToken } = require('./helpers/authentication');
const { PENDING, XML_GENERATED, PAID } = require('../../src/helpers/constants');

describe('TRAINER PAYMENTS ROUTES - GET /trainerpayments', () => {
  let authToken;

  beforeEach(async () => {
    await populateDB();
  });

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should list the trainer payments filtered by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/trainerpayments?status=paid',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const paymentNumbers = response.result.data.trainerPayments.map(p => p.number).sort();
      expect(paymentNumbers).toEqual(['REG-00101', 'REG-00102'].sort());

      const paidTrainerPayment = response.result.data.trainerPayments.find(p => p.number === 'REG-00101');
      expect(paidTrainerPayment.trainerBill.number).toBe('FACT_0099');
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
          method: 'GET',
          url: '/trainerpayments?status=pending',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('TRAINER PAYMENTS ROUTES - PUT /trainerpayments/{_id}', () => {
  let authToken;

  beforeEach(async () => {
    await populateDB();
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update the status of the trainer payment', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerpayments/${trainerPaymentId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: PAID },
      });

      expect(response.statusCode).toBe(200);
      const trainerPaymentCount = await TrainerPayment.countDocuments({ _id: trainerPaymentId, status: PAID });
      expect(trainerPaymentCount).toBe(1);
    });

    it('should update a paid trainer payment (without xml) back to pending', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerpayments/${paidTrainerPaymentId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: PENDING },
      });

      expect(response.statusCode).toBe(200);
      const trainerPaymentCount = await TrainerPayment
        .countDocuments({ _id: paidTrainerPaymentId, status: PENDING });
      expect(trainerPaymentCount).toBe(1);
    });

    it('should update payment status linked to a xml file to paid', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerpayments/${linkedPaymentId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: PAID },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 if status is XML_GENERATED', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerpayments/${trainerPaymentId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: XML_GENERATED },
      });

      expect(response.statusCode).toBe(400);
      const trainerPaymentCount = await TrainerPayment.countDocuments({ _id: trainerPaymentId, status: PENDING });
      expect(trainerPaymentCount).toBe(1);
    });

    it('should return 404 if trainer payment does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerpayments/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: PAID },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if trying to set a payment linked to xml file back to pending', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerpayments/${linkedPaymentId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: PENDING },
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
          url: `/trainerpayments/${trainerPaymentId}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: { status: PAID },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('TRAINER PAYMENTS ROUTES - DELETE /trainerpayments/{_id}', () => {
  let authToken;
  let deleteCourseFile;

  beforeEach(async () => {
    await populateDB();
    deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
  });

  afterEach(() => {
    deleteCourseFile.restore();
  });

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should cancel a pending trainer bill with its payment and file', async () => {
      const trainerBillBeforeCount = await TrainerBill.countDocuments({ _id: trainerBillId });
      expect(trainerBillBeforeCount).toBe(1);

      const response = await app.inject({
        method: 'DELETE',
        url: `/trainerpayments/${trainerPaymentId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const trainerBillCount = await TrainerBill.countDocuments({ _id: trainerBillId });
      expect(trainerBillCount).toBe(0);
      const trainerPaymentCount = await TrainerPayment.countDocuments({ trainerBill: trainerBillId });
      expect(trainerPaymentCount).toBe(0);
      const updatedSlotsCount = await CourseSlot.countDocuments({ 'trainerBillings.trainerBill': trainerBillId });
      expect(updatedSlotsCount).toBe(0);
      sinon.assert.calledOnceWithExactly(deleteCourseFile, 'publicId');
    });

    it('should return 403 if trainer payment is already paid', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainerpayments/${paidTrainerPaymentId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if trainer payment does not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainerpayments/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
          url: `/trainerpayments/${trainerPaymentId}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
