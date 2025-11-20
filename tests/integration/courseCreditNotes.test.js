const { expect } = require('expect');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const { courseBillsList, courseCreditNote, populateDB } = require('./seed/courseCreditNotesSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const CourseCreditNote = require('../../src/models/CourseCreditNote');
const CourseCourseCreditNoteNumber = require('../../src/models/CourseCreditNoteNumber');
const { holdingAdminFromOtherCompany } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COURSE CREDIT NOTES ROUTES - POST /coursecreditnotes', () => {
  let authToken;
  beforeEach(populateDB);
  const payload = {
    date: '2022-04-07T00:00:00.000Z',
    courseBill: courseBillsList[0]._id,
    misc: 'un commentaire',
  };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a credit note', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursecreditnotes',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const newCreditNote = await CourseCreditNote.countDocuments({ ...payload, number: 'AV-00005' });
      const newCreditNoteNumber = await CourseCourseCreditNoteNumber.findOne({}).lean();
      expect(newCreditNote).toBeTruthy();
      expect(newCreditNoteNumber.seq).toBe(5);
    });

    it('should create a credit note without misc', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursecreditnotes',
        payload: omit(payload, 'misc'),
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    const missingParams = ['date', 'courseBill'];
    missingParams.forEach((param) => {
      it(`should return a 400 error if '${param}' param is missing`, async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/coursecreditnotes',
          payload: omit(payload, [param]),
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });
        expect(res.statusCode).toBe(400);
      });
    });

    it('should return a 404 if course bill doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursecreditnotes',
        payload: { ...payload, courseBill: new ObjectId() },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if course bill is not validated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursecreditnotes',
        payload: { ...payload, courseBill: courseBillsList[1]._id },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if course bill is already cancelled by credit note', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursecreditnotes',
        payload: { ...payload, courseBill: courseBillsList[2]._id },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if credit note date is before course bill validation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/coursecreditnotes',
        payload: { ...payload, date: '2022-04-06T00:00:00.000Z' },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
        authToken = await getToken(role.name, role.erp);
        const response = await app.inject({
          method: 'POST',
          url: '/coursecreditnotes',
          payload,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE CREDIT NOTES ROUTES - GET /coursecreditnotes/{_id}/pdfs', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should download course creditNote for intra course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursecreditnotes/${courseCreditNote[0]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if credit note doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursecreditnotes/${new ObjectId()}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should download own course creditNote for intra course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursecreditnotes/${courseCreditNote[0]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should download course creditNote for intra course as payer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursecreditnotes/${courseCreditNote[1]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if wrong credit note', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursecreditnotes/${courseCreditNote[2]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should download course creditNote from holding for intra course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursecreditnotes/${courseCreditNote[2]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should download course creditNote for intra course as payer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursecreditnotes/${courseCreditNote[3]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if wrong credit note', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/coursecreditnotes/${courseCreditNote[0]._id}/pdfs`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
          url: `/coursecreditnotes/${courseCreditNote[0]._id}/pdfs`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
