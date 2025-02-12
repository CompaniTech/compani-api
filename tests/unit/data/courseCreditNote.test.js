const sinon = require('sinon');
const { expect } = require('expect');
const FileHelper = require('../../../src/helpers/file');
const PdfHelper = require('../../../src/helpers/pdf');
const UtilsHelper = require('../../../src/helpers/utils');
const CourseCreditNote = require('../../../src/data/pdf/courseBilling/courseCreditNote');
const { COPPER_GREY_200, ORANGE_600, GROUP } = require('../../../src/helpers/constants');

describe('getPdfContent', () => {
  let downloadImages;
  let formatPrice;

  beforeEach(() => {
    downloadImages = sinon.stub(FileHelper, 'downloadImages');
    formatPrice = sinon.stub(UtilsHelper, 'formatPrice');
  });

  afterEach(() => {
    downloadImages.restore();
    formatPrice.restore();
  });

  it('should format and return course credit note pdf (with billing items)', async () => {
    const paths = ['src/data/pdf/tmp/logo.png'];

    const creditNote = {
      number: 'AV-000045',
      date: '21/08/1998',
      misc: 'motif',
      vendorCompany: {
        name: 'Auchan',
        address: {
          fullAddress: '32 Rue du Loup 33000 Bordeaux',
          street: '32 Rue du Loup',
          city: 'Bordeaux',
          zipCode: '33000',
          location: { type: 'Point', coordinates: [-0.573054, 44.837914] },
        },
        siret: '27272727274124',
        shareCapital: 123000,
      },
      courseBill: { number: 'FACT-000045', date: '18/08/1998' },
      payer: {
        name: 'payeur',
        address: '24 Avenue Daumesnil 75012 Paris',
      },
      course: { subProgram: { program: { name: 'Test' } } },
      mainFee: { price: 1000, count: 1, description: 'description', countUnit: GROUP },
      billingPurchaseList: [
        { billingItem: { name: 'article 1' }, price: 10, count: 10 },
        { billingItem: { name: 'article 2' }, price: 20, count: 10, description: 'article cool' },
      ],
    };

    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 150, height: 32, alignment: 'right' },
            {
              stack: [
                { text: 'Avoir', fontSize: 18 },
                { text: 'Prestation de services' },
                { text: 'AV-000045', bold: true },
                { text: 'Date de l\'avoir : 21/08/1998' },
              ],
              alignment: 'right',
            },
          ],
          marginBottom: 4,
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 150, h: 32, r: 0, fillOpacity: 0.5, color: 'white' }],
          absolutePosition: { x: 40, y: 40 },
        },
        {
          stack: [
            { text: 'Auchan', bold: true },
            { text: '32 Rue du Loup' },
            { text: '33000 Bordeaux' },
            { text: 'SIRET : 272 727 272 74124' },
          ],
          marginBottom: 36,
        },
        {
          columns: [
            {
              stack: [
                { text: '' },
                { text: 'payeur', bold: true },
                { text: '24 Avenue Daumesnil 75012 Paris' },
              ],
            },
            {
              stack: [
                { text: ['Avoir sur la facture ', { text: 'FACT-000045', bold: true }, { text: ' du 18/08/1998' }] },
                { text: 'Motif de l\'avoir : motif' },
              ],
              alignment: 'right',
            },
          ],
        },
        {
          table: {
            body: [
              [
                { text: '#', style: 'header', alignment: 'left' },
                { text: 'Article & description', style: 'header', alignment: 'left' },
                { text: 'Quantité (groupe)', style: 'header', alignment: 'center' },
                { text: 'Prix unitaire', style: 'header', alignment: 'center' },
                { text: 'Coût', alignment: 'right', style: 'header' },
              ],
              [
                { text: 1, alignment: 'left', marginTop: 8 },
                {
                  stack: [
                    { text: 'Test', alignment: 'left', marginTop: 8 },
                    { text: 'description', style: 'description', marginBottom: 8 },
                  ],
                },
                { text: 1, alignment: 'center', marginTop: 8 },
                { text: '1000,00 €', alignment: 'center', marginTop: 8 },
                { text: '1000,00 €', alignment: 'right', marginTop: 8 },
              ],
              [
                { text: 2, alignment: 'left', marginTop: 8 },
                {
                  stack: [
                    { text: 'article 1', alignment: 'left', marginTop: 8 },
                    { text: '', style: 'description', marginBottom: 8 },
                  ],
                },
                { text: 10, alignment: 'center', marginTop: 8 },
                { text: '10,00 €', alignment: 'center', marginTop: 8 },
                { text: '100,00 €', alignment: 'right', marginTop: 8 },
              ],
              [
                { text: 3, alignment: 'left', marginTop: 8 },
                {
                  stack: [
                    { text: 'article 2', alignment: 'left', marginTop: 8 },
                    { text: 'article cool', style: 'description', marginBottom: 8 },
                  ],
                },
                { text: 10, alignment: 'center', marginTop: 8 },
                { text: '20,00 €', alignment: 'center', marginTop: 8 },
                { text: '200,00 €', alignment: 'right', marginTop: 8 },
              ],
            ],
            widths: ['5%', '50%', '15%', '15%', '15%'],
          },
          margin: [0, 8, 0, 8],
          layout: { vLineWidth: () => 0, hLineWidth: i => (i > 1 ? 1 : 0), hLineColor: () => COPPER_GREY_200 },
        },
        {
          columns: [
            { text: '' },
            { text: '' },
            { text: '' },
            [
              { text: 'Sous-total HT', alignment: 'right', marginBottom: 8 },
              { text: 'Total TTC', alignment: 'right', marginBottom: 8, bold: true },
            ],
            [
              { text: '1300,00 €', alignment: 'right', width: 'auto', marginBottom: 8 },
              { text: '1300,00 €', alignment: 'right', width: 'auto', marginBottom: 8, bold: true },
            ],
          ],
        },
        {
          text: 'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
          + 'en vertu de l’article 261 du Code Général des Impôts (CGI).',
          fontSize: 8,
          marginTop: 48,
        },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        header: { fillColor: ORANGE_600, color: 'white' },
        description: { alignment: 'left', marginLeft: 8, fontSize: 10 },
      },
      footer: {
        text: 'Auchan au capital social de 123 000,00 € - SIRET 272 727 272 74124',
        italics: true,
        fontSize: 8,
        marginTop: 24,
        marginRight: 16,
        alignment: 'center',
      },
    };
    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
    ];

    downloadImages.returns(paths);
    formatPrice.onCall(0).returns('1000,00 €');
    formatPrice.onCall(1).returns('1000,00 €');
    formatPrice.onCall(2).returns('10,00 €');
    formatPrice.onCall(3).returns('100,00 €');
    formatPrice.onCall(4).returns('20,00 €');
    formatPrice.onCall(5).returns('200,00 €');
    formatPrice.onCall(6).returns('1300,00 €');
    formatPrice.onCall(7).returns('1300,00 €');
    formatPrice.onCall(8).returns('123 000,00 €');

    const result = await CourseCreditNote.getPdfContent(creditNote);

    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('should format and return course credit note pdf (without billing items)', async () => {
    const paths = ['src/data/pdf/tmp/logo.png'];

    const creditNote = {
      number: 'AV-000045',
      date: '21/08/1998',
      misc: 'motif',
      vendorCompany: {
        name: 'Auchan',
        address: {
          fullAddress: '32 Rue du Loup 33000 Bordeaux',
          street: '32 Rue du Loup',
          city: 'Bordeaux',
          zipCode: '33000',
          location: { type: 'Point', coordinates: [-0.573054, 44.837914] },
        },
        siret: '27272727274124',
        shareCapital: 123000,
      },
      courseBill: { number: 'FACT-000045', date: '18/08/1998' },
      payer: {
        name: 'payeur',
        address: '24 Avenue Daumesnil 75012 Paris',
      },
      course: { subProgram: { program: { name: 'Test' } } },
      mainFee: { price: 1000, count: 1, description: 'description', countUnit: GROUP },
    };

    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 150, height: 32, alignment: 'right' },
            {
              stack: [
                { text: 'Avoir', fontSize: 18 },
                { text: 'Prestation de services' },
                { text: 'AV-000045', bold: true },
                { text: 'Date de l\'avoir : 21/08/1998' },
              ],
              alignment: 'right',
            },
          ],
          marginBottom: 4,
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 150, h: 32, r: 0, fillOpacity: 0.5, color: 'white' }],
          absolutePosition: { x: 40, y: 40 },
        },
        {
          stack: [
            { text: 'Auchan', bold: true },
            { text: '32 Rue du Loup' },
            { text: '33000 Bordeaux' },
            { text: 'SIRET : 272 727 272 74124' },
          ],
          marginBottom: 36,
        },
        {
          columns: [
            {
              stack: [
                { text: '' },
                { text: 'payeur', bold: true },
                { text: '24 Avenue Daumesnil 75012 Paris' },
              ],
            },
            {
              stack: [
                { text: ['Avoir sur la facture ', { text: 'FACT-000045', bold: true }, { text: ' du 18/08/1998' }] },
                { text: 'Motif de l\'avoir : motif' },
              ],
              alignment: 'right',
            },
          ],
        },
        {
          table: {
            body: [
              [
                { text: '#', style: 'header', alignment: 'left' },
                { text: 'Article & description', style: 'header', alignment: 'left' },
                { text: 'Quantité (groupe)', style: 'header', alignment: 'center' },
                { text: 'Prix unitaire', style: 'header', alignment: 'center' },
                { text: 'Coût', alignment: 'right', style: 'header' },
              ],
              [
                { text: 1, alignment: 'left', marginTop: 8 },
                {
                  stack: [
                    { text: 'Test', alignment: 'left', marginTop: 8 },
                    { text: 'description', style: 'description', marginBottom: 8 },
                  ],
                },
                { text: 1, alignment: 'center', marginTop: 8 },
                { text: '1000,00 €', alignment: 'center', marginTop: 8 },
                { text: '1000,00 €', alignment: 'right', marginTop: 8 },
              ],
            ],
            widths: ['5%', '50%', '15%', '15%', '15%'],
          },
          margin: [0, 8, 0, 8],
          layout: { vLineWidth: () => 0, hLineWidth: i => (i > 1 ? 1 : 0), hLineColor: () => COPPER_GREY_200 },
        },
        {
          columns: [
            { text: '' },
            { text: '' },
            { text: '' },
            [
              { text: 'Sous-total HT', alignment: 'right', marginBottom: 8 },
              { text: 'Total TTC', alignment: 'right', marginBottom: 8, bold: true },
            ],
            [
              { text: '1000,00 €', alignment: 'right', width: 'auto', marginBottom: 8 },
              { text: '1000,00 €', alignment: 'right', width: 'auto', marginBottom: 8, bold: true },
            ],
          ],
        },
        {
          text: 'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
          + 'en vertu de l’article 261 du Code Général des Impôts (CGI).',
          fontSize: 8,
          marginTop: 48,
        },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        header: { fillColor: ORANGE_600, color: 'white' },
        description: { alignment: 'left', marginLeft: 8, fontSize: 10 },
      },
      footer: {
        text: 'Auchan au capital social de 123 000,00 € - SIRET 272 727 272 74124',
        italics: true,
        fontSize: 8,
        marginTop: 24,
        marginRight: 16,
        alignment: 'center',
      },
    };
    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
    ];

    downloadImages.returns(paths);
    formatPrice.onCall(0).returns('1000,00 €');
    formatPrice.onCall(1).returns('1000,00 €');
    formatPrice.onCall(2).returns('1000,00 €');
    formatPrice.onCall(3).returns('1000,00 €');
    formatPrice.onCall(4).returns('123 000,00 €');

    const result = await CourseCreditNote.getPdfContent(creditNote);

    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});

describe('getPdf', () => {
  let getPdfContent;
  let generatePdf;

  beforeEach(() => {
    getPdfContent = sinon.stub(CourseCreditNote, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    getPdfContent.restore();
    generatePdf.restore();
  });

  it('should get pdf', async () => {
    const data = {
      number: 'AV-000045',
      date: '21/08/1998',
      misc: 'motif',
      courseBill: { number: 'FACT-000045', date: '18/08/1998' },
      course: { subProgram: { program: { name: 'Test' } } },
      mainFee: { price: 1000, count: 1, description: 'description', countUnit: GROUP },
    };
    const template = {
      content: [
        {
          columns: [
            { stack: [{ text: 'Avoir', fontSize: 18 }, { text: 'AV-000045', bold: true }], alignment: 'right' },
          ],
          marginBottom: 4,
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 150, h: 32, r: 0, fillOpacity: 0.5, color: 'white' }],
          absolutePosition: { x: 40, y: 40 },
        },
        {
          stack: [
            { text: 'Auchan', bold: true },
            { text: '32 Rue du Loup' },
            { text: '33000 Bordeaux' },
            { text: 'Siret : 272 727 272 74124' },
          ],
          marginBottom: 36,
        },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      pageMargins: [40, 40, 40, 128],
    };
    const images = [{ url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' }];
    getPdfContent.returns({ template, images });
    generatePdf.returns('pdf');

    const result = await CourseCreditNote.getPdf(data);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });
});
