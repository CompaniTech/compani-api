const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const TrainingContract = require('../../src/models/TrainingContract');
const Drive = require('../../src/models/Google/Drive');
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
const GDriveStorageHelper = require('../../src/helpers/gDriveStorage');
const { holdingAdminFromOtherCompany } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('TRAINING CONTRACTS ROUTES - POST /trainingcontracts', () => {
  let authToken;
  let gcsUploadCourseFileStub;
  let driveGetUploadFolderId;
  let driveAddFile;
  let driveGetFileById;

  beforeEach(async () => {
    await populateDB();
    gcsUploadCourseFileStub = sinon.stub(GCloudStorageHelper, 'uploadCourseFile')
      .returns({ publicId: '123', link: 'ceciestunlien' });
    driveGetUploadFolderId = sinon.stub(GDriveStorageHelper, 'getUploadFolderId').returns('upload_folder_id');
    driveAddFile = sinon.stub(GDriveStorageHelper, 'addFile').returns({ id: 'drive_file_id2' });
    driveGetFileById = sinon.stub(Drive, 'getFileById').returns({ webViewLink: 'https://drive.google.com/file2' });
  });
  afterEach(() => {
    gcsUploadCourseFileStub.restore();
    driveGetUploadFolderId.restore();
    driveAddFile.restore();
    driveGetFileById.restore();
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should upload training contract (intra)', async () => {
      const formData = {
        course: courseList[0]._id.toHexString(),
        company: authCompany._id.toHexString(),
        file: 'test',
      };
      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/trainingcontracts',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(200);
      const trainingContract = await TrainingContract.countDocuments({
        course: courseList[0]._id,
        company: authCompany._id,
        file: { publicId: '123', link: 'ceciestunlien' },
      });
      expect(trainingContract).toBe(1);
      sinon.assert.calledOnce(gcsUploadCourseFileStub);
      sinon.assert.notCalled(driveGetUploadFolderId);
      sinon.assert.notCalled(driveAddFile);
      sinon.assert.notCalled(driveGetFileById);
    });

    it('should upload 2nd training contract (single)', async () => {
      const formData = {
        course: courseList[5]._id.toHexString(),
        company: authCompany._id.toHexString(),
        file: 'test',
      };
      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/trainingcontracts',
        headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: getStream(form),
      });

      expect(response.statusCode).toBe(200);
      const trainingContract = await TrainingContract.countDocuments({
        course: courseList[5]._id,
        company: authCompany._id,
        file: { publicId: 'drive_file_id2', link: 'https://drive.google.com/file2' },
      });
      expect(trainingContract).toBe(1);
      sinon.assert.calledOnce(driveAddFile);
      sinon.assert.calledOnce(driveGetFileById);
      sinon.assert.calledOnce(driveGetUploadFolderId);
      sinon.assert.notCalled(gcsUploadCourseFileStub);
    });

    it('should return 404 if course with company not found', async () => {
      const formData = {
        course: courseList[0]._id.toHexString(),
        company: otherCompany._id.toHexString(),
        file: 'test',
      };
      const form = generateFormData(formData);

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
  let gcsDeleteCourseFile;
  let driveDeleteFile;

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
      gcsDeleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
      driveDeleteFile = sinon.stub(GDriveStorageHelper, 'deleteFile');
    });
    afterEach(() => {
      gcsDeleteCourseFile.restore();
      driveDeleteFile.restore();
    });

    it('should delete a training contract (intra)', async () => {
      const trainingContractsLength = await TrainingContract.countDocuments();
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainingcontracts/${trainingContractList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(await TrainingContract.countDocuments()).toEqual(trainingContractsLength - 1);
      sinon.assert.calledOnce(gcsDeleteCourseFile);
      sinon.assert.notCalled(driveDeleteFile);
    });

    it('should delete a training contract (single)', async () => {
      const trainingContractsLength = await TrainingContract.countDocuments();
      const response = await app.inject({
        method: 'DELETE',
        url: `/trainingcontracts/${trainingContractList[2]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(await TrainingContract.countDocuments()).toEqual(trainingContractsLength - 1);
      sinon.assert.calledOnce(driveDeleteFile);
      sinon.assert.notCalled(gcsDeleteCourseFile);
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
      gcsDeleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
      driveDeleteFile = sinon.stub(GDriveStorageHelper, 'deleteFile');
    });
    afterEach(() => {
      gcsDeleteCourseFile.restore();
      driveDeleteFile.restore();
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
