const expect = require('expect');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const SinonMongoose = require('../sinonMongoose');
const CourseCreditNoteHelper = require('../../../src/helpers/courseCreditNotes');
const CourseCreditNote = require('../../../src/models/CourseCreditNote');
const CourseCreditNoteNumber = require('../../../src/models/CourseCreditNoteNumber');
const CourseCreditNotePdf = require('../../../src/data/pdf/courseBilling/courseCreditNote');
const PdfHelper = require('../../../src/helpers/pdf');
const VendorCompaniesHelper = require('../../../src/helpers/vendorCompanies');

describe('createCourseCreditNote', () => {
  let create;
  let findOneAndUpdateCourseCreditNoteNumber;

  beforeEach(() => {
    create = sinon.stub(CourseCreditNote, 'create');
    findOneAndUpdateCourseCreditNoteNumber = sinon.stub(CourseCreditNoteNumber, 'findOneAndUpdate');
  });

  afterEach(() => {
    create.restore();
    findOneAndUpdateCourseCreditNoteNumber.restore();
  });

  it('should create a credit note', async () => {
    const payload = {
      date: '2022-03-08T00:00:00.000Z',
      company: new ObjectId(),
      customerBill: new ObjectId(),
      misc: 'salut',
    };
    const lastPaymentNumber = { seq: 1 };

    findOneAndUpdateCourseCreditNoteNumber.returns(SinonMongoose.stubChainedQueries(lastPaymentNumber, ['lean']));

    await CourseCreditNoteHelper.createCourseCreditNote(payload);
    sinon.assert.calledOnceWithExactly(create, { ...payload, number: 'AV-00001' });
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdateCourseCreditNoteNumber,
      [
        {
          query: 'findOneAndUpdate',
          args: [{}, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }],
        },
        { query: 'lean' },
      ]);
  });
});

describe('generateCreditNotePdf', () => {
  let findOne;
  let getPdfContent;
  let generatePdf;
  let getVendorCompany;

  beforeEach(() => {
    findOne = sinon.stub(CourseCreditNote, 'findOne');
    getPdfContent = sinon.stub(CourseCreditNotePdf, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
    getVendorCompany = sinon.stub(VendorCompaniesHelper, 'get');
  });

  afterEach(() => {
    findOne.restore();
    getPdfContent.restore();
    generatePdf.restore();
    getVendorCompany.restore();
  });

  it('should download course credit note', async () => {
    const creditNoteId = new ObjectId();

    const vendorCompany = {
      name: 'Auchan',
      address: {
        fullAddress: '32 Rue du Loup 33000 Bordeaux',
        street: '32 Rue du Loup',
        city: 'Bordeaux',
        zipCode: '33000',
        location: { type: 'Point', coordinates: [-0.573054, 44.837914] },
      },
      siret: '27272727274124',
    };

    const creditNote = {
      _id: creditNoteId,
      misc: 'motif',
      number: 'AV-00001',
      date: '2022-03-09T00:00:00.000Z',
      company: {
        name: 'test',
        address: {
          fullAddress: '24 Avenue Daumesnil 75012 Paris',
          street: '24 Avenue Daumesnil',
          city: 'Paris',
          zipCode: '75012',
          location: { type: 'Point', coordinates: [2.37345, 48.848024] },
        },
      },
      courseBill: {
        _id: new ObjectId(),
        course: {
          _id: new ObjectId(),
          subProgram: { _id: new ObjectId(), program: { _id: new ObjectId(), name: 'Test' } },
        },
        mainFee: { price: 1000, count: 1 },
        billingPurchaseList: [
          { billingItem: { _id: new ObjectId(), name: 'article 1' }, price: 10, count: 10 },
          { billingItem: { _id: new ObjectId(), name: 'article 2' }, price: 20, count: 10 },
        ],
        number: 'FACT-00001',
        billedAt: '2022-03-08T00:00:00.000Z',
        courseFundingOrganisation: '',
      },
    };

    getVendorCompany.returns(vendorCompany);
    findOne.returns(SinonMongoose.stubChainedQueries(creditNote));
    getPdfContent.returns({ content: [{ text: 'data' }] });
    generatePdf.returns({ pdf: 'pdf' });

    const result = await CourseCreditNoteHelper.generateCreditNotePdf(creditNoteId);
    expect(result).toEqual({ creditNoteNumber: creditNote.number, pdf: { pdf: 'pdf' } });
    sinon.assert.calledOnceWithExactly(
      getPdfContent,
      {
        number: 'AV-00001',
        date: '09/03/2022',
        misc: 'motif',
        courseBill: { number: 'FACT-00001', date: '08/03/2022' },
        vendorCompany,
        company: creditNote.company,
        payer: creditNote.company,
        course: creditNote.courseBill.course,
        mainFee: creditNote.courseBill.mainFee,
        billingPurchaseList: creditNote.courseBill.billingPurchaseList,
      }
    );
    sinon.assert.calledWithExactly(generatePdf, { content: [{ text: 'data' }] });
    SinonMongoose.calledOnceWithExactly(findOne,
      [
        { query: 'findOne', args: [{ _id: creditNoteId }] },
        {
          query: 'populate',
          args: [
            {
              path: 'courseBill',
              select: 'course number date courseFundingOrganisation billingPurchaseList mainFee billedAt',
              populate: [
                {
                  path: 'course',
                  select: 'subProgram',
                  populate: { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
                },
                { path: 'courseFundingOrganisation', select: 'name address' },
                {
                  path: 'billingPurchaseList',
                  select: 'billingItem',
                  populate: { path: 'billingItem', select: 'name' },
                },
              ],
            },
          ],
        },
        { query: 'populate', args: [{ path: 'company', select: 'name address' }] },
        { query: 'lean' },
      ]);
  });
});
