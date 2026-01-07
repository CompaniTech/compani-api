const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const FileHelper = require('../../../src/helpers/file');
const PdfHelper = require('../../../src/helpers/pdf');
const CompletionCertificate = require('../../../src/data/pdf/completionCertificate');
const { COPPER_50, COPPER_500, ORANGE_500, OFFICIAL } = require('../../../src/helpers/constants');

describe('getCustomPdfContent', () => {
  let downloadImages;
  const traineeId = new ObjectId();

  beforeEach(() => {
    downloadImages = sinon.stub(FileHelper, 'downloadImages');
  });

  afterEach(() => {
    downloadImages.restore();
  });

  it('it should format and return custom pdf content with eLearning steps', async () => {
    const paths = [
      'src/data/pdf/tmp/aux-pouce.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/aux-eclaire.png',
      'src/data/pdf/tmp/smiling-emoji.png',
      'src/data/pdf/tmp/signature.png',
    ];
    downloadImages.returns(paths);

    const data = {
      duration: { [traineeId]: { onSite: '15h', total: '18h' }, eLearning: '3h' },
      learningGoals: '- but',
      programName: 'Programme',
      startDate: '25/12/2021',
      endDate: '25/02/2022',
      trainee: {
        _id: traineeId,
        identity: 'Jean ALAIN',
        attendanceDuration: '14h',
        eLearningDuration: '1h',
        totalDuration: '15h',
      },
      date: '22/03/2022',
    };

    const result = await CompletionCertificate.getCustomPdfContent(data);

    const header = {
      columns: [
        { image: paths[0], width: 64 },
        [
          { image: paths[1], width: 200, height: 42, alignment: 'right' },
          { text: 'Attestation individuelle de formation', style: 'title' },
        ],
      ],
      marginBottom: 20,
    };

    const body = [
      { text: 'Félicitations, vous avez terminé votre formation !', style: 'congratulations' },
      {
        columns: [
          { text: 'COMPANI est ravi de vous avoir accompagné et d\'avoir partagé ces moments ensemble', width: 'auto' },
          { image: paths[3], width: 10, height: 10, marginLeft: 2 },
        ],
        marginBottom: 8,
      },
      {
        text: [
          'Je soussigné Thibault de Saint Blancard, représentant de l\'organisme de formation ',
          { text: 'COMPANI', bold: true },
          ', atteste que ',
          { text: 'Jean ALAIN', italics: true },
          ' a participé à la formation :',
        ],
        marginBottom: 16,
      },
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 24, r: 0, color: COPPER_50 }],
        absolutePosition: { x: 40, y: 240 },
        marginBottom: 8,
      },
      { text: 'Programme', style: 'programName' },
      {
        text: [
          { text: 'Durée', decoration: 'underline' },
          ' : 18h de formation du ',
          { text: '25/12/2021 au 25/02/2022', color: COPPER_500 },
        ],
      },
      { image: paths[2], width: 128, height: 118, absolutePosition: { x: 450, y: 292 } },
      {
        text: [
          { text: 'Type d\'action de formation', decoration: 'underline' },
          { text: ' : Accompagnement dans le développement de compétences', italics: true },
        ],
      },
      {
        table: {
          body: [
            [{ text: 'Assiduité du stagiaire :', style: 'subTitle' }],
            [{
              text: [
                { text: 'Jean ALAIN', italics: true },
                ' a été présent(e) à ',
                { text: '15h', bold: true },
                ' de formation (dont ',
                { text: '14h en présentiel ', bold: true },
                'et ',
                { text: '1h en e-learning) ', bold: true },
                'sur les ',
                { text: '18h prévues.', bold: true },
              ],
            }],
            [{ text: 'Objectifs pédagogiques :', style: 'subTitle' }],
            [{
              text: [
                'À l\'issue de cette formation, ',
                { text: 'Jean ALAIN', italics: true },
                ' est capable de : ',
              ],
            }],
            [{ text: '- but', color: COPPER_500 }],
            [{ text: 'Résultats de l’évaluation des acquis :', style: 'subTitle' }],
            [{
              text: [
                'Les compétences et connaissances partagées lors de la formation ont été acquises par ',
                { text: 'Jean ALAIN', italics: true },
                { text: ' et validées par un quiz d’acquisition de connaissances.' },
              ],
              marginBottom: 32,
            }],
          ],
          widths: ['75%'],
        },
        layout: { vLineWidth: () => 0, hLineWidth: () => 0 },
      },
    ];

    const pdf = {
      content: [header, body].flat(),
      defaultStyle: { font: 'Calibri', fontSize: 11 },
      pageMargins: [40, 40, 40, 220],
      styles: {
        title: { fontSize: 18, bold: true, color: COPPER_500, marginLeft: 48, marginTop: 16 },
        congratulations: { fontSize: 11, bold: true, color: ORANGE_500, marginBottom: 24 },
        subTitle: { fontSize: 16, color: COPPER_500, marginTop: 16 },
        programName: { fontSize: 12, alignment: 'center', color: COPPER_500, marginBottom: 16 },
      },
      footer(currentPage, pageCount) {
        const style = { fontSize: 9, bold: true };
        return {
          stack: [
            { text: 'Fait à Paris, le 22/03/2022' },
            { text: 'Thibault de Saint Blancard, Directeur Compani' },
            { image: paths[4], width: 120, marginBottom: 24 },
            { text: 'Compani', style },
            { text: '24 avenue Daumesnil, 75012 Paris', style },
            { text: 'Numéro SIRET : 90512399800015 | Numéro de déclaration d’activité : 11756363475', style },
            { text: `PAGE ${currentPage.toString()} / ${pageCount}`, style, alignment: 'right' },
          ],
          marginLeft: 40,
          marginRight: 40,
          marginTop: 8,
        };
      },
    };
    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/aux-eclaire.png', name: 'aux-eclaire.png' },
      { url: 'https://storage.googleapis.com/compani-main/smiling-emoji.png', name: 'smiling-emoji.png' },
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
    ];
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('it should format and return custom pdf content without eLearning steps', async () => {
    const paths = [
      'src/data/pdf/tmp/aux-pouce.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/aux-eclaire.png',
      'src/data/pdf/tmp/smiling-emoji.png',
      'src/data/pdf/tmp/signature.png',
    ];
    downloadImages.returns(paths);

    const data = {
      duration: { [traineeId]: { onSite: '15h', total: '15h' }, eLearning: '0h' },
      learningGoals: '- but',
      programName: 'Programme',
      startDate: '25/12/2021',
      endDate: '25/02/2022',
      trainee: {
        _id: traineeId,
        identity: 'Jean ALAIN',
        attendanceDuration: '14h',
        eLearningDuration: '0h',
        totalDuration: '14h',
      },
      date: '22/03/2022',
    };

    const result = await CompletionCertificate.getCustomPdfContent(data);

    const header = {
      columns: [
        { image: paths[0], width: 64 },
        [
          { image: paths[1], width: 200, height: 42, alignment: 'right' },
          { text: 'Attestation individuelle de formation', style: 'title' },
        ],
      ],
      marginBottom: 20,
    };

    const body = [
      { text: 'Félicitations, vous avez terminé votre formation !', style: 'congratulations' },
      {
        columns: [
          { text: 'COMPANI est ravi de vous avoir accompagné et d\'avoir partagé ces moments ensemble', width: 'auto' },
          { image: paths[3], width: 10, height: 10, marginLeft: 2 },
        ],
        marginBottom: 8,
      },
      {
        text: [
          'Je soussigné Thibault de Saint Blancard, représentant de l\'organisme de formation ',
          { text: 'COMPANI', bold: true },
          ', atteste que ',
          { text: 'Jean ALAIN', italics: true },
          ' a participé à la formation :',
        ],
        marginBottom: 16,
      },
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 24, r: 0, color: COPPER_50 }],
        absolutePosition: { x: 40, y: 240 },
        marginBottom: 8,
      },
      { text: 'Programme', style: 'programName' },
      {
        text: [
          { text: 'Durée', decoration: 'underline' },
          ' : 15h de formation en présentiel du ',
          { text: '25/12/2021 au 25/02/2022', color: COPPER_500 },
        ],
      },
      { image: paths[2], width: 128, height: 118, absolutePosition: { x: 450, y: 292 } },
      {
        text: [
          { text: 'Type d\'action de formation', decoration: 'underline' },
          { text: ' : Accompagnement dans le développement de compétences', italics: true },
        ],
      },
      {
        table: {
          body: [
            [{ text: 'Assiduité du stagiaire :', style: 'subTitle' }],
            [{
              text: [
                { text: 'Jean ALAIN', italics: true },
                ' a été présent(e) à ',
                { text: '14h', bold: true },
                ' de formation en présentiel sur les ',
                { text: '15h prévues.', bold: true },
              ],
            }],
            [{ text: 'Objectifs pédagogiques :', style: 'subTitle' }],
            [{
              text: [
                'À l\'issue de cette formation, ',
                { text: 'Jean ALAIN', italics: true },
                ' est capable de : ',
              ],
            }],
            [{ text: '- but', color: COPPER_500 }],
            [{ text: 'Résultats de l’évaluation des acquis :', style: 'subTitle' }],
            [{
              text: [
                'Les compétences et connaissances partagées lors de la formation ont été acquises par ',
                { text: 'Jean ALAIN', italics: true },
                { text: ' et validées par un quiz d’acquisition de connaissances.' },
              ],
              marginBottom: 32,
            }],
          ],
          widths: ['75%'],
        },
        layout: { vLineWidth: () => 0, hLineWidth: () => 0 },
      },
    ];

    const pdf = {
      content: [header, body].flat(),
      defaultStyle: { font: 'Calibri', fontSize: 11 },
      pageMargins: [40, 40, 40, 220],
      styles: {
        title: { fontSize: 18, bold: true, color: COPPER_500, marginLeft: 48, marginTop: 16 },
        congratulations: { fontSize: 11, bold: true, color: ORANGE_500, marginBottom: 24 },
        subTitle: { fontSize: 16, color: COPPER_500, marginTop: 16 },
        programName: { fontSize: 12, alignment: 'center', color: COPPER_500, marginBottom: 16 },
      },
      footer(currentPage, pageCount) {
        const style = { fontSize: 9, bold: true };
        return {
          stack: [
            { text: 'Fait à Paris, le 22/03/2022' },
            { text: 'Thibault de Saint Blancard, Directeur Compani' },
            { image: paths[4], width: 120, marginBottom: 24 },
            { text: 'Compani', style },
            { text: '24 avenue Daumesnil, 75012 Paris', style },
            { text: 'Numéro SIRET : 90512399800015 | Numéro de déclaration d’activité : 11756363475', style },
            { text: `PAGE ${currentPage.toString()} / ${pageCount}`, style, alignment: 'right' },
          ],
          marginLeft: 40,
          marginRight: 40,
          marginTop: 8,
        };
      },
    };
    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/aux-eclaire.png', name: 'aux-eclaire.png' },
      { url: 'https://storage.googleapis.com/compani-main/smiling-emoji.png', name: 'smiling-emoji.png' },
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
    ];
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});

describe('getOfficialPdfContent', () => {
  let downloadImages;
  const traineeId = new ObjectId();

  beforeEach(() => {
    downloadImages = sinon.stub(FileHelper, 'downloadImages');
  });

  afterEach(() => downloadImages.restore());

  it('should format and return official pdf content with eLearning steps', async () => {
    const data = {
      duration: { [traineeId]: { onSite: '15h', total: '20h' }, eLearning: '5h' },
      programName: 'Programme',
      startDate: '25/12/2021',
      endDate: '25/02/2022',
      trainee: {
        _id: traineeId,
        identity: 'Jean PHILIPPE',
        attendanceDuration: '14h',
        companyName: 'structure',
        eLearningDuration: '2h',
        totalDuration: '16h',
      },
      date: '22/03/2022',
    };

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/logo_ministere_travail.png', name: 'ministere_travail.png' },
    ];

    const paths = [
      'src/data/pdf/tmp/signature.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/ministere_travail.png',
    ];
    downloadImages.returns(paths);

    const result = await CompletionCertificate.getOfficialPdfContent(data);

    const header = [
      { columns: [{ image: paths[2], width: 60 }, {}, { image: paths[1], width: 130 }], marginBottom: 24 },
      { text: 'CERTIFICAT DE RÉALISATION', style: 'title', alignment: 'center', marginBottom: 24 },
    ];

    const checkBoxSection = [
      // Checkbox 1
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 306 } },
      {
        text: [
          { text: '√', position: { x: 59, y: 306 }, marginRight: 4 },
          { text: [{ text: ' action de formation' }, { text: ' 1', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 20,
      },
      // Checkbox 2
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 324 } },
      {
        text: [
          { text: '', position: { x: 59, y: 324 }, marginRight: 4 },
          { text: [{ text: ' bilan de compétences' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 3
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 343 } },
      {
        text: [
          { text: '', position: { x: 59, y: 343 }, marginRight: 4 },
          { text: [{ text: ' action de VAE' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 4
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 361 } },
      {
        text: [
          { text: '', position: { x: 59, y: 361 }, marginRight: 4 },
          { text: [{ text: ' action de formation par apprentissage' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 5
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 380 } },
      {
        text: [
          { text: '', position: { x: 59, y: 380 }, marginRight: 4 },
          { text: [{ text: ' action de VAE Inversée' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
    ];

    const body = [
      {
        text: [
          { text: 'Je soussigné ', bold: true },
          { text: 'Thibault de Saint Blancard ', italics: true },
          {
            text: 'représentant légal du dispensateur de l\'action concourant au développement des compétences ',
            bold: true,
          },
          { text: 'COMPANI', italics: true },
        ],
      },
      { text: 'atteste que :', bold: true, marginTop: 4, marginBottom: 8 },
      {
        text: [{ text: 'Mme/M. ', bold: true }, { text: 'Jean PHILIPPE', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'salarié(e) de l\'entreprise ', bold: true }, { text: 'structure', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'a suivi l\'action ', bold: true }, { text: 'Programme', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'Nature de l\'action concourant au développement des compétences :', bold: true }],
        marginLeft: 4,
        marginBottom: 4,
      },
      ...checkBoxSection,
      {
        text: [
          { text: 'qui s\'est déroulée du ', bold: true },
          { text: '25/12/2021 ', italics: true },
          { text: 'au ', bold: true },
          { text: '25/02/2022', italics: true },
        ],
        marginLeft: 4,
        marginBottom: 8,
        marginTop: 4,
      },
      {
        text: [
          {
            text: [
              { text: 'pour une durée de ', bold: true },
              {
                text: '16h en formation (dont 14h en présentiel et 2h en e-learning) sur 20h prévues. ',
                italics: true,
              },
            ],
          },
          { text: '2', fontSize: 8, bold: true },
        ],
        marginBottom: 8,
        marginLeft: 4,
      },
      {
        text: 'Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m\'engage à '
        + 'conserver l\'ensemble des pièces justificatives qui ont permis d\'établir le présent certificat pendant une '
        + 'durée de 3 ans à compter de la fin de l\'année du dernier paiement. En cas de cofinancement des fonds '
        + 'européens la durée de conservation est étendue conformément aux obligations conventionnelles spécifiques.',
        alignment: 'justify',
      },
    ];

    const footer = [
      {
        columns: [
          [
            {
              text: [{ text: 'Fait à : ', bold: true }, { text: 'Paris', italics: true }],
              absolutePosition: { x: 35, y: 550 },
              marginLeft: 46,
            },
            {
              text: [{ text: 'Le : ', bold: true }, { text: '22/03/2022', italics: true }],
              absolutePosition: { x: 35, y: 570 },
              marginLeft: 46,
            },
          ],
          [
            {
              canvas: [{ type: 'rect', x: 0, y: 0, w: 250, h: 160, r: 0 }],
              absolutePosition: { y: 555 },
              alignment: 'right',
            },
            {
              text: 'Cachet et signature du responsable du \n dispensateur de formation',
              marginTop: 6,
              alignment: 'center',
              fontSize: 10,
            },
            {
              text: 'Thibault de Saint Blancard, Directeur Compani',
              bold: true,
              marginTop: 6,
              alignment: 'center',
              fontSize: 10,
            },
            { image: paths[0], width: 125, absolutePosition: { x: 380, y: 618 } },
          ],
        ],
        marginLeft: 40,
        marginRight: 40,
        absolutePosition: { x: 37, y: 565 },
      },
      {
        text: [
          { text: '1 ', fontSize: 8 },
          {
            text: 'Lorsque l\'action est mise en œuvre dans le cadre d\'un projet de transition professionnelle, '
              + 'le certificat de réalisation doit être transmis mensuellement. \n',
          },
          { text: '2 ', fontSize: 8 },
          {
            text: 'Dans le cadre des formations à distance prendre en compte la réalisation des activités pédagogiques '
                + 'et le temps estimé pour les réaliser.',
          },
        ],
        absolutePosition: { x: 37, y: 755 },
        marginLeft: 40,
        marginRight: 40,
        marginTop: 8,
        fontSize: 11,
      },
    ];

    const pdf = {
      content: [header, body, footer].flat(),
      defaultStyle: { font: 'Calibri', fontSize: 14 },
      pageMargins: [40, 40, 40, 40],
      styles: { title: { fontSize: 24, bold: true, color: '#0404B4' } },
    };
    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);

    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('should format and return official pdf content without eLearning steps', async () => {
    const data = {
      duration: { [traineeId]: { onSite: '15h', total: '15h' }, eLearning: '0h' },
      programName: 'Programme',
      startDate: '25/12/2021',
      endDate: '25/02/2022',
      trainee: {
        _id: traineeId,
        identity: 'Jean PHILIPPE',
        attendanceDuration: '14h',
        companyName: 'structure',
        eLearningDuration: '0h',
      },
      date: '22/03/2022',
    };

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/logo_ministere_travail.png', name: 'ministere_travail.png' },
    ];

    const paths = [
      'src/data/pdf/tmp/signature.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/ministere_travail.png',
    ];
    downloadImages.returns(paths);

    const result = await CompletionCertificate.getOfficialPdfContent(data);

    const header = [
      { columns: [{ image: paths[2], width: 60 }, {}, { image: paths[1], width: 130 }], marginBottom: 24 },
      { text: 'CERTIFICAT DE RÉALISATION', style: 'title', alignment: 'center', marginBottom: 24 },
    ];

    const checkBoxSection = [
      // Checkbox 1
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 306 } },
      {
        text: [
          { text: '√', position: { x: 59, y: 306 }, marginRight: 4 },
          { text: [{ text: ' action de formation' }, { text: ' 1', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 20,
      },
      // Checkbox 2
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 324 } },
      {
        text: [
          { text: '', position: { x: 59, y: 324 }, marginRight: 4 },
          { text: [{ text: ' bilan de compétences' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 3
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 343 } },
      {
        text: [
          { text: '', position: { x: 59, y: 343 }, marginRight: 4 },
          { text: [{ text: ' action de VAE' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 4
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 361 } },
      {
        text: [
          { text: '', position: { x: 59, y: 361 }, marginRight: 4 },
          { text: [{ text: ' action de formation par apprentissage' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 5
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 380 } },
      {
        text: [
          { text: '', position: { x: 59, y: 380 }, marginRight: 4 },
          { text: [{ text: ' action de VAE Inversée' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
    ];

    const body = [
      {
        text: [
          { text: 'Je soussigné ', bold: true },
          { text: 'Thibault de Saint Blancard ', italics: true },
          {
            text: 'représentant légal du dispensateur de l\'action concourant au développement des compétences ',
            bold: true,
          },
          { text: 'COMPANI', italics: true },
        ],
      },
      { text: 'atteste que :', bold: true, marginTop: 4, marginBottom: 8 },
      {
        text: [{ text: 'Mme/M. ', bold: true }, { text: 'Jean PHILIPPE', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'salarié(e) de l\'entreprise ', bold: true }, { text: 'structure', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'a suivi l\'action ', bold: true }, { text: 'Programme', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'Nature de l\'action concourant au développement des compétences :', bold: true }],
        marginLeft: 4,
        marginBottom: 4,
      },
      ...checkBoxSection,
      {
        text: [
          { text: 'qui s\'est déroulée du ', bold: true },
          { text: '25/12/2021 ', italics: true },
          { text: 'au ', bold: true },
          { text: '25/02/2022', italics: true },
        ],
        marginLeft: 4,
        marginBottom: 8,
        marginTop: 4,
      },
      {
        text: [
          {
            text: [
              { text: 'pour une durée de ', bold: true },
              { text: '14h en formation présentielle sur 15h prévues. ', italics: true },
            ],
          },
          { text: '2', fontSize: 8, bold: true },
        ],
        marginBottom: 8,
        marginLeft: 4,
      },
      {
        text: 'Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m\'engage à '
        + 'conserver l\'ensemble des pièces justificatives qui ont permis d\'établir le présent certificat pendant une '
        + 'durée de 3 ans à compter de la fin de l\'année du dernier paiement. En cas de cofinancement des fonds '
        + 'européens la durée de conservation est étendue conformément aux obligations conventionnelles spécifiques.',
        alignment: 'justify',
      },
    ];

    const footer = [
      {
        columns: [
          [
            {
              text: [{ text: 'Fait à : ', bold: true }, { text: 'Paris', italics: true }],
              absolutePosition: { x: 35, y: 550 },
              marginLeft: 46,
            },
            {
              text: [{ text: 'Le : ', bold: true }, { text: '22/03/2022', italics: true }],
              absolutePosition: { x: 35, y: 570 },
              marginLeft: 46,
            },
          ],
          [
            {
              canvas: [{ type: 'rect', x: 0, y: 0, w: 250, h: 160, r: 0 }],
              absolutePosition: { y: 555 },
              alignment: 'right',
            },
            {
              text: 'Cachet et signature du responsable du \n dispensateur de formation',
              marginTop: 6,
              alignment: 'center',
              fontSize: 10,
            },
            {
              text: 'Thibault de Saint Blancard, Directeur Compani',
              bold: true,
              marginTop: 6,
              alignment: 'center',
              fontSize: 10,
            },
            { image: paths[0], width: 125, absolutePosition: { x: 380, y: 618 } },
          ],
        ],
        marginLeft: 40,
        marginRight: 40,
        absolutePosition: { x: 37, y: 565 },
      },
      {
        text: [
          { text: '1 ', fontSize: 8 },
          {
            text: 'Lorsque l\'action est mise en œuvre dans le cadre d\'un projet de transition professionnelle, '
              + 'le certificat de réalisation doit être transmis mensuellement. \n',
          },
          { text: '2 ', fontSize: 8 },
          {
            text: 'Dans le cadre des formations à distance prendre en compte la réalisation des activités pédagogiques '
                + 'et le temps estimé pour les réaliser.',
          },
        ],
        absolutePosition: { x: 37, y: 755 },
        marginLeft: 40,
        marginRight: 40,
        marginTop: 8,
        fontSize: 11,
      },
    ];

    const pdf = {
      content: [header, body, footer].flat(),
      defaultStyle: { font: 'Calibri', fontSize: 14 },
      pageMargins: [40, 40, 40, 40],
      styles: { title: { fontSize: 24, bold: true, color: '#0404B4' } },
    };
    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);

    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('shoult format and return official pdf content for VAEI courses', async () => {
    const data = {
      duration: { [traineeId]: { onSite: '3h', total: '1h30' }, eLearning: '4h30' },
      programName: 'Programme',
      startDate: '01/02/2025',
      endDate: '28/02/2025',
      trainee: {
        _id: traineeId,
        identity: 'Jean SAITRIEN',
        attendanceDuration: '4h30',
        companyName: 'structure',
        eLearningDuration: '1h30',
      },
      date: '26/03/2025',
      isVAEISubProgram: true,
      certificateGenerationModeIsMonthly: true,
    };

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/logo_ministere_travail.png', name: 'ministere_travail.png' },
    ];

    const paths = [
      'src/data/pdf/tmp/signature.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/ministere_travail.png',
    ];
    downloadImages.returns(paths);

    const result = await CompletionCertificate.getOfficialPdfContent(data);

    const header = [
      { columns: [{ image: paths[2], width: 60 }, {}, { image: paths[1], width: 130 }], marginBottom: 24 },
      { text: 'CERTIFICAT DE RÉALISATION', style: 'title', alignment: 'center', marginBottom: 24 },
    ];

    const checkBoxSection = [
      // Checkbox 1
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 306 } },
      {
        text: [
          { text: '', position: { x: 59, y: 306 }, marginRight: 4 },
          { text: [{ text: ' action de formation' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 2
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 324 } },
      {
        text: [
          { text: '', position: { x: 59, y: 324 }, marginRight: 4 },
          { text: [{ text: ' bilan de compétences' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 3
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 343 } },
      {
        text: [
          { text: '', position: { x: 59, y: 343 }, marginRight: 4 },
          { text: [{ text: ' action de VAE' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 4
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 361 } },
      {
        text: [
          { text: '', position: { x: 59, y: 361 }, marginRight: 4 },
          { text: [{ text: ' action de formation par apprentissage' }, { text: '', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 32,
      },
      // Checkbox 5
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: 59, y: 380 } },
      {
        text: [
          { text: '√', position: { x: 59, y: 380 }, marginRight: 4 },
          { text: [{ text: ' action de VAE Inversée' }, { text: ' 1', fontSize: 8, bold: true }] },
        ],
        marginBottom: 4,
        marginLeft: 20,
      },
    ];

    const body = [
      {
        text: [
          { text: 'Je soussigné ', bold: true },
          { text: 'Thibault de Saint Blancard ', italics: true },
          {
            text: 'représentant légal du dispensateur de l\'action concourant au développement des compétences ',
            bold: true,
          },
          { text: 'COMPANI', italics: true },
        ],
      },
      { text: 'atteste que :', bold: true, marginTop: 4, marginBottom: 8 },
      {
        text: [{ text: 'Mme/M. ', bold: true }, { text: 'Jean SAITRIEN', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'salarié(e) de l\'entreprise ', bold: true }, { text: 'structure', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'a suivi l\'action ', bold: true }, { text: 'Programme', italics: true }],
        marginLeft: 4,
        marginBottom: 8,
      },
      {
        text: [{ text: 'Nature de l\'action concourant au développement des compétences :', bold: true }],
        marginLeft: 4,
        marginBottom: 4,
      },
      ...checkBoxSection,
      {
        text: [
          { text: 'qui s\'est déroulée du ', bold: true },
          { text: '01/02/2025 ', italics: true },
          { text: 'au ', bold: true },
          { text: '28/02/2025', italics: true },
        ],
        marginLeft: 4,
        marginBottom: 8,
        marginTop: 4,
      },
      {
        text: [
          {
            text: [
              { text: 'pour une durée de ', bold: true },
              {
                text: '4h30 d’accompagnement à distance et en présentiel, et '
                + '1h30 d’enseignement à distance sur l’application Compani. '
                + 'Ce certificat est lié à une facture de frais pédagogiques.',
                italic: true,
              },
            ],
          },
          { text: '2', fontSize: 8, bold: true },
        ],
        marginBottom: 8,
        marginLeft: 4,
      },
      {
        text: 'Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m\'engage à '
        + 'conserver l\'ensemble des pièces justificatives qui ont permis d\'établir le présent certificat pendant une '
        + 'durée de 3 ans à compter de la fin de l\'année du dernier paiement. En cas de cofinancement des fonds '
        + 'européens la durée de conservation est étendue conformément aux obligations conventionnelles spécifiques.',
        alignment: 'justify',
      },
    ];

    const footer = [
      {
        columns: [
          [
            {
              text: [{ text: 'Fait à : ', bold: true }, { text: 'Paris', italics: true }],
              absolutePosition: { x: 35, y: 550 },
              marginLeft: 46,
            },
            {
              text: [{ text: 'Le : ', bold: true }, { text: '26/03/2025', italics: true }],
              absolutePosition: { x: 35, y: 570 },
              marginLeft: 46,
            },
          ],
          [
            {
              canvas: [{ type: 'rect', x: 0, y: 0, w: 250, h: 160, r: 0 }],
              absolutePosition: { y: 555 },
              alignment: 'right',
            },
            {
              text: 'Cachet et signature du responsable du \n dispensateur de formation',
              marginTop: 6,
              alignment: 'center',
              fontSize: 10,
            },
            {
              text: 'Thibault de Saint Blancard, Directeur Compani',
              bold: true,
              marginTop: 6,
              alignment: 'center',
              fontSize: 10,
            },
            { image: paths[0], width: 125, absolutePosition: { x: 380, y: 618 } },
          ],
        ],
        marginLeft: 40,
        marginRight: 40,
        absolutePosition: { x: 37, y: 565 },
      },
      {
        text: [
          { text: '1 ', fontSize: 8 },
          {
            text: 'Lorsque l\'action est mise en œuvre dans le cadre d\'un projet de transition professionnelle, '
              + 'le certificat de réalisation doit être transmis mensuellement. \n',
          },
          { text: '2 ', fontSize: 8 },
          {
            text: 'Dans le cadre des formations à distance prendre en compte la réalisation des activités pédagogiques '
                + 'et le temps estimé pour les réaliser.',
          },
        ],
        absolutePosition: { x: 37, y: 755 },
        marginLeft: 40,
        marginRight: 40,
        marginTop: 8,
        fontSize: 11,
      },
    ];

    const pdf = {
      content: [header, body, footer].flat(),
      defaultStyle: { font: 'Calibri', fontSize: 14 },
      pageMargins: [40, 40, 40, 40],
      styles: { title: { fontSize: 24, bold: true, color: '#0404B4' } },
    };
    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);

    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});

describe('getPdf', () => {
  let getCustomPdfContent;
  let getOfficialPdfContent;
  let generatePdf;

  beforeEach(() => {
    getCustomPdfContent = sinon.stub(CompletionCertificate, 'getCustomPdfContent');
    getOfficialPdfContent = sinon.stub(CompletionCertificate, 'getOfficialPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    getCustomPdfContent.restore();
    getOfficialPdfContent.restore();
    generatePdf.restore();
  });

  it('should get pdf (CUSTOM)', async () => {
    const data = {
      duration: '15h',
      learningGoals: '- but',
      programName: 'Programme',
      startDate: '25/12/2021',
      endDate: '25/02/2022',
      trainee: { identity: 'Jean ALAIN', attendanceDuration: '14h' },
      date: '22/03/2022',
    };
    const template = {
      content: [{
        columns: [
          { image: 'src/data/pdf/tmp/aux-pouce.png', width: 64, marginTop: 8 },
          [
            { image: 'src/data/pdf/tmp/compani.png', width: 200, height: 42, alignment: 'right' },
            { text: 'Attestation individuelle de formation', style: 'title' },
          ],
        ],
        marginBottom: 20,
      }],
      defaultStyle: { font: 'Calibri', fontSize: 11 },
      pageMargins: [40, 40, 40, 280],
      styles: {
        title: { fontSize: 18, bold: true, color: COPPER_500, marginLeft: 48, marginTop: 16 },
        congratulations: { fontSize: 11, bold: true, color: ORANGE_500, marginBottom: 24 },
        subTitle: { fontSize: 16, color: COPPER_500, marginTop: 16 },
        programName: { fontSize: 12, alignment: 'center', color: COPPER_500, marginBottom: 16 },
      },
    };
    const images = [{ url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'logo.png' }];
    getCustomPdfContent.returns({ template, images });
    generatePdf.returns('pdf');

    const result = await CompletionCertificate.getPdf(data);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getCustomPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });

  it('should get pdf (OFFICIAL)', async () => {
    const data = {
      duration: '15h',
      programName: 'Programme',
      startDate: '25/12/2021',
      endDate: '25/02/2022',
      trainee: { identity: 'Jean PIERRE', attendanceDuration: '14h' },
      date: '22/03/2022',
    };
    const template = {
      content: [
        {
          columns: [
            { image: 'https://storage.googleapis.com/compani-main/logo_ministere_travail.png', width: 60 },
            {},
            { image: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', width: 130 },
          ],
          marginBottom: 24,
        },
        { text: 'CERTIFICAT DE REALISATION', style: 'title', alignment: 'center', marginBottom: 24 },
      ],
      defaultStyle: { font: 'Calibri', fontSize: 14 },
      pageMargins: [40, 40, 40, 40],
      styles: { title: { fontSize: 24, bold: true, color: '#0404B4' } },
    };
    const images = [
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/logo_ministere_travail.png', name: 'ministere_travail.png' },
    ];
    getOfficialPdfContent.returns({ template, images });
    generatePdf.returns('pdf');

    const result = await CompletionCertificate.getPdf(data, OFFICIAL);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getOfficialPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });
});
