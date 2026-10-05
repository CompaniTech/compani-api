const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Course = require('../../../src/models/Course');
const TrainingContract = require('../../../src/models/TrainingContract');
const Drive = require('../../../src/models/Google/Drive');
const trainingContractsHelper = require('../../../src/helpers/trainingContracts');
const SinonMongoose = require('../sinonMongoose');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const GDriveStorageHelper = require('../../../src/helpers/gDriveStorage');
const { VENDOR_ADMIN, COACH, HOLDING_ADMIN, SINGLE, INTRA } = require('../../../src/helpers/constants');

describe('create', () => {
  let gcsUploadCourseFile;
  let courseFindOne;
  let create;
  let driveGetUploadFolderId;
  let driveAddFile;
  let driveGetFileById;

  beforeEach(() => {
    gcsUploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    create = sinon.stub(TrainingContract, 'create');
    courseFindOne = sinon.stub(Course, 'findOne');
    driveGetUploadFolderId = sinon.stub(GDriveStorageHelper, 'getUploadFolderId');
    driveAddFile = sinon.stub(GDriveStorageHelper, 'addFile');
    driveGetFileById = sinon.stub(Drive, 'getFileById');
  });

  afterEach(() => {
    gcsUploadCourseFile.restore();
    create.restore();
    courseFindOne.restore();
    driveGetUploadFolderId.restore();
    driveAddFile.restore();
    driveGetFileById.restore();
  });

  it('should create a training contract for INTRA course', async () => {
    const courseId = new ObjectId();
    const companyId = new ObjectId();
    const course = {
      _id: courseId,
      companies: [{ _id: companyId, name: 'Alenvi' }],
      tradeName: 'program',
      type: INTRA,
    };
    const payload = { course: courseId, company: companyId, file: 'test.pdf' };

    gcsUploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    await trainingContractsHelper.create(payload);

    sinon.assert.notCalled(driveGetUploadFolderId);
    sinon.assert.notCalled(driveAddFile);
    sinon.assert.notCalled(driveGetFileById);
    sinon.assert.calledOnceWithExactly(
      gcsUploadCourseFile,
      { fileName: 'convention_program_Alenvi', file: 'test.pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      { course: courseId, company: companyId, file: { publicId: 'yo', link: 'yo' } }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }, { companies: 1, tradeName: 1, type: 1, folderId: 1 }] },
        {
          query: 'populate',
          args: [[
            { path: 'companies', select: 'name' },
          ]],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should create a training contract for INTER/INTRA_HOLDING course', async () => {
    const courseId = new ObjectId();
    const companyId = new ObjectId();
    const course = {
      _id: courseId,
      companies: [{ _id: new ObjectId(), name: 'Alenvi Fontainebleau' }, { _id: companyId, name: 'Alenvi' }],
      tradeName: 'program',
      type: INTRA,
    };
    const payload = { course: courseId, company: companyId, file: 'test.pdf' };

    gcsUploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    await trainingContractsHelper.create(payload);

    sinon.assert.notCalled(driveGetUploadFolderId);
    sinon.assert.notCalled(driveAddFile);
    sinon.assert.notCalled(driveGetFileById);
    sinon.assert.calledOnceWithExactly(
      gcsUploadCourseFile,
      { fileName: 'convention_program_Alenvi', file: 'test.pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      { course: courseId, company: companyId, file: { publicId: 'yo', link: 'yo' } }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }, { companies: 1, tradeName: 1, type: 1, folderId: 1 }] },
        {
          query: 'populate',
          args: [[
            { path: 'companies', select: 'name' },
          ]],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should upload training contract to drive folder for SINGLE course with folderId', async () => {
    const courseId = new ObjectId();
    const companyId = new ObjectId();
    const course = {
      _id: courseId,
      companies: [{ _id: companyId, name: 'Alenvi' }],
      tradeName: 'program',
      type: SINGLE,
      folderId: 'folder_id',
    };
    const payload = { course: courseId, company: companyId, file: 'test.pdf' };

    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));
    driveGetUploadFolderId.returns('admin_folder_id');
    driveAddFile.returns({ id: 'drive_file_id' });
    driveGetFileById.returns({ webViewLink: 'https://drive.google.com/file' });

    await trainingContractsHelper.create(payload);

    sinon.assert.notCalled(gcsUploadCourseFile);
    sinon.assert.calledOnceWithExactly(driveGetUploadFolderId, 'folder_id');
    sinon.assert.calledOnceWithExactly(
      driveAddFile,
      {
        parentFolderId: 'admin_folder_id',
        name: 'convention_program_Alenvi',
        type: 'application/pdf',
        body: 'test.pdf',
      }
    );
    sinon.assert.calledOnceWithExactly(driveGetFileById, { fileId: 'drive_file_id' });
    sinon.assert.calledOnceWithExactly(
      create,
      {
        course: courseId,
        company: companyId,
        file: { publicId: 'drive_file_id', link: 'https://drive.google.com/file' },
      }
    );
  });

  it('should upload training contract with gcloud for SINGLE course without folderId', async () => {
    const courseId = new ObjectId();
    const companyId = new ObjectId();
    const course = {
      _id: courseId,
      companies: [{ _id: companyId, name: 'Alenvi' }],
      tradeName: 'program',
      type: SINGLE,
    };
    const payload = { course: courseId, company: companyId, file: 'test.pdf' };

    gcsUploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    await trainingContractsHelper.create(payload);

    sinon.assert.notCalled(driveGetUploadFolderId);
    sinon.assert.notCalled(driveAddFile);
    sinon.assert.notCalled(driveGetFileById);
    sinon.assert.calledOnceWithExactly(
      gcsUploadCourseFile,
      { fileName: 'convention_program_Alenvi', file: 'test.pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      { course: courseId, company: companyId, file: { publicId: 'yo', link: 'yo' } }
    );
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(TrainingContract, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return course training contracts as vendor role', async () => {
    const credentials = { role: { vendor: { name: VENDOR_ADMIN } } };
    const courseId = new ObjectId();
    const trainingContracts = [{
      course: courseId,
      file: { publicId: 'mon premier upload', link: 'www.test.com' },
      company: new ObjectId(),
    }];

    find.returns(SinonMongoose.stubChainedQueries(trainingContracts, ['setOptions', 'lean']));

    const result = await trainingContractsHelper.list({ course: courseId }, credentials);

    expect(result).toMatchObject(trainingContracts);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return course training contracts as client user with company', async () => {
    const authCompanyId = new ObjectId();
    const credentials = { company: { _id: authCompanyId }, role: { client: { name: COACH } } };

    const courseId = new ObjectId();
    const trainingContracts = [
      {
        course: courseId,
        file: { publicId: 'mon upload avec un trainne de authCompany', link: 'www.test.com' },
        company: authCompanyId,
      },
      {
        course: courseId,
        file: { publicId: 'mon upload avec un trainne de otherCompany', link: 'www.test.com' },
        company: new ObjectId(),
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(trainingContracts, ['setOptions', 'lean']));

    const result = await trainingContractsHelper.list({ course: courseId, company: authCompanyId }, credentials);

    expect(result).toMatchObject(trainingContracts);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId, company: { $in: [authCompanyId] } }] },
        { query: 'setOptions', args: [{ isVendorUser: false }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return course training contracts as holding user', async () => {
    const authCompanyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const holdingId = new ObjectId();
    const credentials = {
      holding: { _id: holdingId, companies: [authCompanyId, otherCompanyId] },
      role: { holding: { name: HOLDING_ADMIN } },
    };

    const courseId = new ObjectId();
    const trainingContracts = [
      {
        course: courseId,
        file: { publicId: 'mon upload avec un trainne de authCompany', link: 'www.test.com' },
        company: authCompanyId,
      },
      {
        course: courseId,
        file: { publicId: 'mon upload avec un trainne de otherCompany', link: 'www.test.com' },
        company: new ObjectId(),
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(trainingContracts, ['setOptions', 'lean']));

    const result = await trainingContractsHelper.list({ course: courseId, holding: holdingId }, credentials);

    expect(result).toMatchObject(trainingContracts);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId, company: { $in: [authCompanyId, otherCompanyId] } }] },
        { query: 'setOptions', args: [{ isVendorUser: false }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('deleteMany', () => {
  let find;
  let deleteMany;
  let gcsDeleteCourseFile;
  let driveDeleteFile;
  beforeEach(() => {
    find = sinon.stub(TrainingContract, 'find');
    deleteMany = sinon.stub(TrainingContract, 'deleteMany');
    gcsDeleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
    driveDeleteFile = sinon.stub(GDriveStorageHelper, 'deleteFile');
  });
  afterEach(() => {
    find.restore();
    deleteMany.restore();
    gcsDeleteCourseFile.restore();
    driveDeleteFile.restore();
  });

  it('should remove training contracts stored on gcloud', async () => {
    const trainingContracts = [
      { _id: new ObjectId(), file: { publicId: 'yo', link: 'https://storage.googleapis.com/yo' } },
      { _id: new ObjectId(), file: { publicId: 'ya', link: 'https://storage.googleapis.com/ya' } },
    ];

    find.returns(SinonMongoose.stubChainedQueries(trainingContracts, ['lean']));

    await trainingContractsHelper.deleteMany(trainingContracts.map(tc => tc._id));

    sinon.assert.calledWithExactly(gcsDeleteCourseFile.getCall(0), 'yo');
    sinon.assert.calledWithExactly(gcsDeleteCourseFile.getCall(1), 'ya');
    sinon.assert.notCalled(driveDeleteFile);
    sinon.assert.calledOnceWithExactly(deleteMany, { _id: { $in: trainingContracts.map(tc => tc._id) } });
    SinonMongoose.calledOnceWithExactly(
      find,
      [{ query: 'find', args: [{ _id: { $in: trainingContracts.map(tc => tc._id) } }] }, { query: 'lean' }]
    );
  });

  it('should remove training contract stored on drive', async () => {
    const trainingContracts = [
      { _id: new ObjectId(), file: { publicId: 'drive_id', link: 'https://drive.google.com/file' } },
    ];

    find.returns(SinonMongoose.stubChainedQueries(trainingContracts, ['lean']));

    await trainingContractsHelper.deleteMany(trainingContracts.map(tc => tc._id));

    sinon.assert.notCalled(gcsDeleteCourseFile);
    sinon.assert.calledOnceWithExactly(driveDeleteFile, 'drive_id');
    sinon.assert.calledOnceWithExactly(deleteMany, { _id: { $in: trainingContracts.map(tc => tc._id) } });
  });
});

describe('delete', () => {
  let deleteMany;
  beforeEach(() => {
    deleteMany = sinon.stub(trainingContractsHelper, 'deleteMany');
  });
  afterEach(() => {
    deleteMany.restore();
  });

  it('should remove a training contract', async () => {
    const trainingContractId = new ObjectId();

    await trainingContractsHelper.delete(trainingContractId);

    sinon.assert.calledOnceWithExactly(deleteMany, [trainingContractId]);
  });
});
