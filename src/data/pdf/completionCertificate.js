const FileHelper = require('../../helpers/file');
const PdfHelper = require('../../helpers/pdf');
const { COPPER_500, ORANGE_500, COPPER_50, CUSTOM } = require('../../helpers/constants');

const getImages = async () => {
  const imageList = [
    { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
    { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
    { url: 'https://storage.googleapis.com/compani-main/aux-eclaire.png', name: 'aux-eclaire.png' },
    { url: 'https://storage.googleapis.com/compani-main/smiling-emoji.png', name: 'smiling-emoji.png' },
    { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
  ];

  return FileHelper.downloadImages(imageList);
};

const getHeader = (thumb, compani) => [
  {
    columns: [
      { image: thumb, width: 64 },
      [
        { image: compani, width: 200, height: 42, alignment: 'right' },
        { text: 'Attestation individuelle de formation', style: 'title' },
      ],
    ],
    marginBottom: 20,
  },
];

exports.getCustomPdfContent = async (data) => {
  const [thumb, compani, lighted, emoji, signature] = await getImages();
  const { trainee, programName, duration, startDate, endDate, learningGoals, date } = data;
  const isLargeProgramName = programName.length > 80;
  const hasELearningStep = duration.eLearning !== '0h';

  const header = getHeader(thumb, compani);

  const body = [
    { text: 'Félicitations, vous avez terminé votre formation !', style: 'congratulations' },
    {
      columns: [
        { text: 'COMPANI est ravi de vous avoir accompagné et d\'avoir partagé ces moments ensemble', width: 'auto' },
        { image: emoji, width: 10, height: 10, marginLeft: 2 },
      ],
      marginBottom: 8,
    },
    {
      text: [
        'Je soussigné Thibault de Saint Blancard, représentant de l\'organisme de formation ',
        { text: 'COMPANI', bold: true },
        ', atteste que ',
        { text: trainee.identity, italics: true },
        ' a participé à la formation :',
      ],
      marginBottom: 16,
    },
    {
      canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: isLargeProgramName ? 32 : 24, r: 0, color: COPPER_50 }],
      absolutePosition: { x: 40, y: 248 },
      marginBottom: 8,
    },
    { text: programName, style: 'programName' },
    {
      text: [
        { text: 'Durée', decoration: 'underline' },
        ` : ${duration.total} de formation ${hasELearningStep ? '' : 'en présentiel '}du `,
        { text: `${startDate} au ${endDate}`, color: COPPER_500 },
      ],
    },
    { image: lighted, width: 128, height: 118, absolutePosition: { x: 450, y: 292 } },
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
          ...([hasELearningStep
            ? [{
              text: [
                { text: trainee.identity, italics: true },
                ' a été présent(e) à ',
                { text: trainee.totalDuration, bold: true },
                ' de formation (dont ',
                { text: `${trainee.attendanceDuration} en présentiel `, bold: true },
                'et ',
                { text: `${trainee.eLearningDuration} en e-learning) `, bold: true },
                'sur les ',
                { text: `${duration.total} prévues.`, bold: true },
              ],
            }]
            : [{
              text: [
                { text: trainee.identity, italics: true },
                ' a été présent(e) à ',
                { text: trainee.attendanceDuration, bold: true },
                ' de formation en présentiel sur les ',
                { text: `${duration.total} prévues.`, bold: true },
              ],
            }]]),
          [{ text: 'Objectifs pédagogiques :', style: 'subTitle' }],
          [{
            text: [
              'À l\'issue de cette formation, ',
              { text: trainee.identity, italics: true },
              ' est capable de : ',
            ],
          }],
          [{ text: learningGoals, color: COPPER_500 }],
          [{ text: 'Résultats de l’évaluation des acquis :', style: 'subTitle' }],
          [{
            text: [
              'Les compétences et connaissances partagées lors de la formation ont été acquises par ',
              { text: trainee.identity, italics: true },
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

  return {
    template: {
      content: [header, body].flat(),
      defaultStyle: { font: 'Calibri', fontSize: 11 },
      pageMargins: [40, 40, 40, 280],
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
            { text: `Fait à Paris, le ${date}` },
            { text: 'Thibault de Saint Blancard, Directeur Compani' },
            { image: signature, width: 120, marginBottom: 24 },
            { text: 'Compani', style },
            { text: '24 avenue daumesnil, 75012 Paris', style },
            { text: 'Numéro SIRET : 90512399800015 | Numéro de déclaration d’activité : 11756363475', style },
            { text: `PAGE ${currentPage.toString()} / ${pageCount}`, style, alignment: 'right' },
          ],
          marginLeft: 40,
          marginRight: 40,
          marginTop: 8,
        };
      },
    },
    images: [thumb, compani, lighted, emoji, signature],
  };
};

const defineCheckbox = (xPos, yPos, label, isLargeProgramName, isChecked = false) => {
  const yPosition = isLargeProgramName ? yPos + 14 : yPos;

  return [
    { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 0 }], absolutePosition: { x: xPos, y: yPosition } },
    {
      text: [
        { text: isChecked ? '√' : '', position: { x: xPos, y: yPosition }, marginRight: 4 },
        { text: [{ text: label }, { text: isChecked ? ' 1' : '', fontSize: 8, bold: true }] },
      ],
      marginBottom: 4,
      marginLeft: isChecked ? 20 : 32,
    },
  ];
};

exports.getOfficialPdfContent = async (data) => {
  const {
    trainee,
    programName,
    startDate,
    endDate,
    date,
    duration = { eLearning: '0h', total: '0h' },
    isVAEISubProgram = false,
    certificateGenerationModeIsMonthly = false,
  } = data;
  const isLargeProgramName = programName.length > 60;
  const hasELearningStep = duration.eLearning !== '0h';

  const imageList = [
    { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
    { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
    { url: 'https://storage.googleapis.com/compani-main/logo_ministere_travail.png', name: 'ministere_travail.png' },
  ];
  const [signature, compani, logo] = await FileHelper.downloadImages(imageList);

  const header = [
    { columns: [{ image: logo, width: 60 }, {}, { image: compani, width: 130 }], marginBottom: 24 },
    { text: 'CERTIFICAT DE RÉALISATION', style: 'title', alignment: 'center', marginBottom: 24 },
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
      text: [{ text: 'Mme/M. ', bold: true }, { text: `${trainee.identity}`, italics: true }],
      marginLeft: 4,
      marginBottom: 8,
    },
    {
      text: [{ text: 'salarié(e) de l\'entreprise ', bold: true }, { text: `${trainee.companyName}`, italics: true }],
      marginLeft: 4,
      marginBottom: 8,
    },
    {
      text: [{ text: 'a suivi l\'action ', bold: true }, { text: `${programName}`, italics: true }],
      marginLeft: 4,
      marginBottom: 8,
    },
    {
      text: [{ text: 'Nature de l\'action concourant au développement des compétences :', bold: true }],
      marginLeft: 4,
      marginBottom: 4,
    },
    ...defineCheckbox(59, 306, ' action de formation', isLargeProgramName, !isVAEISubProgram),
    ...defineCheckbox(59, 324, ' bilan de compétences', isLargeProgramName),
    ...defineCheckbox(59, 343, ' action de VAE', isLargeProgramName),
    ...defineCheckbox(59, 361, ' action de formation par apprentissage', isLargeProgramName),
    ...defineCheckbox(59, 380, ' action de VAE Inversée', isLargeProgramName, isVAEISubProgram),
    {
      text: [
        { text: 'qui s\'est déroulée du ', bold: true },
        { text: `${startDate} `, italics: true },
        { text: 'au ', bold: true },
        { text: `${endDate}`, italics: true },
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
            ...(certificateGenerationModeIsMonthly
              ? [{
                text: `${trainee.attendanceDuration} d’accompagnement à distance et en présentiel, et`
                 + `${trainee.eLearningDuration} d’enseignement à distance sur l’application Compani.`
                + `${isVAEISubProgram ? 'Ce certificat est lié à une facture de frais pédagogiques.' : ''}`,
                italic: true,
              }]
              : []),
            ...(!certificateGenerationModeIsMonthly && hasELearningStep
              ? [{
                text: `${trainee.totalDuration} en formation (dont ${trainee.attendanceDuration} en présentiel et `
                + `${trainee.eLearningDuration} en e-learning) sur ${duration.total} prévues. `,
                italics: true,
              }]
              : []),
            ...(!certificateGenerationModeIsMonthly && !hasELearningStep
              ? [{
                text: `${trainee.attendanceDuration} en formation présentielle sur ${duration.total} prévues. `,
                italics: true,
              }]
              : []),
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
            text: [{ text: 'Le : ', bold: true }, { text: `${date}`, italics: true }],
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
          { image: signature, width: 125, absolutePosition: { x: 380, y: 618 } },
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

  return {
    template: {
      content: [header, body, footer].flat(),
      defaultStyle: { font: 'Calibri', fontSize: 14 },
      pageMargins: [40, 40, 40, 40],
      styles: { title: { fontSize: 24, bold: true, color: '#0404B4' } },
    },
    images: [signature, compani, logo],
  };
};

exports.getPdf = async (data, type = CUSTOM) => {
  const { template, images } = type === CUSTOM
    ? await exports.getCustomPdfContent(data)
    : await exports.getOfficialPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
