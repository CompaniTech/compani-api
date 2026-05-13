const get = require('lodash/get');
const FileHelper = require('../../helpers/file');
const PdfHelper = require('../../helpers/pdf');
const { COPPER_500, COPPER_GREY_200 } = require('../../helpers/constants');

const getImages = async () => {
  const imageList = [
    { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
    { url: 'https://storage.googleapis.com/compani-main/doct-explication.png', name: 'doct-explication.png' },
    { url: 'https://storage.googleapis.com/compani-main/doct-quizz.png', name: 'doct-quizz.png' },
    { url: 'https://storage.googleapis.com/compani-main/aux-perplexite.png', name: 'aux-perplexite.png' },
  ];

  return FileHelper.downloadImages(imageList);
};

const getHeader = (image, misc, tradeName) => {
  const title = `${tradeName || ''}${misc ? ` - ${misc}` : ''}`;

  return [
    {
      columns: [
        { image, width: 64 },
        [
          { text: 'Vous êtes convoqué(e) à la formation', style: 'surtitle' },
          { text: title, style: 'title' },
          { canvas: [{ type: 'line', x1: 20, y1: 10, x2: 450, y2: 10, lineWidth: 1.5, lineColor: COPPER_GREY_200 }] },
        ],
      ],
    },
  ];
};

const getSlotTableContent = (slot) => {
  const content = [
    { text: slot.date, style: 'tableContent' },
    { text: slot.hours, style: 'tableContent' },
  ];

  if (slot.meetingLink) {
    content.push(
      {
        text: [
          { text: ' ', style: 'icon' },
          {
            text: slot.meetingLink,
            link: slot.meetingLink,
            style: 'tableContent',
            decoration: 'underline',
            alignment: 'left',
          },
        ],
        margin: [0, 4, 0, 4],
      }
    );
  } else if (slot.address) {
    content.push(
      {
        text: [{ text: ' ', style: 'icon' }, { text: slot.address, style: 'tableContent', alignment: 'left' }],
        margin: [0, 4, 0, 4],
      }
    );
  } else {
    content.push({ text: '' });
  }

  return content;
};

const getTable = (slots, slotsToPlan) => {
  const body = [
    [
      { text: 'Dates', style: 'tableHeader' },
      { text: 'Heures', style: 'tableHeader' },
      { text: 'Lieux', style: 'tableHeader', alignment: 'left' },
    ],
  ];
  slots.forEach((slot) => { body.push(getSlotTableContent(slot)); });

  const table = [
    {
      table: { body, height: 24, widths: ['auto', '*', '*'] },
      layout: { vLineWidth: () => 0, hLineWidth: () => 1, hLineColor: () => COPPER_GREY_200 },
      marginTop: 24,
    },
  ];

  if (slotsToPlan && slotsToPlan.length) {
    table.push({ text: `Il reste ${slotsToPlan.length} créneau(x) à planifier.`, style: 'notes' });
  }

  return table;
};

const getProgramInfo = (image, program) => ({
  columns: [
    { image, width: 64 },
    [
      { text: 'Programme de la formation', style: 'infoTitle' },
      { text: program.description || '', style: 'infoContent' },
    ],
  ],
  marginTop: 24,
  columnGap: 12,
});

const getTrainersInfo = (trainerImg, trainers) => ({
  columns: [
    { image: trainerImg, width: 64 },
    trainers.map(trainer => [
      { text: 'Intervenant·e', style: 'infoTitle' },
      { text: get(trainer, 'formattedIdentity') || '', style: 'infoSubTitle' },
      { text: get(trainer, 'biography') || '', style: 'infoContent' },
    ]),
  ],
  marginTop: 24,
  columnGap: 12,
});

const getContactInfo = (contactImg, contact) => ({
  columns: [
    { image: contactImg, width: 64 },
    [
      { text: 'Votre contact pour la formation', style: 'infoTitle' },
      { text: get(contact, 'formattedIdentity') || '', style: 'infoSubTitle' },
      { text: get(contact, 'formattedPhone') || '', style: 'infoSubTitle' },
      { text: get(contact, 'email') || '', style: 'infoSubTitle' },
    ],
  ],
  marginTop: 24,
  columnGap: 12,
});

exports.getPdfContent = async (data) => {
  const [thumb, explanation, quizz, confused] = await getImages();

  const header = getHeader(thumb, data.misc, data.tradeName);
  const table = getTable(data.slots, data.slotsToPlan);
  const programInfo = getProgramInfo(explanation, data.subProgram.program);
  const contactInfo = getContactInfo(confused, data.contact);
  const trainersInfo = getTrainersInfo(quizz, data.trainers);

  return {
    template: {
      content: [header, table, programInfo, contactInfo, trainersInfo].flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        title: { fontSize: 20, bold: true, color: COPPER_500, marginLeft: 24 },
        surtitle: { fontSize: 12, bold: true, marginTop: 24, marginLeft: 24 },
        tableHeader: { fontSize: 12, bold: true, alignment: 'center', marginTop: 4, marginBottom: 4 },
        tableContent: { fontSize: 12, alignment: 'center', marginTop: 4, marginBottom: 4 },
        notes: { italics: true, marginTop: 4 },
        infoTitle: { fontSize: 14, bold: true },
        infoSubTitle: { fontSize: 12 },
        infoContent: { italics: true, marginBottom: 12 },
        icon: { font: 'icon' },
      },
    },
    images: [thumb, explanation, quizz, confused],
  };
};

exports.getPdf = async (data) => {
  const { template, images } = await exports.getPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
