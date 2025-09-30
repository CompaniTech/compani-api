const get = require('lodash/get');
const UtilsPdfHelper = require('./utils');
const UtilsHelper = require('../../../helpers/utils');
const PdfHelper = require('../../../helpers/pdf');
const FileHelper = require('../../../helpers/file');
const { COPPER_500 } = require('../../../helpers/constants');

const getSlotTableContent = (slot, slotSignatures) => [
  { stack: [{ text: `${slot.date}` }, { text: `${slot.address || ''}`, fontSize: 8 }] },
  { stack: [{ text: `${slot.duration}` }, { text: `${slot.startHour} - ${slot.endHour}`, fontSize: 8 }] },
  ...get(slotSignatures, 'traineeSignature')
    ? [{ image: slotSignatures.traineeSignature, width: 64, alignment: 'center' }]
    : [{ text: '' }],
  ...get(slotSignatures, 'trainerSignature')
    ? [{ image: slotSignatures.trainerSignature, width: 64, alignment: 'center' }]
    : [{ text: '' }],
];

exports.getPdfContent = async (data) => {
  const { trainees, signedSlots } = data;
  const [conscience, compani, decision, signature] = await UtilsPdfHelper.getImages();
  const slotsSignatures = [];

  const content = [];
  for (let i = 0; i < trainees.length; i++) {
    const trainee = trainees[i];
    const title = `Émargements - ${trainee.traineeName}`;
    const columns = [
      [
        { text: `Nom de la formation : ${trainee.course.name}`, bold: true, marginBottom: 10 },
        { text: `Dates : du ${trainee.course.firstDate} au ${trainee.course.lastDate}` },
        { text: `Durée : ${trainee.course.duration}` },
        { text: `Structure : ${trainee.registrationCompany}` },
        { text: `Intervenant·e : ${trainee.course.trainer}` },
      ],
      { image: decision, width: 64 },
    ];
    const header = UtilsPdfHelper.getHeader(compani, conscience, title, columns);

    const body = [
      [
        { text: 'Créneaux', style: 'header' },
        { text: 'Durée', style: 'header' },
        { text: 'Signature stagiaire', style: 'header' },
        { text: 'Signature de l\'intervenant·e', style: 'header' },
      ],
    ];

    if (signedSlots) {
      for (const slot of signedSlots) {
        const signatureImages = [
          { url: slot.trainerSignature.signature, name: 'trainer_signature.png' },
          { url: slot.traineesSignature[0].signature, name: 'trainee_signature.png' },
        ];
        const [trainerSignature, traineeSignature] = await FileHelper.downloadImages(signatureImages);
        const slotSignatures = { slotId: slot.slotId, trainerSignature, traineeSignature };
        slotsSignatures.push(slotSignatures);
      }
    }

    trainee.course.slots
      .forEach(slot => body.push(
        getSlotTableContent(slot, slotsSignatures.find(s => UtilsHelper.areObjectIdsEquals(slot._id, s.slotId)))
      ));

    const table = [{
      table: { body, widths: ['auto', 'auto', '*', '*'], dontBreakRows: true },
      marginBottom: 8,
      pageBreak: i === trainees.length - 1 ? 'none' : 'after',
    }];

    content.push(header, table);
  }

  return {
    template: {
      content: content.flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      pageMargins: [40, 40, 40, 128],
      styles: {
        header: { bold: true, fillColor: COPPER_500, color: 'white', alignment: 'center' },
        title: { fontSize: 16, bold: true, margin: [8, 32, 0, 0], alignment: 'left', color: COPPER_500 },
      },
      footer: UtilsPdfHelper.getFooter(signature),
    },
    images: [
      conscience,
      compani,
      decision,
      signature,
      ...slotsSignatures.length
        ? [...new Set(slotsSignatures.flatMap(s => [s.trainerSignature, s.traineeSignature]))]
        : [],
    ],
  };
};

exports.getPdf = async (data) => {
  const { template, images } = await exports.getPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
