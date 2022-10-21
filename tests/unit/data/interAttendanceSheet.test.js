const sinon = require('sinon');
const expect = require('expect');
const FileHelper = require('../../../src/helpers/file');
const PdfHelper = require('../../../src/helpers/pdf');
const InterAttendanceSheet = require('../../../src/data/pdf/attendanceSheet/interAttendanceSheet');
const { PEACH_100, COPPER_500 } = require('../../../src/helpers/constants');

describe('getPdfContent', () => {
  let downloadImages;

  beforeEach(() => {
    downloadImages = sinon.stub(FileHelper, 'downloadImages');
  });

  afterEach(() => {
    downloadImages.restore();
  });

  it('it should format and return pdf content', async () => {
    const paths = [
      'src/data/pdf/tmp/conscience.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/decision.png',
      'src/data/pdf/tmp/signature.png',
    ];
    const course = {
      name: 'Formation Test',
      slots: [
        {
          address: '24 Avenue Daumesnil 75012 Paris',
          date: '16/09/2021',
          startHour: '10:00',
          endHour: '13:00',
          duration: '3h',
        },
        {
          address: '24 Avenue Daumesnil 75012 Paris',
          date: '16/09/2021',
          startHour: '14:00',
          endHour: '18:00',
          duration: '4h',
        },
      ],
      trainer: 'Anne ONYME',
      firstDate: '16/09/2021',
      lastDate: '28/01/2022',
      duration: '56h',
    };
    const data = {
      trainees: [
        { traineeName: 'Alain TÉRIEUR', company: 'Alenvi Home SAS', course },
        { traineeName: 'Alex TÉRIEUR', company: 'APEF Rouen', course },
      ],
    };
    const table = {
      body: [
        [
          { text: 'Créneaux', style: 'header' },
          { text: 'Durée', style: 'header' },
          { text: 'Signature stagiaire', style: 'header' },
          { text: 'Signature de l\'intervenant(e)', style: 'header' },
        ],
        [
          { stack: [{ text: '16/09/2021' }, { text: '24 Avenue Daumesnil 75012 Paris', fontSize: 8 }] },
          { stack: [{ text: '3h' }, { text: '10:00 - 13:00', fontSize: 8 }] },
          { text: '' },
          { text: '' },
        ],
        [
          { stack: [{ text: '16/09/2021' }, { text: '24 Avenue Daumesnil 75012 Paris', fontSize: 8 }] },
          { stack: [{ text: '4h' }, { text: '14:00 - 18:00', fontSize: 8 }] },
          { text: '' },
          { text: '' },
        ],
      ],
      widths: ['auto', 'auto', '*', '*'],
      dontBreakRows: true,
    };
    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 64 },
            [
              { image: paths[1], width: 132, height: 28, alignment: 'right' },
              { text: 'Émargements - Alain TÉRIEUR', style: 'title' },
            ],
          ],
          marginBottom: 20,
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 108, r: 0, color: PEACH_100 }],
          absolutePosition: { x: 40, y: 150 },
        },
        {
          columns: [
            [
              { text: 'Nom de la formation : Formation Test', bold: true, marginBottom: 10 },
              { text: 'Dates : du 16/09/2021 au 28/01/2022' },
              { text: 'Durée : 56h' },
              { text: 'Structure : Alenvi Home SAS' },
              { text: 'Intervenant(e) : Anne ONYME' },
            ],
            { image: paths[2], width: 64 },
          ],
          margin: [16, 0, 24, 24],
        },
        { table, marginBottom: 8, pageBreak: 'after' },
        {
          columns: [
            { image: paths[0], width: 64 },
            [
              { image: paths[1], width: 132, height: 28, alignment: 'right' },
              { text: 'Émargements - Alex TÉRIEUR', style: 'title' },
            ],
          ],
          marginBottom: 20,
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 108, r: 0, color: PEACH_100 }],
          absolutePosition: { x: 40, y: 150 },
        },
        {
          columns: [
            [
              { text: 'Nom de la formation : Formation Test', bold: true, marginBottom: 10 },
              { text: 'Dates : du 16/09/2021 au 28/01/2022' },
              { text: 'Durée : 56h' },
              { text: 'Structure : APEF Rouen' },
              { text: 'Intervenant(e) : Anne ONYME' },
            ],
            { image: paths[2], width: 64 },
          ],
          margin: [16, 0, 24, 24],
        },
        { table, marginBottom: 8, pageBreak: 'none' },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      pageMargins: [40, 40, 40, 128],
      styles: {
        header: { bold: true, fillColor: COPPER_500, color: 'white', alignment: 'center' },
        title: { fontSize: 16, bold: true, margin: [8, 32, 0, 0], alignment: 'left', color: COPPER_500 },
      },
      footer: [{
        columns: [
          { text: 'Signature et tampon de l\'organisme de formation :', bold: true },
          { image: paths[3], width: 144, marginTop: 8, alignment: 'right' },
        ],
        unbreakable: true,
        marginLeft: 40,
        marginRight: 40,
      }],
    };
    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/aux-conscience-eclairee.png', name: 'conscience.png' },
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
      { url: 'https://storage.googleapis.com/compani-main/aux-prisededecision.png', name: 'decision.png' },
      { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
    ];

    downloadImages.returns(paths);

    const result = await InterAttendanceSheet.getPdfContent(data);

    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});

describe('getPdf', () => {
  let getPdfContent;
  let generatePdf;

  beforeEach(() => {
    getPdfContent = sinon.stub(InterAttendanceSheet, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    getPdfContent.restore();
    generatePdf.restore();
  });

  it('should get pdf', async () => {
    const data = {
      trainees: [
        { traineeName: 'Alain TÉRIEUR', company: 'Alenvi Home SAS' },
        { traineeName: 'Alex TÉRIEUR', company: 'APEF Rouen' },
      ],
    };
    const template = {
      content: [
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 108, r: 0, color: PEACH_100 }],
          absolutePosition: { x: 40, y: 150 },
        },
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 108, r: 0, color: PEACH_100 }],
          absolutePosition: { x: 40, y: 150 },
        },
      ],
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      pageMargins: [40, 40, 40, 128],
      styles: {
        header: { bold: true, fillColor: COPPER_500, color: 'white', alignment: 'center' },
      },
      footer: [{
        columns: [{ text: 'Signature et tampon de l\'organisme de formation :', bold: true }],
        unbreakable: true,
        marginLeft: 40,
        marginRight: 40,
      }],
    };
    const images = [{ url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' }];
    getPdfContent.returns({ template, images });
    generatePdf.returns('pdf');

    const result = await InterAttendanceSheet.getPdf(data);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });
});
