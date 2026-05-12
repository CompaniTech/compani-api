const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Course = require('../../../src/models/Course');
const TrainingContract = require('../../../src/models/TrainingContract');
const trainingContractsHelper = require('../../../src/helpers/trainingContracts');
const SinonMongoose = require('../sinonMongoose');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const { VENDOR_ADMIN, COACH, HOLDING_ADMIN } = require('../../../src/helpers/constants');

describe('create', () => {
  let uploadCourseFile;
  let courseFindOne;
  let create;

  beforeEach(() => {
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    create = sinon.stub(TrainingContract, 'create');
    courseFindOne = sinon.stub(Course, 'findOne');
  });

  afterEach(() => {
    uploadCourseFile.restore();
    create.restore();
    courseFindOne.restore();
  });

  it('should create a training contract for INTRA course', async () => {
    const courseId = new ObjectId();
    const companyId = new ObjectId();
    const course = {
      _id: courseId,
      companies: [{ _id: companyId, name: 'Alenvi' }],
      tradeName: 'program',
    };
    const payload = { course: courseId, company: companyId, file: 'test.pdf' };

    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    await trainingContractsHelper.create(payload);

    sinon.assert.calledOnceWithExactly(uploadCourseFile, { fileName: 'convention_program_Alenvi', file: 'test.pdf' });
    sinon.assert.calledOnceWithExactly(
      create,
      { course: courseId, company: companyId, file: { publicId: 'yo', link: 'yo' } }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }, { companies: 1, tradeName: 1 }] },
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
    };
    const payload = { course: courseId, company: companyId, file: 'test.pdf' };

    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    await trainingContractsHelper.create(payload);

    sinon.assert.calledOnceWithExactly(uploadCourseFile, { fileName: 'convention_program_Alenvi', file: 'test.pdf' });
    sinon.assert.calledOnceWithExactly(
      create,
      { course: courseId, company: companyId, file: { publicId: 'yo', link: 'yo' } }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }, { companies: 1, tradeName: 1 }] },
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
  let deleteCourseFile;
  beforeEach(() => {
    find = sinon.stub(TrainingContract, 'find');
    deleteMany = sinon.stub(TrainingContract, 'deleteMany');
    deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
  });
  afterEach(() => {
    find.restore();
    deleteMany.restore();
    deleteCourseFile.restore();
  });

  it('should remove training contracts', async () => {
    const trainingContracts = [
      { _id: new ObjectId(), file: { publicId: 'yo' } },
      { _id: new ObjectId(), file: { publicId: 'ya' } },
    ];

    find.returns(SinonMongoose.stubChainedQueries(trainingContracts, ['lean']));

    await trainingContractsHelper.deleteMany(trainingContracts.map(tc => tc._id));

    sinon.assert.calledWithExactly(deleteCourseFile.getCall(0), 'yo');
    sinon.assert.calledWithExactly(deleteCourseFile.getCall(1), 'ya');
    sinon.assert.calledOnceWithExactly(deleteMany, { _id: { $in: trainingContracts.map(tc => tc._id) } });
    SinonMongoose.calledOnceWithExactly(
      find,
      [{ query: 'find', args: [{ _id: { $in: trainingContracts.map(tc => tc._id) } }] }, { query: 'lean' }]
    );
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
