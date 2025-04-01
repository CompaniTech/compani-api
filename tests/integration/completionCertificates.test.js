const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const GCloudStorageHelper = require('../../src/helpers/gCloudStorage');
const app = require('../../server');
const { getToken } = require('./helpers/authentication');
const { populateDB, courseList, completionCertificateList } = require('./seed/completionCertificatesSeed');
const { auxiliary } = require('../seed/authUsersSeed');
const { GENERATION } = require('../../src/helpers/constants');
const CompletionCertificate = require('../../src/models/CompletionCertificate');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COMPLETION CERTIFICATES ROUTES - GET /completioncertificates', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get completion certificates for specified months', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/completioncertificates?months=02-2025',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(2);
    });

    it('should get completion certificates for a specific course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?course=${courseList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(3);
    });

    it('should return 400 if month has wrong format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/completioncertificates?months=12_2024',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if neither months nor course are defined', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/completioncertificates',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if both months and course are defined', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?months=02-2025&course=${courseList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?course=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'trainer', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/completioncertificates?months=02-2025',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COMPLETION CERTIFICATES ROUTES - PUT /completioncertificates/{_id}', () => {
  let authToken;
  let uploadCourseFile;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
      uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    });
    afterEach(() => {
      uploadCourseFile.restore();
    });

    it('should generate completion certificates file', async () => {
      const completionCertificateId = completionCertificateList[0]._id;
      const payload = { action: GENERATION };
      uploadCourseFile.returns({ publicId: '1234', link: 'https://test.com/completionCertificate.pdf' });

      const response = await app.inject({
        method: 'PUT',
        url: `/completioncertificates/${completionCertificateId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const completionCertificateUpdated = await CompletionCertificate
        .countDocuments({ _id: completionCertificateId, file: { $exists: true } });
      expect(completionCertificateUpdated).toEqual(1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should return 404 if completion certificate does not exist', async () => {
      const payload = { action: GENERATION };
      const response = await app.inject({
        method: 'PUT',
        url: `/completioncertificates/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if file already exists', async () => {
      const payload = { action: GENERATION };
      const response = await app.inject({
        method: 'PUT',
        url: `/completioncertificates/${completionCertificateList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'trainer', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/completioncertificates/${completionCertificateList[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COMPLETION CERTIFICATES ROUTES - POST /completioncertificates', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create completion certificates', async () => {
      const payload = { trainee: auxiliary._id, course: courseList[1]._id, month: '03-2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const completionCertificateCreated = await CompletionCertificate.countDocuments(payload);
      expect(completionCertificateCreated).toEqual(1);
    });

    it('should return 404 if course do not exist', async () => {
      const payload = { trainee: auxiliary._id, course: new ObjectId(), month: '01-2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if trainee is not in course', async () => {
      const payload = { trainee: new ObjectId(), course: courseList[1]._id, month: '01-2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if there is not slot and activity history for trainee', async () => {
      const payload = { trainee: auxiliary._id, course: courseList[1]._id, month: '12-2024' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if completion certificates already exist for course, trainee and month', async () => {
      const payload = { trainee: auxiliary._id, course: courseList[1]._id, month: '02-2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });
  });
});
