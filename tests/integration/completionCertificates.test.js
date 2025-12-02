const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const GCloudStorageHelper = require('../../src/helpers/gCloudStorage');
const app = require('../../server');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { populateDB, courseList, completionCertificateList } = require('./seed/completionCertificatesSeed');
const { auxiliary, noRole } = require('../seed/authUsersSeed');
const { GENERATION } = require('../../src/helpers/constants');
const CompletionCertificate = require('../../src/models/CompletionCertificate');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../seed/authCompaniesSeed');
const { holdingAdminFromOtherCompany } = require('../seed/authUsersSeed');

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
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(2);
    });

    it('should get completion certificates for a specific course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?course=${courseList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(3);
    });

    it('should return 403 if logged user has no client role and companies is in query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?months=12-2024&companies=${authCompany._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if month has wrong format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/completioncertificates?months=12_2024',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if neither months nor course are defined', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/completioncertificates',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if both months and course are defined', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?months=02-2025&course=${courseList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?course=${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get completion certificates for specific companies (with month)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?months=12-2024&companies=${authCompany._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(1);
    });

    it('should get completion certificates for specific companies (with course)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?course=${courseList[1]._id}&companies=${authCompany._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(2);
    });

    it('should return 403 if user\'s companies is not companies defined in query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?months=12-2024&companies=${otherCompany._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should get completion certificates for holding companies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?months=12-2024&companies=${otherCompany._id}`
          + `&companies=${companyWithoutSubscription._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.completionCertificates.length).toBe(2);
    });

    it('should return 403 if companies is not in holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/completioncertificates?months=12-2024&companies=${authCompany._id}`
          + `&companies=${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/completioncertificates?months=02-2025',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if file already exists', async () => {
      const payload = { action: GENERATION };
      const response = await app.inject({
        method: 'PUT',
        url: `/completioncertificates/${completionCertificateList[4]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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

    it('should create completion certificates if trainee has activity history on month', async () => {
      const payload = { trainee: auxiliary._id, course: courseList[1]._id, month: '03-2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const completionCertificateCreated = await CompletionCertificate.countDocuments(payload);
      expect(completionCertificateCreated).toEqual(1);
    });

    it('should create completion certificates if trainee has attendance on month', async () => {
      const payload = { trainee: noRole._id, course: courseList[0]._id, month: '04-2024' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if trainee is not in course', async () => {
      const payload = { trainee: new ObjectId(), course: courseList[1]._id, month: '01-2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if there is no slot nor activity history for trainee', async () => {
      const payload = { trainee: auxiliary._id, course: courseList[1]._id, month: '11-2024' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if completion certificates already exist for course, trainee and month', async () => {
      const payload = { trainee: auxiliary._id, course: courseList[1]._id, month: '02-2025' };

      const response = await app.inject({
        method: 'POST',
        url: '/completioncertificates',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });
  });
});

describe('COMPLETION CERTIFICATES ROUTES - DELETE /completioncertificates/{_id}/file', () => {
  let authToken;
  let deleteCourseFile;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
      deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
    });
    afterEach(() => {
      deleteCourseFile.restore();
    });

    it('should delete completion certificate (with file)', async () => {
      const completionCertificateId = completionCertificateList[4]._id;
      const completionCertificatesCountBefore = await CompletionCertificate
        .countDocuments({ _id: completionCertificateId, file: { $exists: true } });
      expect(completionCertificatesCountBefore).toEqual(1);

      const response = await app.inject({
        method: 'DELETE',
        url: `/completioncertificates/${completionCertificateId}/file`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const completionCertificatesCountAfter = await CompletionCertificate
        .countDocuments({ _id: completionCertificateId, file: { $exists: true } });
      expect(completionCertificatesCountAfter).toEqual(0);
      sinon.assert.calledOnce(deleteCourseFile);
    });

    it('should return 404 if completion certificate does not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/completioncertificates/${new ObjectId()}/file`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/completioncertificates/${completionCertificateList[5]._id}/file`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if completion certificate has no file', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/completioncertificates/${completionCertificateList[0]._id}/file`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [{ name: 'trainer', expectedCode: 403 }, { name: 'client_admin', expectedCode: 403 }];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/completioncertificates/${completionCertificateList[4]._id}/file`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });
        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
