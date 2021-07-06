const sinon = require('sinon');
const expect = require('expect');
const PdfPrinter = require('pdfmake');
const PdfDocument = require('pdfkit');
const getStream = require('get-stream');
const PdfHelper = require('../../../src/helpers/pdf');
const FileHelper = require('../../../src/helpers/file');

describe('formatSurchargeHourForPdf', () => {
  it('should return just the hours', () => {
    const date = '2019-08-22 18:00';
    expect(PdfHelper.formatSurchargeHourForPdf(date)).toBe('18h');
  });

  it('should return the hours and the minutes', () => {
    const date = '2019-08-22 17:05';
    expect(PdfHelper.formatSurchargeHourForPdf(date)).toBe('17h05');
  });
});

describe('formatEventSurchargesForPdf', () => {
  let formatSurchargeHourForPdf;
  beforeEach(() => {
    formatSurchargeHourForPdf = sinon.stub(PdfHelper, 'formatSurchargeHourForPdf');
    formatSurchargeHourForPdf.callsFake(date => `${date}d`);
  });
  afterEach(() => {
    formatSurchargeHourForPdf.restore();
  });

  it('should set an empty array if the array of surcharges is empty', () => {
    const formattedSurcharges = PdfHelper.formatEventSurchargesForPdf([]);
    expect(formattedSurcharges).toEqual([]);
    sinon.assert.notCalled(formatSurchargeHourForPdf);
  });

  it('should set the surcharges', () => {
    const surcharges = [
      { percentage: 25 },
      { percentage: 15, startHour: '18', endHour: '20' },
    ];

    const formattedSurcharges = PdfHelper.formatEventSurchargesForPdf(surcharges);

    expect(formattedSurcharges).toEqual([
      { percentage: 25 },
      { percentage: 15, startHour: '18d', endHour: '20d' },
    ]);
    sinon.assert.calledTwice(formatSurchargeHourForPdf);
  });
});

describe('generatePdf', () => {
  let createPdfKitDocument;
  let buffer;
  let deleteImages;

  beforeEach(() => {
    createPdfKitDocument = sinon.stub(PdfPrinter.prototype, 'createPdfKitDocument');
    buffer = sinon.stub(getStream, 'buffer');
    deleteImages = sinon.stub(FileHelper, 'deleteImages');
  });

  afterEach(() => {
    createPdfKitDocument.restore();
    buffer.restore();
    deleteImages.restore();
  });

  it('should generate pdf', async () => {
    const template = { content: [{ text: 'test' }] };
    const doc = new PdfDocument();
    const pdf = Buffer;

    createPdfKitDocument.returns(doc);
    buffer.returns(pdf);

    const result = await PdfHelper.generatePdf(template);

    expect(result).toBe(pdf);
    sinon.assert.calledOnceWithExactly(createPdfKitDocument, template);
    sinon.assert.calledOnceWithExactly(buffer, doc);
    sinon.assert.calledOnceWithExactly(deleteImages);
  });
});
