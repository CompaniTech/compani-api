const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const TrainingContract = require('../../src/models/TrainingContract');
const {
  authCompany,
  otherCompany,
  companyWithoutSubscription,
  otherHolding,
  authHolding,
} = require('../seed/authCompaniesSeed');
const { populateDB, courseList, trainingContractList } = require('./seed/trainingContractsSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { generateFormData, getStream } = require('./utils');
const GCloudStorageHelper = require('../../src/helpers/gCloudStorage');
const { holdingAdminFromOtherCompany } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('TRAINING CONTRACTS ROUTES - POST /trainingcontracts', () => {
  let authToken;
  let uploadCourseFileStub;

  beforeEach(async () => {
    await populateDB();
    uploadCourseFileStub = sinon.stub(GCloudStorageHelper, 'uploadCourseFile')
      .returns({ publicId: '123', link: 'ceciestunlien' });
  });
  afterEach(() => {
    uploadCourseFileStub.restore();
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should upload training contract', async () => {
      const formData = {
        course: courseList[0]._id.toHexString(),
        company: authCompany._id.toHexString(),
        file: 'test',
      };
      const form = generateFormData(formData);
      uploadCourseFileStub.returns({ publicId: '1234567890', link: 'ceciestunautrelien' });

      const response = await app.inject({
        method: 'POST',
        url: '/trainingcontracts',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(200);
      const contractTraing = await TrainingContract.countDocuments({
        course: courseList[0]._id,
        company: authCompany._id,
        file: { publicId: '1234567890', link: 'ceciestunautrelien' },
      });
      expect(contractTraing).toBe(1);
    });

    it('should return 404 if course with company not found', async () => {
      const formData = {
        course: courseList[0]._id.toHexString(),
        company: otherCompany._id.toHexString(),
        file: 'test',
      };
      const form = generateFormData(formData);
      uploadCourseFileStub.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/trainingcontracts',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if training contract already exists for course and company', async () => {
      const formData = {
        course: courseList[1]._id.toHexString(),
        company: authCompany._id.toHexString(),
        file: 'test',
      };
      const form = generateFormData(formData);
      uploadCourseFileStub.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/trainingcontracts',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message)
        .toBe('Une convention associée à cette formation existe déjà pour cette structure.');
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

        const formData = {
          course: courseList[0]._id.toHexString(),
          company: authCompany._id.toHexString(),
          file: 'test',
        };

        const form = generateFormData(formData);
        uploadCourseFileStub.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

        const response = await app.inject({
          method: 'POST',
          url: '/trainingcontracts',
          headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: getStream(form),
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('TRAINING CONTRACTS ROUTES - GET /trainingcontracts', () => {
  let authToken;

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get course\'s training contracts', async () => {
      const trainingContractsLength = await TrainingContract.countDocuments({ course: courseList[1]._id });

      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[1]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.trainingContracts.length).toEqual(trainingContractsLength);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('COACH', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get course\'s training contract if user is in company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[0]._id}&company=${authCompany._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if user company is not attached to course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[2]._id}&company=${authCompany._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if user is not attached to company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[2]._id}&company=${companyWithoutSubscription._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should get course\'s training contract if course company is in user holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[2]._id}&holding=${otherHolding._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should get course\'s training contract if course holding is user holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[4]._id}&holding=${otherHolding._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if course company is not in user holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[0]._id}&holding=${otherHolding._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if user is not attached to holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[0]._id}&holding=${authHolding._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if no vendor role and no holding or company query ', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[2]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if holding and company query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/trainingcontracts?course=${courseList[2]._id}&company=${otherCompany._id}&holding=${otherHolding._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);

    const roles = [
      { name: 'trainer', expectedCode: 403 },
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/trainingcontracts?course=${courseList[0]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('TRAINING CONTRACTS ROUTES - DELETE /trainingcontracts/{_id}', () => {
  let authToken;
  let deleteCourseFile;

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
      deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
    });
    afterEach(() => {
      deleteCourseFile.restore();
    });

    it('should delete a training contract', async () => {
      const trainingContractsLength = await TrainingContract.countDocuments();
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainingcontracts/${trainingContractList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(await TrainingContract.countDocuments()).toEqual(trainingContractsLength - 1);
      sinon.assert.calledOnce(deleteCourseFile);
    });

    it('should return 404 if training contract does not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainingcontracts/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainingcontracts/${trainingContractList[1]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
    });
    afterEach(() => {
      deleteCourseFile.restore();
    });

    const roles = [
      { name: 'client_admin', expectedCode: 403 },
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/trainingcontracts/${trainingContractList[0]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
