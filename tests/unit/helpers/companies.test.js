const sinon = require('sinon');
const flat = require('flat');
const expect = require('expect');
const { ObjectID } = require('mongodb');
const Company = require('../../../src/models/Company');
const Event = require('../../../src/models/Event');
const CompanyHelper = require('../../../src/helpers/companies');
const GDriveStorageHelper = require('../../../src/helpers/gDriveStorage');
const Drive = require('../../../src/models/Google/Drive');
const { INTERVENTION } = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('createCompany', () => {
  let find;
  let createCompany;
  let createFolderForCompanyStub;
  let createFolderStub;
  beforeEach(() => {
    find = sinon.stub(Company, 'find');
    createCompany = sinon.stub(Company, 'create');
    createFolderForCompanyStub = sinon.stub(GDriveStorageHelper, 'createFolderForCompany');
    createFolderStub = sinon.stub(GDriveStorageHelper, 'createFolder');
  });
  afterEach(() => {
    find.restore();
    createCompany.restore();
    createFolderForCompanyStub.restore();
    createFolderStub.restore();
  });

  it('should create a company', async () => {
    const payload = { name: 'Test SAS', tradeName: 'Test' };
    const createdCompany = {
      ...payload,
      folderId: '1234567890',
      directDebitsFolderId: '0987654321',
      customersFolderId: 'qwertyuiop',
      auxiliariesFolderId: 'asdfghj',
    };
    createFolderForCompanyStub.returns({ id: '1234567890' });
    createFolderStub.onCall(0).returns({ id: '0987654321' });
    createFolderStub.onCall(1).returns({ id: 'qwertyuiop' });
    createFolderStub.onCall(2).returns({ id: 'asdfghj' });
    find.returns(SinonMongoose.stubChainedQueries(
      [[{ _id: new ObjectID(), prefixNumber: 345 }]],
      ['sort', 'limit', 'lean']
    ));

    await CompanyHelper.createCompany(payload);

    sinon.assert.calledOnceWithExactly(createFolderForCompanyStub, payload.name);
    sinon.assert.calledWithExactly(createFolderStub.getCall(0), 'direct debits', '1234567890');
    sinon.assert.calledWithExactly(createFolderStub.getCall(1), 'customers', '1234567890');
    sinon.assert.calledWithExactly(createFolderStub.getCall(2), 'auxiliaries', '1234567890');
    sinon.assert.calledOnceWithExactly(createCompany, { ...createdCompany, prefixNumber: 346 });
    SinonMongoose.calledWithExactly(
      find,
      [
        { query: 'find' },
        { query: 'sort', args: [{ prefixNumber: -1 }] },
        { query: 'limit', args: [1] },
        { query: 'lean' },
      ]
    );
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(Company, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return companies', async () => {
    const companyList = [{ _id: new ObjectID(), name: 'Alenvi' }];
    find.returns(SinonMongoose.stubChainedQueries([companyList], ['lean']));

    const result = await CompanyHelper.list();

    expect(result).toEqual(companyList);
    SinonMongoose.calledWithExactly(
      find,
      [{ query: 'find', args: [{}, { _id: 1, name: 1 }] }, { query: 'lean', args: [] }]
    );
  });
});

describe('getCompany', () => {
  let findOne;
  beforeEach(() => {
    findOne = sinon.stub(Company, 'findOne');
  });
  afterEach(() => {
    findOne.restore();
  });

  it('should return company', async () => {
    const company = { _id: new ObjectID() };
    findOne.returns(SinonMongoose.stubChainedQueries([company], ['lean']));

    const result = await CompanyHelper.getCompany(company._id);

    expect(result).toEqual(company);
    SinonMongoose.calledWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: company._id }] }, { query: 'lean', args: [] }]
    );
  });
});

describe('uploadFile', () => {
  let findOneAndUpdate;
  let addStub;
  let getFileByIdStub;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(Company, 'findOneAndUpdate');
    addStub = sinon.stub(Drive, 'add');
    getFileByIdStub = sinon.stub(Drive, 'getFileById');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
    addStub.restore();
    getFileByIdStub.restore();
  });

  it('should upload a file', async () => {
    const payload = { fileName: 'mandat_signe', file: 'true', type: 'contract' };
    const params = { _id: new ObjectID(), driveId: new ObjectID() };
    const uploadedFile = { id: new ObjectID() };
    const driveFileInfo = { webViewLink: 'test' };
    addStub.returns(uploadedFile);
    getFileByIdStub.returns(driveFileInfo);
    const companyPayload = {
      rhConfig: {
        templates: {
          contract: { driveId: uploadedFile.id, link: driveFileInfo.webViewLink },
        },
      },
    };
    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries([], ['lean']));

    await CompanyHelper.uploadFile(payload, params);
    sinon.assert.calledWithExactly(addStub, {
      body: 'true',
      folder: false,
      name: payload.fileName,
      parentFolderId: params.driveId,
      type: undefined,
    });
    sinon.assert.calledWithExactly(getFileByIdStub, { fileId: uploadedFile.id });
    SinonMongoose.calledWithExactly(
      findOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: params._id }, { $set: flat(companyPayload) }, { new: true }] },
        { query: 'lean', args: [] },
      ]
    );
  });
});

describe('getFirstIntervention', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(Event, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should get first intervention', async () => {
    const credentials = { company: { _id: new ObjectID() } };
    find.returns(SinonMongoose.stubChainedQueries([[{ startDate: '2019-11-12' }]], ['sort', 'limit', 'lean']));

    const result = await CompanyHelper.getFirstIntervention(credentials);

    expect(result).toBeDefined();
    expect(result).toEqual([{ startDate: '2019-11-12' }]);
    SinonMongoose.calledWithExactly(
      find,
      [
        { query: 'find', args: [{ company: credentials.company._id, type: INTERVENTION }] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'limit', args: [1] },
        { query: 'lean', args: [] },
      ]
    );
  });
});

describe('updateCompany', () => {
  let findOneAndUpdate;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(Company, 'findOneAndUpdate');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
  });

  it('should update transport sub', async () => {
    const companyId = new ObjectID();
    const subId = new ObjectID();
    const payload = {
      rhConfig: { transportSubs: { subId } },
    };
    findOneAndUpdate.returns({ _id: companyId });

    const result = await CompanyHelper.updateCompany(companyId, payload);

    expect(result).toEqual({ _id: companyId });
    sinon.assert.calledWithExactly(
      findOneAndUpdate,
      { _id: companyId, 'rhConfig.transportSubs._id': subId },
      { $set: flat({ 'rhConfig.transportSubs.$': { subId } }) },
      { new: true }
    );
  });
  it('should update company', async () => {
    const companyId = new ObjectID();
    const payload = { tradeName: 'toto' };
    findOneAndUpdate.returns({ _id: companyId });

    const result = await CompanyHelper.updateCompany(companyId, payload);

    expect(result).toEqual({ _id: companyId });
    sinon.assert.calledWithExactly(
      findOneAndUpdate,
      { _id: companyId },
      { $set: flat({ tradeName: 'toto' }) },
      { new: true }
    );
  });
});
