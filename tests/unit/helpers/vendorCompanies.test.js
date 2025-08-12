const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const VendorCompany = require('../../../src/models/VendorCompany');
const VendorCompaniesHelper = require('../../../src/helpers/vendorCompanies');
const Drive = require('../../../src/models/Google/Drive');
const SinonMongoose = require('../sinonMongoose');

describe('get', () => {
  let findOne;

  beforeEach(() => {
    findOne = sinon.stub(VendorCompany, 'findOne');
  });

  afterEach(() => {
    findOne.restore();
  });

  it('should return vendor company infos', async () => {
    const vendorCompany = {
      name: 'Company',
      billingRepresentative: {
        _id: new ObjectId(),
        identity: { firstname: 'toto', lastname: 'zero' },
        contact: {},
        local: { email: 'toto@zero.io' },
      },
    };
    findOne.returns(SinonMongoose.stubChainedQueries(vendorCompany));

    await VendorCompaniesHelper.get();

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne' },
        {
          query: 'populate',
          args: [{ path: 'billingRepresentative', select: '_id picture contact identity local' }],
        },
        { query: 'lean' },
      ]);
  });
});

describe('update', () => {
  let updateOne;

  beforeEach(() => {
    updateOne = sinon.stub(VendorCompany, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should update vendor company infos', async () => {
    const payload = { name: 'Campanil' };

    await VendorCompaniesHelper.update(payload);

    sinon.assert.calledOnceWithExactly(updateOne, {}, { $set: payload });
  });
});

describe('uploadDebitMandateTemplate', () => {
  let addStub;
  let updateOne;
  let getFileByIdStub;
  beforeEach(() => {
    addStub = sinon.stub(Drive, 'add');
    updateOne = sinon.stub(VendorCompany, 'updateOne');
    getFileByIdStub = sinon.stub(Drive, 'getFileById');
    process.env.DEBIT_MANDAT_FOLDER_ID = '1234567890';
  });
  afterEach(() => {
    addStub.restore();
    updateOne.restore();
    getFileByIdStub.restore();
    process.env.DEBIT_MANDAT_FOLDER_ID = '';
  });

  it('should upload a template', async () => {
    const payload = { file: 'File' };
    const uploadedFile = { id: new ObjectId() };
    const driveFileInfo = { webViewLink: 'test' };
    const vendorCompanyPayload = {
      debitMandateTemplate: { driveId: uploadedFile.id, link: driveFileInfo.webViewLink },
    };

    addStub.returns(uploadedFile);
    getFileByIdStub.returns(driveFileInfo);
    updateOne.returns(SinonMongoose.stubChainedQueries(null, ['lean']));

    await VendorCompaniesHelper.uploadDebitMandateTemplate(payload);

    sinon.assert.calledWithExactly(
      addStub,
      {
        name: 'template_mandat_prelevement_SEPA_Compani',
        parentFolderId: process.env.DEBIT_MANDAT_FOLDER_ID,
        folder: false,
        type: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        body: 'File',
      }
    );
    sinon.assert.calledWithExactly(getFileByIdStub, { fileId: uploadedFile.id });
    SinonMongoose.calledOnceWithExactly(
      updateOne,
      [{ query: 'updateOne', args: [{}, { $set: vendorCompanyPayload }] }, { query: 'lean', args: [] }]
    );
  });
});

describe('removeDebitMandateTemplate', () => {
  let findOne;
  let updateOne;
  let deleteFileStub;

  beforeEach(() => {
    findOne = sinon.stub(VendorCompany, 'findOne');
    updateOne = sinon.stub(VendorCompany, 'updateOne');
    deleteFileStub = sinon.stub(Drive, 'deleteFile');
  });

  afterEach(() => {
    findOne.restore();
    updateOne.restore();
    deleteFileStub.restore();
  });

  it('should remove debit mandate template', async () => {
    const vendorCompany = {
      name: 'Company',
      billingRepresentative: {
        _id: new ObjectId(),
        identity: { firstname: 'toto', lastname: 'zero' },
        contact: {},
        local: { email: 'toto@zero.io' },
      },
      ics: 'FR12345678909',
      debitMandateTemplate: { link: 'link/123567890', driveId: '123567890' },
    };
    findOne.returns(SinonMongoose.stubChainedQueries(vendorCompany, ['lean']));

    await VendorCompaniesHelper.removeDebitMandateTemplate();

    SinonMongoose.calledOnceWithExactly(findOne, [{ query: 'findOne' }, { query: 'lean' }]);
    sinon.assert.calledWithExactly(deleteFileStub, { fileId: '123567890' });
    sinon.assert.calledOnceWithExactly(updateOne, {}, { $unset: { debitMandateTemplate: '' } });
  });
});
