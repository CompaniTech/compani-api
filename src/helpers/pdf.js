const moment = require('moment');
const fs = require('fs');
const path = require('path');
const util = require('util');
const pdfmake = require('pdfmake');
const FileHelper = require('./file');

exports.readFile = util.promisify(fs.readFile);

exports.formatSurchargeHourForPdf = date =>
  (moment(date).minutes() > 0 ? moment(date).format('HH[h]mm') : moment(date).format('HH[h]'));

exports.formatEventSurchargesForPdf = (eventSurcharges) => {
  const formattedSurcharges = eventSurcharges.map((surcharge) => {
    const sur = { ...surcharge };
    if (sur.startHour) {
      sur.startHour = exports.formatSurchargeHourForPdf(sur.startHour);
      sur.endHour = exports.formatSurchargeHourForPdf(sur.endHour);
    }
    return sur;
  });
  return formattedSurcharges;
};

const fonts = () => {
  const fontAbsolutePath = path.resolve(__dirname, '../data/pdf/fonts');

  return {
    SourceSans: {
      normal: `${fontAbsolutePath}/SourceSansPro-Regular.ttf`,
      bold: `${fontAbsolutePath}/SourceSansPro-Bold.ttf`,
      italics: `${fontAbsolutePath}/SourceSansPro-Italic.ttf`,
    },
    Calibri: {
      normal: `${fontAbsolutePath}/Calibri-Regular.ttf`,
      bold: `${fontAbsolutePath}/Calibri-Bold.TTF`,
      italics: `${fontAbsolutePath}/Calibri-Italic.ttf`,
    },
    icon: {
      normal: `${fontAbsolutePath}/icon.ttf`,
    },
  };
};

exports.generatePdf = async (template, images = []) => {
  pdfmake.setFonts(fonts());
  const doc = await pdfmake.createPdf(template).getStream();
  doc.end();
  FileHelper.deleteImages(images);

  return doc;
};
