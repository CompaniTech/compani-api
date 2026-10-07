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

const FONTS_PATH = path.resolve(__dirname, '../data/pdf/fonts');
const TMP_IMAGES_PATH = path.resolve(__dirname, '../data/pdf/tmp');

const fonts = () => ({
  SourceSans: {
    normal: `${FONTS_PATH}/SourceSansPro-Regular.ttf`,
    bold: `${FONTS_PATH}/SourceSansPro-Bold.ttf`,
    italics: `${FONTS_PATH}/SourceSansPro-Italic.ttf`,
  },
  Calibri: {
    normal: `${FONTS_PATH}/Calibri-Regular.ttf`,
    bold: `${FONTS_PATH}/Calibri-Bold.TTF`,
    italics: `${FONTS_PATH}/Calibri-Italic.ttf`,
  },
  icon: {
    normal: `${FONTS_PATH}/icon.ttf`,
  },
});

pdfmake.setUrlAccessPolicy(() => false);

pdfmake.setLocalAccessPolicy(filePath => [FONTS_PATH, TMP_IMAGES_PATH]
  .some(dir => path.resolve(filePath).startsWith(`${dir}/`)));

exports.generatePdf = async (template, images = []) => {
  pdfmake.setFonts(fonts());
  const doc = await pdfmake.createPdf(template).getStream();
  doc.end();
  FileHelper.deleteImages(images);

  return doc;
};
