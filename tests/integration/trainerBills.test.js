const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const app = require('../../server');
const TrainerBill = require('../../src/models/TrainerBill');
const TrainerPayment = require('../../src/models/TrainerPayment');
const CourseSlot = require('../../src/models/CourseSlot');
const GCloudStorageHelper = require('../../src/helpers/gCloudStorage');
const { trainer, trainerAndCoach } = require('../seed/authUsersSeed');
const { populateDB, courseSlotsList } = require('./seed/trainerBillsSeed');
const { PENDING } = require('../../src/helpers/constants');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { generateFormData, getStream } = require('./utils');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('TRAINER BILLS ROUTES - POST /trainerbills', () => {
  let authToken;
  let uploadCourseFile;

  beforeEach(async () => {
    await populateDB();
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile')
      .returns({ link: 'link', publicId: 'publicId' });
  });

  afterEach(() => {
    uploadCourseFile.restore();
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should create a trainer bill and link it to the course slots', async () => {
      const form = generateFormData({ number: 'FACT_0002', file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());
      form.append('courseSlots', courseSlotsList[1]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerbills',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(200);

      const trainerBill = await TrainerBill.findOne({
        trainer: trainer._id,
        number: 'FACT_0002',
        file: { link: 'link', publicId: 'publicId' },
        courseSlots: [courseSlotsList[0]._id, courseSlotsList[1]._id],
      })
        .lean();
      expect(trainerBill).toBeDefined();
      sinon.assert.calledOnce(uploadCourseFile);

      const trainerPaymentCount = await TrainerPayment.countDocuments({
        trainerBill: trainerBill._id,
        status: PENDING,
        number: 'REG-00001',
      });
      expect(trainerPaymentCount).toBe(1);

      const updatedSlotsCount = await CourseSlot.countDocuments({
        _id: { $in: [courseSlotsList[0]._id, courseSlotsList[1]._id] },
        'trainerBillings.trainer': trainer._id,
      });
      expect(updatedSlotsCount).toBe(2);
    });

    it('should accept a single course slot id (not wrapped in an array)', async () => {
      const form = generateFormData({ number: 'FACT_0003', file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerbills',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(200);
      const trainerBillCount = await TrainerBill
        .countDocuments({ trainer: trainer._id, number: 'FACT_0003' });
      expect(trainerBillCount).toBe(1);
    });

    it('should return 400 if number is missing', async () => {
      const form = generateFormData({ file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerbills',
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
        url: '/trainerbills',
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
        url: '/trainerbills',
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
        url: '/trainerbills',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if a course slot is already billed', async () => {
      const form = generateFormData({ number: 'FACT_0007', file: 'test' });
      form.append('courseSlots', courseSlotsList[2]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerbills',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if bill number is already used by this trainer', async () => {
      const form = generateFormData({ number: 'FACT_0001', file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerbills',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('Other trainer', () => {
    it('should return 404 if trying to bill someone else\'s course slots', async () => {
      authToken = await getTokenByCredentials(trainerAndCoach.local);

      const form = generateFormData({ number: 'FACT_0008', file: 'test' });
      form.append('courseSlots', courseSlotsList[0]._id.toHexString());

      const response = await app.inject({
        method: 'POST',
        url: '/trainerbills',
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
          url: '/trainerbills',
          headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: getStream(form),
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
