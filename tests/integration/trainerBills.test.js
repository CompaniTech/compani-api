const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const app = require('../../server');
const TrainerInvoice = require('../../src/models/TrainerInvoice');
const CourseSlot = require('../../src/models/CourseSlot');
const NodemailerHelper = require('../../src/helpers/nodemailer');
const { trainer, trainerAndCoach } = require('../seed/authUsersSeed');
const { populateDB, courseSlotsList, trainerInvoiceId, paidTrainerInvoiceId } = require('./seed/trainerInvoicesSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { generateFormData, getStream } = require('./utils');
const { INVOICED, PAID } = require('../../src/helpers/constants');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('TRAINER INVOICES ROUTES - POST /trainerinvoices', () => {
  let authToken;
  let sendinBlueTransporter;

  beforeEach(async () => {
    await populateDB();
    sendinBlueTransporter = sinon.stub(NodemailerHelper, 'sendinBlueTransporter')
      .returns({ sendMail: sinon.stub().returns('emailSent') });
  });

  afterEach(() => {
    sendinBlueTransporter.restore();
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should create a trainer invoice and link it to the course slots', async () => {
      const form = generateFormData({ number: 'FACT_0002', file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());
      form.append('courseSlots', courseSlotsList[1]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(200);

      const trainerInvoiceCount = await TrainerInvoice.countDocuments({
        trainer: trainer._id,
        number: 'FACT_0002',
        status: INVOICED,
        courseSlots: [courseSlotsList[0]._id, courseSlotsList[1]._id],
      });
      expect(trainerInvoiceCount).toBe(1);

      const updatedSlotsCount = await CourseSlot.countDocuments({
        _id: { $in: [courseSlotsList[0]._id, courseSlotsList[1]._id] },
        'trainerBills.trainer': trainer._id,
      });
      expect(updatedSlotsCount).toBe(2);
    });

    it('should accept a single course slot id (not wrapped in an array)', async () => {
      const form = generateFormData({ number: 'FACT_0003', file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(200);
      const trainerInvoiceCount = await TrainerInvoice
        .countDocuments({ trainer: trainer._id, number: 'FACT_0003' });
      expect(trainerInvoiceCount).toBe(1);
    });

    it('should return 400 if number is missing', async () => {
      const form = generateFormData({ file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if file is missing', async () => {
      const form = generateFormData({ number: 'FACT_0004' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course slot does not exist', async () => {
      const form = generateFormData({ number: 'FACT_0005', file: 'test' });
      form.append('courseSlots', new ObjectId().toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if course slot doesn\'t belong to the trainer', async () => {
      const form = generateFormData({ number: 'FACT_0006', file: 'test' });
      form.append('courseSlots', courseSlotsList[3]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if a course slot is already invoiced', async () => {
      const form = generateFormData({ number: 'FACT_0007', file: 'test' });
      form.append('courseSlots', courseSlotsList[2]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if invoice number is already used by this trainer', async () => {
      const form = generateFormData({ number: 'FACT_0001', file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('Other trainer', () => {
    it('should return 404 if trying to invoice someone else\'s course slots', async () => {
      authToken = await getTokenByCredentials(trainerAndCoach.local);

      const form = generateFormData({ number: 'FACT_0008', file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerinvoices',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const form = generateFormData({ number: 'FACT_0009', file: 'test' });
        form.append('courseSlots', courseSlotsList[0]._id.toHexString());

        const response = await app.inject({
          method: 'POST',
          url: '/trainerinvoices',
          headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: getStream(form),
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('TRAINER INVOICES ROUTES - PUT /trainerinvoices/{_id}', () => {
  let authToken;

  beforeEach(async () => {
    await populateDB();
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update an invoiced trainer invoice to paid', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerinvoices/${trainerInvoiceId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: PAID },
      });

      expect(response.statusCode).toBe(200);
      const trainerInvoiceCount = await TrainerInvoice.countDocuments({ _id: trainerInvoiceId, status: PAID });
      expect(trainerInvoiceCount).toBe(1);
    });

    it('should update a paid trainer invoice to invoiced', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerinvoices/${paidTrainerInvoiceId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: INVOICED },
      });

      expect(response.statusCode).toBe(200);
      const trainerInvoiceCount = await TrainerInvoice.countDocuments({ _id: paidTrainerInvoiceId, status: INVOICED });
      expect(trainerInvoiceCount).toBe(1);
    });

    it('should return 409 if trainer invoice is not in the expected starting status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerinvoices/${paidTrainerInvoiceId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: PAID },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if trainer invoice does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/trainerinvoices/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { status: PAID },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'PUT',
          url: `/trainerinvoices/${trainerInvoiceId}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: { status: PAID },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('TRAINER INVOICES ROUTES - DELETE /trainerinvoices/{_id}', () => {
  let authToken;

  beforeEach(async () => {
    await populateDB();
  });

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should cancel an invoiced trainer invoice', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainerinvoices/${trainerInvoiceId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const trainerInvoiceCount = await TrainerInvoice.countDocuments({ _id: trainerInvoiceId });
      expect(trainerInvoiceCount).toBe(0);

      const updatedSlotsCount = await CourseSlot.countDocuments({
        _id: courseSlotsList[2]._id,
        'trainerBills.trainerInvoice': trainerInvoiceId,
      });
      expect(updatedSlotsCount).toBe(0);
    });

    it('should return 409 if trainer invoice is already paid', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainerinvoices/${paidTrainerInvoiceId}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if trainer invoice does not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainerinvoices/${new ObjectId()}`,
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
      { name: 'coach', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'DELETE',
          url: `/trainerinvoices/${trainerInvoiceId}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
