const sinon = require('sinon');
const { expect } = require('expect');
const FileHelper = require('../../../src/helpers/file');
const PdfHelper = require('../../../src/helpers/pdf');
const UtilsHelper = require('../../../src/helpers/utils');
const CourseBill = require('../../../src/data/pdf/courseBilling/courseBill');
const { COPPER_GREY_200, COPPER_600, GROUP, TRAINEE, PAYMENT, REFUND } = require('../../../src/helpers/constants');

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

  it('it should format and return paid course bill pdf (with billing items)', async () => {
    const paths = ['src/data/pdf/tmp/logo.png', 'src/data/pdf/tmp/signature.png'];

    const bill = {
      number: 'FACT-000045',
      date: '18/08/1998',
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
        iban: 'FR9210096000302523177152Q14',
        bic: 'BPCEFRPP',
        shareCapital: 123000,
      },
      companies: [{ name: 'Test structure' }],
      payer: {
        name: 'payeur',
        address: '24 Avenue Daumesnil 75012 Paris',
      },
      isPayerCompany: false,
      course: { subProgram: { program: { name: 'Test' } } },
      mainFee: { price: 1000, count: 1, description: 'description', countUnit: GROUP },
      billingPurchaseList: [
        { billingItem: { name: 'article 1' }, price: 10, count: 10 },
        { billingItem: { name: 'article 2' }, price: 20, count: 10, description: 'article cool' },
      ],
      courseCreditNote: null,
      coursePayments: [
        { netInclTaxes: 1300, nature: REFUND, date: '2023-01-10T00:00:00.000Z' },
        { netInclTaxes: 1400, nature: PAYMENT, date: '2023-01-02T10:00:00.000Z' },
        { netInclTaxes: 1200, nature: PAYMENT, date: '2023-01-01T10:00:00.000Z' },
      ],
    };

    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 150, height: 32, alignment: 'right' },
            {
              stack: [
                { text: 'Facture', fontSize: 18 },
                { text: 'Prestation de services' },
                { text: 'FACT-000045', bold: true },
                { text: 'Date de facture : 18/08/1998' },
                { text: 'Facture acquittée le 02/01/2023 ☑', color: 'green' },
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
                { text: 'Facturer à' },
                { text: 'payeur', bold: true },
                { text: '24 Avenue Daumesnil 75012 Paris' },
              ],
            },
            {
              stack: [{ text: 'Formation pour le compte de' }, { text: 'Test structure', bold: true }],
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
          columns: [
            { text: '' },
            { text: '' },
            { text: '' },
            [
              { text: 'Paiements effectués', alignment: 'right', marginBottom: 8 },
              { text: 'Solde dû', alignment: 'right', marginBottom: 8, bold: true },
            ],
            [
              { text: '1300,00 €', alignment: 'right', width: 'auto', marginBottom: 8 },
              { text: '0,00 €', alignment: 'right', width: 'auto', marginBottom: 8, bold: true },
            ],
          ],
        },
        { text: 'Modes de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
        { text: '- Prélèvement ou virement bancaire', fontSize: 8 },
        { text: '- Pour les virements : IBAN : FR9210096000302523177152Q14 / BIC : BPCEFRPP', fontSize: 8 },
        { text: 'Conditions de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
        { text: '- 1er paiement à réception, le solde selon l’échéancier contractuel', fontSize: 8 },
        { text: '- Escompte en cas de paiement anticipé : aucun', fontSize: 8 },
        {
          text: '- Pénalité en cas de retard de paiement : trois fois le taux de l’intérêt légal, conformément aux '
      + 'dispositions légales en vigueur, majoré d’une indemnité  forfaitaire de 40€ pour frais de recouvrement',
          fontSize: 8,
        },
        {
          text: 'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
          + 'en vertu de l’article 261 du Code Général des Impôts (CGI).',
          fontSize: 8,
          marginTop: 8,
        },
        { image: paths[1], width: 112, marginTop: 8, alignment: 'right' },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        header: { fillColor: COPPER_600, color: 'white' },
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
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
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
    formatPrice.onCall(8).returns('1300,00 €');
    formatPrice.onCall(9).returns('0,00 €');
    formatPrice.onCall(10).returns('123 000,00 €');

    const result = await CourseBill.getPdfContent(bill);

    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('it should format and return course bill pdf (without billing items and with course credit note)', async () => {
    const paths = ['src/data/pdf/tmp/logo.png', undefined];

    const bill = {
      number: 'FACT-000045',
      date: '18/08/1998',
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
        iban: 'FR9210096000302523177152Q14',
        bic: 'BPCEFRPP',
        shareCapital: 123000,
      },
      companies: [{ name: 'Test structure' }],
      payer: {
        name: 'payeur',
        address: '24 Avenue Daumesnil 75012 Paris',
      },
      isPayerCompany: true,
      course: { subProgram: { program: { name: 'Test' } } },
      mainFee: { price: 1000, count: 1, description: 'description', countUnit: TRAINEE },
      courseCreditNote: { number: 'AV-00001' },
      coursePayments: [],
    };

    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 150, height: 32, alignment: 'right' },
            {
              stack: [
                { text: 'Facture', fontSize: 18 },
                { text: 'Prestation de services' },
                { text: 'FACT-000045', bold: true },
                { text: 'Date de facture : 18/08/1998' },
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
                { text: 'Facturer à' },
                { text: 'payeur', bold: true },
                { text: '24 Avenue Daumesnil 75012 Paris' },
              ],
            },
            {},
          ],
        },
        {
          table: {
            body: [
              [
                { text: '#', style: 'header', alignment: 'left' },
                { text: 'Article & description', style: 'header', alignment: 'left' },
                { text: 'Quantité (stagiaire)', style: 'header', alignment: 'center' },
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
          columns: [
            { text: '' },
            { text: '' },
            { text: '' },
            [
              { text: 'Paiements effectués', alignment: 'right', marginBottom: 8 },
              { text: 'Crédits appliqués', alignment: 'right', marginBottom: 8 },
              { text: 'Solde dû', alignment: 'right', marginBottom: 8, bold: true },
            ],
            [
              { text: '0,00 €', alignment: 'right', width: 'auto', marginBottom: 8 },
              { text: '1000,00 €', alignment: 'right', width: 'auto', marginBottom: 8 },
              { text: '0,00 €', alignment: 'right', width: 'auto', marginBottom: 8, bold: true },
            ],
          ],
        },
        { text: 'Modes de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
        { text: '- Prélèvement ou virement bancaire', fontSize: 8 },
        { text: '- Pour les virements : IBAN : FR9210096000302523177152Q14 / BIC : BPCEFRPP', fontSize: 8 },
        { text: 'Conditions de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
        { text: '- 1er paiement à réception, le solde selon l’échéancier contractuel', fontSize: 8 },
        { text: '- Escompte en cas de paiement anticipé : aucun', fontSize: 8 },
        {
          text: '- Pénalité en cas de retard de paiement : trois fois le taux de l’intérêt légal, conformément aux '
      + 'dispositions légales en vigueur, majoré d’une indemnité  forfaitaire de 40€ pour frais de recouvrement',
          fontSize: 8,
        },
        {
          text: 'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
          + 'en vertu de l’article 261 du Code Général des Impôts (CGI).',
          fontSize: 8,
          marginTop: 8,
        },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        header: { fillColor: COPPER_600, color: 'white' },
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
    formatPrice.onCall(4).returns('0,00 €');
    formatPrice.onCall(5).returns('1000,00 €');
    formatPrice.onCall(6).returns('0,00 €');
    formatPrice.onCall(7).returns('123 000,00 €');

    const result = await CourseBill.getPdfContent(bill);

    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});

describe('getPdf', () => {
  let getPdfContent;
  let generatePdf;

  beforeEach(() => {
    getPdfContent = sinon.stub(CourseBill, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    getPdfContent.restore();
    generatePdf.restore();
  });

  it('should get pdf', async () => {
    const data = {
      number: 'FACT-000045',
      date: '18/08/1998',
      companies: [{ name: 'Test structure' }],
      course: { subProgram: { program: { name: 'Test' } } },
      mainFee: { price: 1000, count: 1, description: 'description', countUnit: GROUP },
    };

    const template = {
      content: [
        {
          columns: [{ stack: [{ text: 'Facture', fontSize: 18 }], alignment: 'right' }],
          marginBottom: 4,
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 150, h: 32, r: 0, fillOpacity: 0.5, color: 'white' }],
          absolutePosition: { x: 40, y: 40 },
        },
        { text: 'Modes de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
        { text: '- Prélèvement ou virement bancaire', fontSize: 8 },
        { text: '- Pour les virements : IBAN : FR9210096000302523177152Q14 / BIC : BPCEFRPP', fontSize: 8 },
        { text: 'Conditions de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
        { text: '- 1er paiement à réception, le solde selon l’échéancier contractuel', fontSize: 8 },
        { text: '- Escompte en cas de paiement anticipé : aucun', fontSize: 8 },
        {
          text: '- Pénalité en cas de retard de paiement : trois fois le taux de l’intérêt légal, conformément aux '
      + 'dispositions légales en vigueur, majoré d’une indemnité  forfaitaire de 40€ pour frais de recouvrement',
          fontSize: 8,
        },
        {
          text: 'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
            + 'en vertu de l’article 261 du Code Général des Impôts (CGI).',
          fontSize: 8,
          marginTop: 8,
        },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        header: { fillColor: COPPER_600, color: 'white' },
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
    const images = [{ url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' }];
    getPdfContent.returns({ template, images });
    generatePdf.returns('pdf');

    const result = await CourseBill.getPdf(data);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });
});
