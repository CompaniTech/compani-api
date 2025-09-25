const UtilsPdfHelper = require('./utils');
const PdfHelper = require('../../../helpers/pdf');
const FileHelper = require('../../../helpers/file');
const UtilsHelper = require('../../../helpers/utils');
const { COPPER_500, INTRA_HOLDING } = require('../../../helpers/constants');

exports.getPdfContent = async (data) => {
  const { dates, signedSlots, trainees } = data;
  const [conscience, compani, decision, signature] = await UtilsPdfHelper.getImages();

  const content = [];
  const isIntraHoldingCourse = dates[0].course.type === INTRA_HOLDING;
  const slotsSignatures = {};
  for (const [i, date] of dates.entries()) {
    const title = `Feuille d'émargement - ${date.date}`;
    const columns = [
      [
        { text: `Nom de la formation : ${date.course.name}`, bold: true, marginBottom: 10 },
        { text: `Durée : ${date.course.duration}` },
        { text: `Lieu : ${date.address}` },
        { text: `Structure : ${date.course.company}` },
        { text: `Intervenant·e : ${date.course.trainer}` },
      ],
      { image: decision, width: 64 },
    ];
    const header = UtilsPdfHelper.getHeader(compani, conscience, title, columns);

    const body = [
      [
        { text: 'Prénom NOM', style: 'header' },
        ...(isIntraHoldingCourse ? [{ text: 'Structure', style: 'header' }] : []),
      ],
    ];
    const indexOffset = isIntraHoldingCourse ? 2 : 1;
    date.slots.forEach(slot => body[0].push({ text: `${slot.startHour} - ${slot.endHour}`, style: 'header' }));
    const numberOfRows = signedSlots
      ? Math.max(
        0,
        [
          ...new Set(signedSlots.flatMap(slot => slot.traineesSignature.map(s => s.traineeId.toHexString()))),
        ].length + 1 || 0
      )
      : 11;

    for (let row = 1; row <= numberOfRows; row++) {
      body.push([]);
      const numberOfColumns = isIntraHoldingCourse ? date.slots.length + 1 : date.slots.length;
      for (let column = 0; column <= numberOfColumns; column++) {
        if (row === numberOfRows) {
          if (column === 0) {
            body[row].push({ text: 'Signature de l\'intervenant·e', italics: true, margin: [0, 8, 0, 0] });
          } else if (signedSlots) {
            if (column === 1 && isIntraHoldingCourse) body[row].push({ text: '' });
            else {
              const slot = date.slots[column - indexOffset]._id;
              const trainerSlotSignature = signedSlots
                .find(s => UtilsHelper.areObjectIdsEquals(s.slotId, slot)).trainerSignature;
              if (!slotsSignatures[trainerSlotSignature.trainerId]) {
                const imageList = [{ url: trainerSlotSignature.signature, name: 'trainer_signature.png' }];
                const [trainerSignature] = await FileHelper.downloadImages(imageList);
                slotsSignatures[trainerSlotSignature.trainerId] = trainerSignature;
              }
              body[row].push({
                image: slotsSignatures[trainerSlotSignature.trainerId],
                width: 64,
                alignment: 'center',
              });
            }
          } else body[row].push({ text: '' });
        } else if (signedSlots) {
          if (column === 0) {
            body[row].push({
              text: UtilsHelper.formatIdentity(trainees[row - 1].identity, 'FL'),
              margin: [0, 8, 0, 0],
            });
          } else if (column === 1 && isIntraHoldingCourse) {
            body[row].push({ text: trainees[row - 1].company.name, margin: [0, 8, 0, 0], alignment: 'center' });
          } else {
            const slot = date.slots[column - indexOffset]._id;
            const { traineesSignature } = signedSlots.find(s => UtilsHelper.areObjectIdsEquals(s.slotId, slot));
            const traineeSignature = traineesSignature
              .find(sign => UtilsHelper.areObjectIdsEquals(sign.traineeId, trainees[row - 1]._id));
            if (traineeSignature) {
              if (!slotsSignatures[traineeSignature.traineeId]) {
                const imageList = [{ url: traineeSignature.signature, name: 'trainee_signature.png' }];
                const [traineeSignatureFile] = await FileHelper.downloadImages(imageList);
                slotsSignatures[traineeSignature.traineeId] = traineeSignatureFile;
              }
              body[row].push(
                { image: slotsSignatures[traineeSignature.traineeId], width: 64, alignment: 'center' }
              );
            } else body[row].push({ text: '' });
          }
        } else body[row].push({ text: '' });
      }
    }
    const heights = Array(14).fill(28);
    heights[0] = 'auto';
    const widths = body[0].length < 4 ? ['50%'] : ['40%'];
    if (isIntraHoldingCourse) widths.push(body[0].length < 4 ? '30%' : '25%');
    widths.push(...Array(date.slots.length).fill('*'));
    const table = [{
      table: { body, widths, heights, dontBreakRows: true },
      marginBottom: 8,
      pageBreak: i === dates.length - 1 ? 'none' : 'after',
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
    images: [conscience, compani, decision, signature, ...Object.values(slotsSignatures)],
  };
};

exports.getPdf = async (data) => {
  const { template, images } = await exports.getPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
