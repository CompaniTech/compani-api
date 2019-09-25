const path = require('path');
const moment = require('moment');
const fs = require('fs');
const util = require('util');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

const ReadFile = util.promisify(fs.readFile);

exports.formatSurchargeHourForPdf = (date) => {
  date = moment(date);
  return date.minutes() > 0 ? date.format('HH[h]mm') : date.format('HH[h]');
};

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

exports.formatTable = (items, options) => {
  let out = '';
  if (items) {
    for (let i = 0, l = items.length; i < l; i++) {
      out += options.fn(items[i]);
    }
  }

  return out;
};

exports.generatePdf = async (data, templateUrl) => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const templatePath = path.resolve('./', templateUrl);
  const content = await ReadFile(templatePath, 'utf8');
  handlebars.registerHelper('table', exports.formatTable);
  const template = handlebars.compile(content);
  const html = template(data);
  await page.setContent(html);
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return pdf;
};
