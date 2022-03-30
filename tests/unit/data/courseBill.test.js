const sinon = require('sinon');
const expect = require('expect');
const FileHelper = require('../../../src/helpers/file');
const UtilsHelper = require('../../../src/helpers/utils');
const CourseBill = require('../../../src/data/pdf/courseBilling/courseBill');
const { COPPER_GREY_200, COPPER_600 } = require('../../../src/helpers/constants');

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

  it('it should format and return course bill pdf (with billing items)', async () => {
    const paths = ['src/data/pdf/tmp/logo.png'];

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
      },
      company: { name: 'Test structure' },
      funder: {
        name: 'payeur',
        address: {
          fullAddress: '24 Avenue Daumesnil 75012 Paris',
          street: '24 Avenue Daumesnil',
          city: 'Paris',
          zipCode: '75012',
          location: { type: 'Point', coordinates: [2.37345, 48.848024] },
        },
      },
      course: { subProgram: { program: { name: 'Test' } } },
      mainFee: { price: 1000, count: 1, description: 'description' },
      billingPurchaseList: [
        { billingItem: { name: 'article 1' }, price: 10, count: 10 },
        { billingItem: { name: 'article 2' }, price: 20, count: 10, description: 'article cool' },
      ],
    };

    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 200, height: 42, alignment: 'right' },
            {
              stack: [
                { text: 'Facture', fontSize: 32 },
                { text: 'FACT-000045', bold: true },
                { text: 'Date de facture : 18/08/1998' },
              ],
              alignment: 'right',
            },
          ],
          marginBottom: 4,
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 200, h: 42, r: 0, fillOpacity: 0.5, color: 'white' }],
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
        {
          columns: [
            {
              stack: [
                { text: 'Facturée à' },
                { text: 'payeur', bold: true },
                { text: '24 Avenue Daumesnil' },
                { text: '75012 Paris' },
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
                { text: 'Quantité', style: 'header', alignment: 'center' },
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
            { text: 'Sous-total', alignment: 'right' },
            { text: '1300,00 €', alignment: 'right', marginLeft: 22, marginRight: 4, width: 'auto' },
          ],
        },
        {
          text: 'Merci de lire attentivement nos Conditions Générales de Prestations et le(s) programme(s) de '
            + 'formation en pièce-jointe.\nEn tant qu’organisme de formation, Compani est exonéré de la Taxe sur la '
            + 'Valeur Ajoutée (TVA).',
          fontSize: 8,
          marginTop: 48,
        },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 12 },
      styles: {
        marginRightLarge: { marginRight: 40 },
        header: { fillColor: COPPER_600, color: 'white' },
        description: { alignment: 'left', marginLeft: 8, fontSize: 10 },
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

    const result = await CourseBill.getPdfContent(bill);

    expect(JSON.stringify(result)).toEqual(JSON.stringify(pdf));
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('it should format and return course bill pdf (without billing items)', async () => {
    const paths = ['src/data/pdf/tmp/logo.png'];

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
      },
      company: { name: 'Test structure' },
      funder: {
        name: 'payeur',
        address: {
          fullAddress: '24 Avenue Daumesnil 75012 Paris',
          street: '24 Avenue Daumesnil',
          city: 'Paris',
          zipCode: '75012',
          location: { type: 'Point', coordinates: [2.37345, 48.848024] },
        },
      },
      course: { subProgram: { program: { name: 'Test' } } },
      mainFee: { price: 1000, count: 1, description: 'description' },
    };

    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 200, height: 42, alignment: 'right' },
            {
              stack: [
                { text: 'Facture', fontSize: 32 },
                { text: 'FACT-000045', bold: true },
                { text: 'Date de facture : 18/08/1998' },
              ],
              alignment: 'right',
            },
          ],
          marginBottom: 4,
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 200, h: 42, r: 0, fillOpacity: 0.5, color: 'white' }],
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
        {
          columns: [
            {
              stack: [
                { text: 'Facturée à' },
                { text: 'payeur', bold: true },
                { text: '24 Avenue Daumesnil' },
                { text: '75012 Paris' },
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
                { text: 'Quantité', style: 'header', alignment: 'center' },
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
            { text: 'Sous-total', alignment: 'right' },
            { text: '1000,00 €', alignment: 'right', marginLeft: 22, marginRight: 4, width: 'auto' },
          ],
        },
        {
          text: 'Merci de lire attentivement nos Conditions Générales de Prestations et le(s) programme(s) de '
            + 'formation en pièce-jointe.\nEn tant qu’organisme de formation, Compani est exonéré de la Taxe sur la '
            + 'Valeur Ajoutée (TVA).',
          fontSize: 8,
          marginTop: 48,
        },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 12 },
      styles: {
        marginRightLarge: { marginRight: 40 },
        header: { fillColor: COPPER_600, color: 'white' },
        description: { alignment: 'left', marginLeft: 8, fontSize: 10 },
      },
    };
    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
    ];

    downloadImages.returns(paths);
    formatPrice.onCall(0).returns('1000,00 €');
    formatPrice.onCall(1).returns('1000,00 €');
    formatPrice.onCall(2).returns('1000,00 €');

    const result = await CourseBill.getPdfContent(bill);

    expect(JSON.stringify(result)).toEqual(JSON.stringify(pdf));
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});
