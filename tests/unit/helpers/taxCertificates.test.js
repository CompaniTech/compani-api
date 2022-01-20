const sinon = require('sinon');
const expect = require('expect');
const { ObjectId } = require('mongodb');
const moment = require('moment');
const Boom = require('@hapi/boom');
const TaxCertificateHelper = require('../../../src/helpers/taxCertificates');
const TaxCertificatePdf = require('../../../src/data/pdf/taxCertificates');
const PdfHelper = require('../../../src/helpers/pdf');
const UtilsHelper = require('../../../src/helpers/utils');
const SubscriptionsHelper = require('../../../src/helpers/subscriptions');
const GDriveStorageHelper = require('../../../src/helpers/gDriveStorage');
const TaxCertificate = require('../../../src/models/TaxCertificate');
const EventRepository = require('../../../src/repositories/EventRepository');
const PaymentRepository = require('../../../src/repositories/PaymentRepository');
const SinonMongoose = require('../sinonMongoose');

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(TaxCertificate, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return tax certificates list', async () => {
    const taxCertificates = [{ _id: new ObjectId() }, { _id: new ObjectId() }];
    const companyId = new ObjectId();
    const customer = new ObjectId();

    find.returns(SinonMongoose.stubChainedQueries(taxCertificates, ['lean']));

    const result = await TaxCertificateHelper.list(customer, { company: { _id: companyId } });

    expect(result).toEqual(taxCertificates);
    SinonMongoose.calledOnceWithExactly(
      find,
      [{ query: 'find', args: [{ customer, company: companyId }] }, { query: 'lean' }]
    );
  });
});

describe('formatInterventions', () => {
  let populateService;
  let formatIdentity;
  let formatHour;
  beforeEach(() => {
    populateService = sinon.stub(SubscriptionsHelper, 'populateService');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    formatHour = sinon.stub(UtilsHelper, 'formatHour');
  });
  afterEach(() => {
    populateService.restore();
    formatIdentity.restore();
    formatHour.restore();
  });

  it('should format interventions', () => {
    const interventions = [
      {
        auxiliary: {
          identity: { lastname: 'lastname', firstname: 'first' },
          createdAt: '2019-07-12T09:08:12',
          serialNumber: 'LAF1907120908',
        },
        month: '9',
        duration: 12,
        subscription: { service: { name: 'Temps de qualité' } },
      },
      {
        auxiliary: {
          identity: { lastname: 'firstname', firstname: 'first' },
          createdAt: '2019-05-13T10:08:12',
          serialNumber: 'FIF1905131008',
        },
        month: '5',
        duration: 13,
        subscription: { service: { name: 'Temps de partage' } },
      },
    ];
    formatIdentity.returns('toto');
    formatHour.onCall(0).returns('12,00h');
    formatHour.onCall(1).returns('13,00h');
    populateService.returnsArg(0);

    const result = TaxCertificateHelper.formatInterventions(interventions);
    expect(result).toEqual([
      {
        auxiliary: 'toto',
        subscription: 'Temps de qualité',
        month: 'Septembre',
        hours: '12,00h',
        serialNumber: 'LAF1907120908',
      },
      {
        auxiliary: 'toto',
        subscription: 'Temps de partage',
        month: 'Mai',
        hours: '13,00h',
        serialNumber: 'FIF1905131008',
      },
    ]);
    sinon.assert.calledWithExactly(populateService.getCall(0), { name: 'Temps de qualité' });
    sinon.assert.calledWithExactly(populateService.getCall(1), { name: 'Temps de partage' });
    sinon.assert.calledWithExactly(formatHour.getCall(0), 12);
    sinon.assert.calledWithExactly(formatHour.getCall(1), 13);
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'lastname', firstname: 'first' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'firstname', firstname: 'first' }, 'FL');
  });
});

describe('formatPdf', () => {
  let formatIdentity;
  let formatInterventions;
  let formatPrice;
  beforeEach(() => {
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    formatInterventions = sinon.stub(TaxCertificateHelper, 'formatInterventions');
    formatPrice = sinon.stub(UtilsHelper, 'formatPrice');
  });
  afterEach(() => {
    formatIdentity.restore();
    formatInterventions.restore();
    formatPrice.restore();
  });

  it('should return formatted data for pdf generation', async () => {
    const company = {
      name: 'Alenvi',
      rcs: 'rcs',
      address: { fullAddress: '10 rue des cathédrales 75007 Paris' },
      logo: 'https://storage.googleapis.com/compani-main/alenvi_logo_183x50.png',
      legalRepresentative: { lastname: 'Trebalag', firstname: 'Jean Christophe', position: 'master' },
    };
    const taxCertificate = {
      customer: {
        identity: { title: 'mr', lastname: 'leboncoin' },
        contact: {
          primaryAddress: {
            street: '37 rue de Ponthieu',
            zipCode: '75008',
            city: 'Paris',
            fullAddress: '37 rue de Ponthieu 75008 Paris',
            location: { type: 'Point', coordinates: [2.0987, 1.2345] },
          },
        },
      },
      year: '2019',
      date: '2020-01-19T00:00:00',
    };
    const interventions = [
      { auxiliary: { identity: { lastname: 'lastname' } }, month: '9', duration: 12 },
      { auxiliary: { identity: { lastname: 'firstname' } }, month: '5', duration: 13 },
    ];
    const payments = { paid: 1200, cesu: 500 };

    formatIdentity.onCall(0).returns('Jean Christophe TREBALAG');
    formatIdentity.onCall(1).returns('Mr Patate');
    formatInterventions.returns([{ subscription: 'Forfait nuit' }, { subscription: 'Forfait jour' }]);
    formatPrice.onCall(0).returns('1 700,00€');
    formatPrice.onCall(1).returns('500,00€');

    const result = TaxCertificateHelper.formatPdf(taxCertificate, company, interventions, payments);

    expect(result).toEqual({
      taxCertificate: {
        cesu: '500,00€',
        totalPaid: '1 700,00€',
        totalHours: '25,00h',
        interventions: [{ subscription: 'Forfait nuit' }, { subscription: 'Forfait jour' }],
        subscriptions: 'Forfait nuit, Forfait jour',
        company: {
          logo: company.logo,
          address: company.address,
          name: company.name,
          rcs: 'rcs',
          legalRepresentative: { name: 'Jean Christophe TREBALAG', position: 'master' },
        },
        year: '2019',
        date: '19/01/2020',
        customer: { name: 'Mr Patate', address: taxCertificate.customer.contact.primaryAddress },
      },
    });
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), taxCertificate.customer.identity, 'TFL');
    sinon.assert.calledWithExactly(formatInterventions, interventions);
    sinon.assert.calledWithExactly(formatPrice.getCall(0), 1700);
    sinon.assert.calledWithExactly(formatPrice.getCall(1), 500);
  });
});

describe('generateTaxCertificatePdf', () => {
  let generatePdf;
  let findOne;
  let formatPdf;
  let getPdfContent;
  let getTaxCertificateInterventions;
  let getTaxCertificatesPayments;
  beforeEach(() => {
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
    findOne = sinon.stub(TaxCertificate, 'findOne');
    formatPdf = sinon.stub(TaxCertificateHelper, 'formatPdf');
    getPdfContent = sinon.stub(TaxCertificatePdf, 'getPdfContent');
    getTaxCertificateInterventions = sinon.stub(EventRepository, 'getTaxCertificateInterventions');
    getTaxCertificatesPayments = sinon.stub(PaymentRepository, 'getTaxCertificatesPayments');
  });
  afterEach(() => {
    generatePdf.restore();
    findOne.restore();
    formatPdf.restore();
    getPdfContent.restore();
    getTaxCertificateInterventions.restore();
    getTaxCertificatesPayments.restore();
  });

  it('should generate pdf', async () => {
    const taxCertificateId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const taxCertificate = { _id: taxCertificateId, year: '2019' };

    findOne.returns(SinonMongoose.stubChainedQueries(taxCertificate));
    getTaxCertificateInterventions.returns(['interventions']);
    getTaxCertificatesPayments.returns({ paid: 1200, cesu: 500 });
    formatPdf.returns('data');
    getPdfContent.returns('templatePdfMake');
    generatePdf.returns('pdf');

    const result = await TaxCertificateHelper.generateTaxCertificatePdf(taxCertificateId, credentials);

    expect(result).toEqual('pdf');
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: taxCertificateId }] },
        {
          query: 'populate',
          args: [{
            path: 'customer',
            select: 'identity contact subscriptions',
            populate: { path: 'subscriptions.service' },
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(getTaxCertificateInterventions, taxCertificate, companyId);
    sinon.assert.calledWithExactly(getTaxCertificatesPayments, taxCertificate, companyId);
    sinon.assert.calledWithExactly(
      formatPdf,
      taxCertificate,
      credentials.company,
      ['interventions'],
      { paid: 1200, cesu: 500 }
    );
    sinon.assert.calledWithExactly(getPdfContent, 'data');
    sinon.assert.calledWithExactly(generatePdf, 'templatePdfMake');
  });
});

describe('create', () => {
  let addFileStub;
  let create;
  const date = new Date();
  const payload = {
    driveFolderId: '1234567890',
    fileName: 'test',
    taxCertificate: 'stream',
    mimeType: 'application/pdf',
    date: date.toISOString(),
    year: moment(date).format('YYYY'),
    company: new ObjectId(),
    customer: new ObjectId(),
  };
  const credentials = { company: { _id: new ObjectId() } };
  const createPayload = {
    company: credentials.company._id,
    date: payload.date,
    year: payload.year,
    customer: payload.customer,
    driveFile: { driveId: '0987654321', link: 'http://test.com/test.pdf' },
  };
  const newTaxCertificate = new TaxCertificate(createPayload);

  beforeEach(() => {
    addFileStub = sinon.stub(GDriveStorageHelper, 'addFile');
    create = sinon.stub(TaxCertificate, 'create');
  });

  afterEach(() => {
    addFileStub.restore();
    create.restore();
  });

  it('should throw a 424 error if file is not uploaded to Google Drive', async () => {
    addFileStub.returns(null);

    try {
      await TaxCertificateHelper.create(payload, credentials);
    } catch (e) {
      expect(e).toEqual(Boom.failedDependency('Google drive: File not uploaded'));
    } finally {
      sinon.assert.calledWithExactly(addFileStub, {
        driveFolderId: '1234567890',
        name: 'test',
        type: 'application/pdf',
        body: 'stream',
      });
      sinon.assert.notCalled(create);
    }
  });

  it('should save document to drive and db', async () => {
    addFileStub.returns({ id: '0987654321', webViewLink: 'http://test.com/test.pdf' });

    create.returns(newTaxCertificate);

    const result = await TaxCertificateHelper.create(payload, credentials);

    expect(result).toMatchObject(newTaxCertificate.toObject());
    sinon.assert.calledWithExactly(addFileStub, {
      driveFolderId: '1234567890',
      name: 'test',
      type: 'application/pdf',
      body: 'stream',
    });
    sinon.assert.calledOnceWithExactly(create, createPayload);
  });
});

describe('remove', () => {
  let findOneAndDelete;
  let deleteFileStub;
  beforeEach(() => {
    findOneAndDelete = sinon.stub(TaxCertificate, 'findOneAndDelete');
    deleteFileStub = sinon.stub(GDriveStorageHelper, 'deleteFile');
  });
  afterEach(() => {
    findOneAndDelete.restore();
    deleteFileStub.restore();
  });

  it('should delete tax certificate', async () => {
    const taxCertificateId = new ObjectId();

    findOneAndDelete.returns(SinonMongoose.stubChainedQueries({ _id: new ObjectId() }, ['lean']));

    await TaxCertificateHelper.remove(taxCertificateId);

    sinon.assert.notCalled(deleteFileStub);
    SinonMongoose.calledOnceWithExactly(
      findOneAndDelete,
      [{ query: 'findOneAndDelete', args: [{ _id: taxCertificateId }] }, { query: 'lean' }]
    );
  });

  it('should delete tax certificate and drive file if there is one', async () => {
    const taxCertificateId = new ObjectId();
    const taxCertificate = { _id: new ObjectId(), driveFile: { driveId: new ObjectId() } };

    findOneAndDelete.returns(SinonMongoose.stubChainedQueries(taxCertificate, ['lean']));

    await TaxCertificateHelper.remove(taxCertificateId);

    sinon.assert.calledWithExactly(deleteFileStub, taxCertificate.driveFile.driveId);
    SinonMongoose.calledOnceWithExactly(
      findOneAndDelete,
      [{ query: 'findOneAndDelete', args: [{ _id: taxCertificateId }] }, { query: 'lean' }]
    );
  });
});
