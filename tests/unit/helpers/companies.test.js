const sinon = require('sinon');
const flat = require('flat');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Company = require('../../../src/models/Company');
const CompanyHolding = require('../../../src/models/CompanyHolding');
const CompanyHelper = require('../../../src/helpers/companies');
const GDriveStorageHelper = require('../../../src/helpers/gDriveStorage');
const HoldingHelper = require('../../../src/helpers/holdings');
const SinonMongoose = require('../sinonMongoose');
const { DIRECTORY } = require('../../../src/helpers/constants');

describe('createCompany', () => {
  let find;
  let createCompany;
  let createFolderForCompanyStub;
  let createFolderStub;
  let updateHolding;
  beforeEach(() => {
    find = sinon.stub(Company, 'find');
    createCompany = sinon.stub(Company, 'create');
    createFolderForCompanyStub = sinon.stub(GDriveStorageHelper, 'createFolderForCompany');
    createFolderStub = sinon.stub(GDriveStorageHelper, 'createFolder');
    updateHolding = sinon.stub(HoldingHelper, 'update');
  });
  afterEach(() => {
    find.restore();
    createCompany.restore();
    createFolderForCompanyStub.restore();
    createFolderStub.restore();
    updateHolding.restore();
  });

  it('should create a company (without holding)', async () => {
    const payload = { name: 'Test SAS' };
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
      [{ _id: new ObjectId(), prefixNumber: 345 }],
      ['sort', 'limit', 'lean']
    ));
    createCompany.returns(createdCompany);

    const result = await CompanyHelper.createCompany(payload);

    expect(result).toMatchObject(createdCompany);
    sinon.assert.notCalled(updateHolding);
    sinon.assert.calledOnceWithExactly(createFolderForCompanyStub, payload.name);
    sinon.assert.calledWithExactly(createFolderStub.getCall(0), 'direct debits', '1234567890');
    sinon.assert.calledWithExactly(createFolderStub.getCall(1), 'customers', '1234567890');
    sinon.assert.calledWithExactly(createFolderStub.getCall(2), 'auxiliaries', '1234567890');
    sinon.assert.calledOnceWithExactly(createCompany, { ...createdCompany, prefixNumber: 346 });
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find' },
        { query: 'sort', args: [{ prefixNumber: -1 }] },
        { query: 'limit', args: [1] },
        { query: 'lean' },
      ]
    );
  });

  it('should create a company (with holding)', async () => {
    const payload = { name: 'Test SAS', holding: new ObjectId() };
    const formattedPayload = {
      name: 'Test SAS',
      folderId: '1234567890',
      directDebitsFolderId: '0987654321',
      customersFolderId: 'qwertyuiop',
      auxiliariesFolderId: 'asdfghj',
    };
    const company = { _id: new ObjectId(), ...formattedPayload };

    createFolderForCompanyStub.returns({ id: '1234567890' });
    createFolderStub.onCall(0).returns({ id: '0987654321' });
    createFolderStub.onCall(1).returns({ id: 'qwertyuiop' });
    createFolderStub.onCall(2).returns({ id: 'asdfghj' });
    find.returns(SinonMongoose.stubChainedQueries(
      [{ _id: new ObjectId(), prefixNumber: 345 }],
      ['sort', 'limit', 'lean']
    ));
    createCompany.returns(company);

    const result = await CompanyHelper.createCompany(payload);

    expect(result).toMatchObject(company);
    sinon.assert.calledOnceWithExactly(createFolderForCompanyStub, payload.name);
    sinon.assert.calledWithExactly(createFolderStub.getCall(0), 'direct debits', '1234567890');
    sinon.assert.calledWithExactly(createFolderStub.getCall(1), 'customers', '1234567890');
    sinon.assert.calledWithExactly(createFolderStub.getCall(2), 'auxiliaries', '1234567890');
    sinon.assert.calledOnceWithExactly(createCompany, { ...formattedPayload, prefixNumber: 346 });
    sinon.assert.calledOnceWithExactly(updateHolding, payload.holding, { companies: [company._id] });
    SinonMongoose.calledOnceWithExactly(
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
  let companyHoldingFind;
  beforeEach(() => {
    find = sinon.stub(Company, 'find');
    companyHoldingFind = sinon.stub(CompanyHolding, 'find');
  });
  afterEach(() => {
    find.restore();
    companyHoldingFind.restore();
  });

  it('should return all companies', async () => {
    const companyList = [{ _id: new ObjectId(), name: 'Alenvi' }];
    find.returns(SinonMongoose.stubChainedQueries(companyList, ['lean']));

    const result = await CompanyHelper.list({});

    expect(result).toEqual(companyList);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ _id: { $nin: [] } }, { name: 1, salesRepresentative: 1 }] },
        { query: 'lean', args: [] },
      ]
    );
    sinon.assert.notCalled(companyHoldingFind);
  });

  it('should return all companies and populate holding', async () => {
    const companyList = [{ _id: new ObjectId(), name: 'Alenvi', holding: { _id: new ObjectId(), name: 'Holding' } }];
    find.returns(SinonMongoose.stubChainedQueries(companyList));

    const result = await CompanyHelper.list({ action: DIRECTORY });

    expect(result).toEqual(companyList);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ _id: { $nin: [] } }, { name: 1, salesRepresentative: 1 }] },
        { query: 'populate', args: [{ path: 'holding', populate: { path: 'holding', select: 'name' } }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(companyHoldingFind);
  });

  it('should return companies without holdings', async () => {
    const companyHoldingsList = [{ _id: new ObjectId(), company: new ObjectId(), holding: new ObjectId() }];
    const companyList = [{ _id: new ObjectId(), name: 'Alenvi' }];
    find.returns(SinonMongoose.stubChainedQueries(companyList, ['lean']));
    companyHoldingFind.returns(SinonMongoose.stubChainedQueries(companyHoldingsList, ['lean']));

    const result = await CompanyHelper.list({ withoutHoldingCompanies: true });

    expect(result).toEqual(companyList);
    SinonMongoose.calledOnceWithExactly(
      companyHoldingFind,
      [{ query: 'find', args: [{}, { company: 1 }] }, { query: 'lean', args: [] }]
    );
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{ _id: { $nin: [companyHoldingsList[0].company] } }, { name: 1, salesRepresentative: 1 }],
        },
        { query: 'lean', args: [] },
      ]
    );
  });

  it('should return companies from specific holding', async () => {
    const companyId = new ObjectId();
    const holdingId = new ObjectId();
    const companyHoldingsList = [
      { _id: new ObjectId(), company: { _id: companyId, name: 'Alenvi' }, holding: holdingId },
    ];
    companyHoldingFind.returns(SinonMongoose.stubChainedQueries(companyHoldingsList));

    const result = await CompanyHelper.list({ holding: holdingId });

    expect(result).toEqual([{ _id: companyId, name: 'Alenvi' }]);
    SinonMongoose.calledOnceWithExactly(
      companyHoldingFind,
      [
        { query: 'find', args: [{ holding: holdingId }, { company: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'company',
            select: 'name',
            populate: { path: 'billingRepresentative', select: '_id picture contact identity local' },
          }],
        },
        { query: 'lean', args: [] },
      ]
    );
    sinon.assert.notCalled(find);
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
    const company = {
      _id: new ObjectId(),
      name: 'test',
      billingRepresentative: {
        _id: new ObjectId(),
        identity: { firstname: 'nono', lastname: 'toto' },
        contact: {},
        local: { email: 'nono@struc.fr' },
      },
    };
    findOne.returns(SinonMongoose.stubChainedQueries(company));

    const result = await CompanyHelper.getCompany(company._id);

    expect(result).toEqual(company);
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: company._id }] },
        { query: 'populate', args: [{ path: 'billingRepresentative', select: '_id picture contact identity local' }] },
        { query: 'populate', args: [{ path: 'salesRepresentative', select: '_id picture contact identity local' }] },
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

  it('should update company', async () => {
    const companyId = new ObjectId();
    const payload = { name: 'Nouveau nom' };
    findOneAndUpdate.returns({ _id: companyId });

    const result = await CompanyHelper.updateCompany(companyId, payload);

    expect(result).toEqual({ _id: companyId });
    sinon.assert.calledWithExactly(
      findOneAndUpdate,
      { _id: companyId },
      { $set: flat({ name: 'Nouveau nom' }) },
      { new: true }
    );
  });
});
