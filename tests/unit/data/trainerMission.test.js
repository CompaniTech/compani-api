const sinon = require('sinon');
const { expect } = require('expect');
const FileHelper = require('../../../src/helpers/file');
const PdfHelper = require('../../../src/helpers/pdf');
const UtilsHelper = require('../../../src/helpers/utils');
const TrainerMission = require('../../../src/data/pdf/trainerMission');
const { INTRA, MRS } = require('../../../src/helpers/constants');
const UtilsMock = require('../../utilsMock');

describe('getPdfContent', () => {
  let downloadImages;
  let formatPrice;

  beforeEach(() => {
    downloadImages = sinon.stub(FileHelper, 'downloadImages');
    formatPrice = sinon.stub(UtilsHelper, 'formatPrice');
    UtilsMock.mockCurrentDate('2022-09-18T10:00:00.000Z');
  });

  afterEach(() => {
    downloadImages.restore();
    formatPrice.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('it should format and return pdf content', async () => {
    const paths = ['src/data/pdf/tmp/compani.png', 'src/data/pdf/tmp/signature.png'];
    downloadImages.returns(paths);
    formatPrice.onCall(0).returns('1200,00 €');

    const data = {
      trainerIdentity: { lastname: 'For', firstname: 'Matrice', title: MRS },
      program: 'Bien manger',
      slotsCount: 3,
      liveDuration: '6h30',
      groupCount: 2,
      companies: 'Alenvi, ASAPAD',
      addressList: ['3 rue du château', '4 rue du château'],
      dates: ['12/12/2023', '13/12/2023', '14/12/2023', '15/12/2023', '16/12/2023'],
      slotsToPlan: 2,
      certification: [
        {
          misc: 'Groupe 1',
          type: INTRA,
          companies: [{ name: 'ASAPAD' }],
          tradeName: 'Bien manger',
          subProgram: { program: { name: 'Bien manger' } },
        },
      ],
      fee: 1200,
      createdBy: 'John DOE',
    };

    const result = await TrainerMission.getPdfContent(data);

    const header = [
      { image: paths[0], width: 154, height: 32, alignment: 'right', marginBottom: 24, opacity: 0.5 },
      { text: 'ORDRE DE MISSION', alignment: 'center', fontSize: 24, bold: true, marginBottom: 24 },
    ];

    const table = [
      {
        table:
        {
          body:
          [
            [{ text: 'Prénom et NOM' }, { text: 'Matrice FOR', style: 'cell' }],
            [{ text: 'Fonction' }, { text: 'Formatrice', style: 'cell' }],
            [{ text: 'Se rendra à la formation suivante' }, { text: 'Bien manger', style: 'cell' }],
            [{ text: 'Durée de la formation' }, { text: '3 sessions - 6h30', style: 'cell' }],
            [{ text: 'Nombre de groupes' }, { text: 2, style: 'cell' }],
            [{ text: 'Structures' }, { text: 'Alenvi, ASAPAD', style: 'cell' }],
            [{ text: 'Lieux de la formation' }, { text: '3 rue du château, 4 rue du château', style: 'cell' }],
            [
              { text: 'Dates de la formation' },
              {
                text: '12/12/2023, 13/12/2023, 14/12/2023, 15/12/2023, 16/12/2023\n2 créneaux encore à définir',
                style: 'cell',
              },
            ],
            [
              { text: 'Formation certifiante ?' },
              { text: 'au moins un(e) stagiaire de ASAPAD - Bien manger - Groupe 1', style: 'cell' },
            ],
            [{ text: 'Frais de formateurs prévus' }, { text: '1200,00 €', style: 'cell' }],
          ],
          widths: ['*', '*'],
          dontBreakRows: true,
        },
        marginBottom: 8,
      },
    ];

    const footer = [
      {
        stack: [
          { text: 'Fait à Paris,', alignment: 'right' },
          { text: 'Le 18/09/2022', alignment: 'right' },
          { text: 'John DOE', alignment: 'right' },
          { image: paths[1], width: 144, marginTop: 8, alignment: 'right' },
        ],
        unbreakable: true,
        marginLeft: 40,
        marginRight: 40,
      },
    ];

    const pdf = {
      content: [header, table].flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 14 },
      pageMargins: [40, 40, 40, 200],
      styles: { cell: { margin: [4, 4, 4, 12] } },
      footer,
    };
    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
    ];
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});

describe('getPdf', () => {
  let getPdfContent;
  let generatePdf;

  beforeEach(() => {
    getPdfContent = sinon.stub(TrainerMission, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    getPdfContent.restore();
    generatePdf.restore();
  });

  it('should get pdf', async () => {
    const data = {
      trainerIdentity: { lastname: 'For', firstname: 'Matrice' },
      program: 'program',
      slotsCount: 3,
      liveDuration: '6h30',
      groupCount: 2,
      companies: 'Alenvi, ASAPAD',
      addressList: ['Paris'],
      dates: ['12/12/2023', '13/12/2023', '14/12/2023', '15/12/2023', '16/12/2023'],
      slotsToPlan: 1,
      certification: [{ type: INTRA, companies: [{ name: 'Alenvi' }], misc: 'test' }],
      fee: 1200,
      createdBy: 'John DOE',
    };
    const template = {
      content: [{
        table: [
          [{ text: 'Prénom et NOM' }, { text: 'Jean Dors', style: 'cell' }],
        ],
      }],
      defaultStyle: { font: 'SourceSans', fontSize: 14 },
      pageMargins: [40, 40, 40, 200],
      styles: { cell: { margin: [4, 4, 4, 12] } },
    };
    const images = [
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
    ];
    getPdfContent.returns({ template, images });
    generatePdf.returns('pdf');

    const result = await TrainerMission.getPdf(data);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });
});
