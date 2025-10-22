const sinon = require('sinon');
const { expect } = require('expect');
const FileHelper = require('../../../src/helpers/file');
const PdfHelper = require('../../../src/helpers/pdf');
const TrainingContract = require('../../../src/data/pdf/trainingContract');
const { COPPER_600, COPPER_100, INTRA, INTER_B2B } = require('../../../src/helpers/constants');

describe('getPdfContent', () => {
  let downloadImages;

  beforeEach(() => {
    downloadImages = sinon.stub(FileHelper, 'downloadImages');
  });

  afterEach(() => {
    downloadImages.restore();
  });

  it('it should format and return pdf content (intra + several address + elearningDuration)', async () => {
    const paths = ['src/data/pdf/tmp/compani.png', 'src/data/pdf/tmp/signature.png'];
    downloadImages.returns(paths);

    const data = {
      type: INTRA,
      vendorCompany: {
        name: 'Compani',
        address: { fullAddress: '12 rue Daumesnil 75012 Paris' },
        siret: '91234395805325',
        activityDeclarationNumber: '12345678909',
      },
      company: { name: 'Alenvi', address: '12 rue de ponthieu 75008 Paris' },
      programName: 'Programme',
      learningGoals: 'bien apprendre',
      slotsCount: 3,
      liveDuration: '6h',
      eLearningDuration: '2h',
      misc: 'Groupe 1',
      learnersCount: 8,
      learnersName: 'Charles LECLERC, Lewis HAMILTON',
      dates: ['03/11/2020', '04/11/2020', '05/11/2020'],
      addressList: ['14 rue de ponthieu 75008 Paris', '22 avenue Daumesnil 75012 Paris'],
      trainers: ['Jean BONBEUR', 'James PENCIL'],
      price: 12,
    };

    const result = await TrainingContract.getPdfContent(data);

    const header = [
      { image: paths[0], width: 154, height: 32, alignment: 'right', marginBottom: 24, opacity: 0.5 },
      { text: 'CONVENTION DE FORMATION', alignment: 'center', fontSize: 24, bold: true, marginBottom: 24 },
      {
        stack: [
          { text: 'Entre l\'organisme de formation', color: COPPER_600 },
          { text: 'Compani', bold: true },
          { text: '12 rue Daumesnil 75012 Paris' },
          { text: 'SIRET : 912 343 958 05325' },
          { text: 'Numéro de déclaration d\'activité : 12345678909' },
        ],
        marginBottom: 16,
      },
      {
        stack: [
          { text: 'Et', color: COPPER_600 },
          { text: 'Alenvi' },
          { text: '12 rue de ponthieu 75008 Paris' },
        ],
        marginBottom: 20,
      },
    ];

    const table = [
      {
        table:
        {
          body:
          [
            [
              {
                stack: [
                  { text: data.programName, bold: true },
                  { stack: [{ text: 'Objectifs :' }, { text: 'bien apprendre', marginLeft: 16 }] },
                  { text: 'Durée : 3 créneaux - 6h (+ 2h de e-learning)' },
                  { text: 'Effectif formé : Charles LECLERC, Lewis HAMILTON' },
                  { text: 'Dates : 03/11/2020 - 04/11/2020 - 05/11/2020' },
                  {
                    stack: [
                      { text: 'Lieux : ' },
                      { text: '- 14 rue de ponthieu 75008 Paris', marginLeft: 8 },
                      { text: '- 22 avenue Daumesnil 75012 Paris', marginLeft: 8 },
                    ],
                  },
                  { text: 'Intervenant·es : Jean BONBEUR, James PENCIL', marginBottom: 16 },
                  { text: 'Prix total TTC : 12 €' },
                  { text: '(Ce prix comprend les frais de formateurs)', italics: true },
                  {
                    text:
                      'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA).',
                    italics: true,
                    fontSize: 8,
                  },
                ],
                margin: 16,
              },
            ],
          ],
          widths: ['100%'],
        },
        layout: { vLineWidth: () => 0, hLineWidth: () => 0, fillColor: COPPER_100 },
      },
    ];

    const footer = [
      {
        columns: [
          {
            stack: [
              { text: 'Compani', color: COPPER_600 },
              { text: 'Thibault de Saint Blancard, Directeur général de Compani' },
              { image: paths[1], width: 132, marginTop: 8 },
            ],
          },
          {
            stack: [
              { text: 'Le client', color: COPPER_600 },
              { text: 'Votre signature implique l\'acceptation des annexes 1 et 2', italics: true },
              { text: 'Prénom + Nom, poste et cachet de la structure', fontSize: 8 },
            ],
          },
        ],
        unbreakable: true,
        marginLeft: 40,
        marginRight: 40,
      },

    ];

    const pdf = {
      content: [header, table].flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 12 },
      pageMargins: [40, 40, 40, 160],
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

  it('it should format and return pdf content (inter + single address + no elearningDuration)', async () => {
    const paths = ['src/data/pdf/tmp/compani.png', 'src/data/pdf/tmp/signature.png'];
    downloadImages.returns(paths);

    const data = {
      type: INTER_B2B,
      vendorCompany: {
        name: 'Compani',
        address: { fullAddress: '12 rue Daumesnil 75012 Paris' },
        siret: '91234395805325',
        activityDeclarationNumber: '12345678909',
      },
      company: { name: 'Alenvi', address: '12 rue de ponthieu 75008 Paris' },
      programName: 'Programme',
      learningGoals: 'bien apprendre',
      slotsCount: 3,
      liveDuration: '6h',
      eLearningDuration: '',
      misc: 'Groupe 1',
      learnersCount: 8,
      learnersName: 'Charles LECLERC, Lewis HAMILTON',
      dates: ['03/11/2020', '04/11/2020', '05/11/2020'],
      addressList: ['Paris'],
      trainers: ['Jean BONBEUR'],
      price: 12,
    };

    const result = await TrainingContract.getPdfContent(data);

    const header = [
      { image: paths[0], width: 154, height: 32, alignment: 'right', marginBottom: 24, opacity: 0.5 },
      { text: 'CONVENTION DE FORMATION', alignment: 'center', fontSize: 24, bold: true, marginBottom: 24 },
      {
        stack: [
          { text: 'Entre l\'organisme de formation', color: COPPER_600 },
          { text: 'Compani', bold: true },
          { text: '12 rue Daumesnil 75012 Paris' },
          { text: 'SIRET : 912 343 958 05325' },
          { text: 'Numéro de déclaration d\'activité : 12345678909' },
        ],
        marginBottom: 16,
      },
      {
        stack: [
          { text: 'Et', color: COPPER_600 },
          { text: 'Alenvi' },
          { text: '12 rue de ponthieu 75008 Paris' },
        ],
        marginBottom: 20,
      },
    ];

    const table = [
      {
        table: {
          body: [
            [
              {
                stack: [
                  { text: data.programName, bold: true },
                  { stack: [{ text: 'Objectifs :' }, { text: 'bien apprendre', marginLeft: 16 }] },
                  { text: 'Durée : 3 créneaux - 6h' },
                  { text: 'Effectif formé : Charles LECLERC, Lewis HAMILTON' },
                  { text: 'Dates : 03/11/2020 - 04/11/2020 - 05/11/2020' },
                  { text: 'Lieu : Paris' },
                  { text: 'Intervenant·e : Jean BONBEUR', marginBottom: 16 },
                  { text: 'Prix TTC par stagiaire : 12 €' },
                  { text: 'Prix total TTC : 96 €' },
                  { text: '(Ce prix comprend les frais de formateurs)', italics: true },
                  {
                    text:
                      'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA).',
                    italics: true,
                    fontSize: 8,
                  },
                ],
                margin: 16,
              },
            ],
          ],
          widths: ['100%'],
        },
        layout: { vLineWidth: () => 0, hLineWidth: () => 0, fillColor: COPPER_100 },
      },
    ];

    const footer = [
      {
        columns: [
          {
            stack: [
              { text: 'Compani', color: COPPER_600 },
              { text: 'Thibault de Saint Blancard, Directeur général de Compani' },
              { image: paths[1], width: 132, marginTop: 8 },
            ],
          },
          {
            stack: [
              { text: 'Le client', color: COPPER_600 },
              { text: 'Votre signature implique l\'acceptation des annexes 1 et 2', italics: true },
              { text: 'Prénom + Nom, poste et cachet de la structure', fontSize: 8 },
            ],
          },
        ],
        unbreakable: true,
        marginLeft: 40,
        marginRight: 40,
      },

    ];

    const pdf = {
      content: [header, table].flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 12 },
      pageMargins: [40, 40, 40, 160],
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
    getPdfContent = sinon.stub(TrainingContract, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    getPdfContent.restore();
    generatePdf.restore();
  });

  it('should get pdf', async () => {
    const data = {
      vendorCompany: {
        name: 'Compani',
        address: { fullAddress: '12 rue Daumesnil 75012 Paris' },
        siret: '91234395805325',
        activityDeclarationNumber: '12345678909',
      },
      company: { name: 'Alenvi', address: '12 rue de ponthieu 75008 Paris' },
      programName: 'Programme',
      learningGoals: 'bien apprendre',
      slotsCount: 3,
      liveDuration: '6h',
      eLearningDuration: '2h',
      misc: 'Test',
      learnersCount: 8,
      dates: ['03/11/2020', '04/11/2020', '05/11/2020'],
      addressList: ['14 rue de ponthieu 75008 Paris', '22 avenue Daumesnil 75012 Paris'],
      trainers: ['Jean BONBEUR', 'james PENCIL'],
      price: 12,
    };
    const template = {
      content: [{
        stack: [
          { text: 'Objectifs :' },
          { text: 'bien apprendre', marginLeft: 16 },
        ],
      }],
      defaultStyle: { font: 'SourceSans', fontSize: 12 },
      pageMargins: [40, 40, 40, 160],
    };
    const images = [{ url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'logo.png' }];
    getPdfContent.returns({ template, images });
    generatePdf.returns('pdf');

    const result = await TrainingContract.getPdf(data);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });
});
