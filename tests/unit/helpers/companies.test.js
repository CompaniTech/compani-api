const sinon = require('sinon');
const flat = require('flat');
const Boom = require('boom');
const expect = require('expect');
const { ObjectID } = require('mongodb');
const Company = require('../../../src/models/Company');
const CompanyHelper = require('../../../src/helpers/companies');
const GdriveStorageHelper = require('../../../src/helpers/gdriveStorage');
const Drive = require('../../../src/models/Google/Drive');

require('sinon-mongoose');

describe('createCompany', () => {
  it('should create a company', async () => {
    const CompanyMock = sinon.mock(Company);
    const createFolderForCompanyStub = sinon.stub(GdriveStorageHelper, 'createFolderForCompany');
    const createFolderStub = sinon.stub(GdriveStorageHelper, 'createFolder');
    const payload = { name: 'Test SAS', tradeName: 'Test' };

    createFolderForCompanyStub.returns({ id: '1234567890' });
    createFolderStub.returns({ id: '0987654321' });
    CompanyMock
      .expects('create')
      .withExactArgs({ ...payload, folderId: '1234567890', directDebitsFolderId: '0987654321' });

    await CompanyHelper.createCompany(payload);

    sinon.assert.calledWithExactly(createFolderForCompanyStub, payload.name);
    sinon.assert.calledWithExactly(createFolderStub, 'direct debits', '1234567890');
    CompanyMock.verify();
    CompanyMock.restore();
    createFolderForCompanyStub.restore();
    createFolderStub.restore();
  });
});

describe('uploadFile', () => {
  let CompanyModel;
  let addStub;
  let getFileByIdStub;
  beforeEach(() => {
    CompanyModel = sinon.mock(Company);
    addStub = sinon.stub(Drive, 'add');
    getFileByIdStub = sinon.stub(Drive, 'getFileById');
  });
  afterEach(() => {
    CompanyModel.restore();
    addStub.restore();
    getFileByIdStub.restore();
});

  it('should upload a file', async () => {
    const payload = { fileName: 'mandat_signe', contractWithCompany: 'true' };
    const params = { _id: new ObjectID(), driveId: new ObjectID() };
    const uploadedFile = { id: new ObjectID() };
    const driveFileInfo = { webViewLink: 'test' };
    addStub.returns(uploadedFile);
    getFileByIdStub.returns(driveFileInfo);
    const companyPayload = {
      rhConfig: {
        templates: {
          contractWithCompany: { driveId: uploadedFile.id, link: driveFileInfo.webViewLink },
        },
      },
    };
    CompanyModel
      .expects('findOneAndUpdate')
      .withExactArgs({ _id: params._id }, { $set: flat(companyPayload) }, { new: true });

    await CompanyHelper.uploadFile(payload, params);
    sinon.assert.calledWithExactly(addStub, {
      body: 'true',
      folder: false,
      name: payload.fileName,
      parentFolderId: params.driveId,
      type: undefined,
    });
    sinon.assert.calledWithExactly(getFileByIdStub, { fileId: uploadedFile.id });
  });

  it('should return a 403 if payload does not contain the right fields', async () => {
    try {
      CompanyModel.expects('findOneAndUpdate').never();
      await CompanyHelper.uploadFile({}, {});
      sinon.assert.notCalled(addStub);
      sinon.assert.notCalled(getFileByIdStub);
    } catch (e) {
      expect(e).toEqual(Boom.forbidden('Upload not allowed'));
    }
  });
});
