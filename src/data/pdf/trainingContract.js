const get = require('lodash/get');
const PdfHelper = require('../../helpers/pdf');
const NumbersHelper = require('../../helpers/numbers');
const FileHelper = require('../../helpers/file');
const UtilsHelper = require('../../helpers/utils');
const { COPPER_600, COPPER_100, INTER_B2B } = require('../../helpers/constants');

const getImages = async () => {
  const imageList = [
    { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
    { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
  ];

  return FileHelper.downloadImages(imageList);
};

const getHeader = (data, compani) => [
  { image: compani, width: 154, height: 32, alignment: 'right', marginBottom: 24, opacity: 0.5 },
  { text: 'CONVENTION DE FORMATION', alignment: 'center', fontSize: 24, bold: true, marginBottom: 24 },
  {
    stack: [
      { text: 'Entre l\'organisme de formation', color: COPPER_600 },
      { text: get(data, 'vendorCompany.name'), bold: true },
      { text: get(data, 'vendorCompany.address.fullAddress') || '' },
      { text: `SIRET : ${UtilsHelper.formatSiret(get(data, 'vendorCompany.siret') || '')}` },
      { text: `Numéro de déclaration d'activité : ${get(data, 'vendorCompany.activityDeclarationNumber') || ''}` },
    ],
    marginBottom: 16,
  },
  {
    stack: [
      { text: 'Et', color: COPPER_600 },
      { text: get(data, 'company.name') },
      { text: get(data, 'company.address') || '' },
    ],
    marginBottom: 20,
  },
];

const getFooter = (data, signature) => [
  {
    columns: [
      {
        stack: [
          { text: get(data, 'vendorCompany.name') || '', color: COPPER_600 },
          { text: 'Thibault de Saint Blancard, Directeur général de Compani' },
          { image: signature, width: 132, marginTop: 8 },
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

const formatAddressList = (addressList) => {
  if (addressList.length === 1) return { text: `Lieu : ${addressList[0]}` };
  const formattedList = addressList.flatMap(address => ({ text: `- ${address}`, marginLeft: 8 }));

  return { stack: [{ text: 'Lieux : ' }, ...formattedList] };
};

exports.getPdfContent = async (data) => {
  const [compani, signature] = await getImages();
  const header = getHeader(data, compani);

  const totalPrice = data.type === INTER_B2B
    ? data.totalPrice || NumbersHelper.toFixedToFloat(data.learnersCount * data.payloadPrice, 1)
    : data.totalPrice || data.payloadPrice;
  const formattedTrainersTitle = UtilsHelper.formatQuantity('Intervenant·e', data.trainers.length, 's', false);

  const body = [
    [
      {
        stack: [
          { text: data.programName, bold: true },
          {
            stack: [
              { text: 'Objectifs :' },
              { text: data.learningGoals, marginLeft: 16 },
            ],
          },
          {
            text: `Durée : ${UtilsHelper.formatQuantity('créneau', data.slotsCount, 'x')} - ${data.liveDuration}`
              + `${data.eLearningDuration ? ` (+ ${data.eLearningDuration} de e-learning)` : ''}`,
          },
          { text: `Effectif formé : ${data.learnersName}` },
          { text: `Dates : ${data.dates.join(' - ')}` },
          formatAddressList(data.addressList),
          { text: `${formattedTrainersTitle} : ${data.trainers.join(', ')}`, marginBottom: 16 },
          ...(data.type === INTER_B2B ? [{ text: `Prix TTC par stagiaire : ${data.payloadPrice} €` }] : []),
          { text: `Prix total TTC : ${totalPrice} €` },
          { text: '(Ce prix comprend les frais de formateurs)', italics: true },
          {
            text: 'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA).',
            italics: true,
            fontSize: 8,
          },
        ],
        margin: 16,
      },
    ],
  ];

  const table = [
    {
      table: { body, widths: ['100%'] },
      layout: { vLineWidth: () => 0, hLineWidth: () => 0, fillColor: COPPER_100 },
    },
  ];

  const content = [header, table];

  return {
    template: {
      content: content.flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 12 },
      pageMargins: [40, 40, 40, 160],
      footer: getFooter(data, signature),
    },
    images: [compani, signature],
  };
};

exports.getPdf = async (data) => {
  const { template, images } = await exports.getPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
