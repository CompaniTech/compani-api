const sinon = require('sinon');
const { expect } = require('expect');
const FileHelper = require('../../../src/helpers/file');
const PdfHelper = require('../../../src/helpers/pdf');
const IntraAttendanceSheet = require('../../../src/data/pdf/attendanceSheet/intraAttendanceSheet');
const { PEACH_100, COPPER_500, INTRA, INTRA_HOLDING } = require('../../../src/helpers/constants');

describe('getPdfContent', () => {
  let downloadImages;

  beforeEach(() => {
    downloadImages = sinon.stub(FileHelper, 'downloadImages');
  });

  afterEach(() => {
    downloadImages.restore();
  });

  it('it should format and return pdf content (intra)', async () => {
    const paths = [
      'src/data/pdf/tmp/conscience.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/decision.png',
      'src/data/pdf/tmp/signature.png',
    ];
    const course = {
      name: 'La communication empathique - Groupe 3',
      duration: '5h',
      company: 'Alenvi Home SAS',
      trainer: 'Ken Kaneki',
      type: INTRA,
    };
    const data = {
      dates: [
        {
          course,
          address: 'Rue Jean Jaurès 59620 Aulnoye-Aymeries',
          slots: [{ startHour: '09h30', endHour: '12h' }],
          date: '05/03/2020',
        },
        {
          course,
          address: '2 Place de la Concorde 59600 Maubeuge',
          slots: [{ startHour: '09h30', endHour: '12h' }],
          date: '08/09/2020',
        },
      ],
    };
    const table = {
      body: [
        [{ text: 'Prénom NOM', style: 'header' }, { text: '09h30 - 12h', style: 'header' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }],
        [{ text: 'Signature de l\'intervenant·e', italics: true, margin: [0, 8, 0, 0] }, { text: '' }],
      ],
      widths: ['50%', '*'],
      heights: ['auto', 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    };
    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 64 },
            [
              { image: paths[1], width: 132, height: 28, alignment: 'right' },
              { text: 'Feuille d\'émargement - 05/03/2020', style: 'title' },
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
              { text: 'Nom de la formation : La communication empathique - Groupe 3', bold: true, marginBottom: 10 },
              { text: 'Durée : 5h' },
              { text: 'Lieu : Rue Jean Jaurès 59620 Aulnoye-Aymeries' },
              { text: 'Structure : Alenvi Home SAS' },
              { text: 'Intervenant·e : Ken Kaneki' },
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
              { text: 'Feuille d\'émargement - 08/09/2020', style: 'title' },
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
              { text: 'Nom de la formation : La communication empathique - Groupe 3', bold: true, marginBottom: 10 },
              { text: 'Durée : 5h' },
              { text: 'Lieu : 2 Place de la Concorde 59600 Maubeuge' },
              { text: 'Structure : Alenvi Home SAS' },
              { text: 'Intervenant·e : Ken Kaneki' },
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

    const result = await IntraAttendanceSheet.getPdfContent(data);

    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('it should format and return pdf content (intra_holding) (1 slot per day)', async () => {
    const paths = [
      'src/data/pdf/tmp/conscience.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/decision.png',
      'src/data/pdf/tmp/signature.png',
    ];
    const course = {
      name: 'La communication empathique - Groupe 3',
      duration: '5h',
      company: 'Alenvi Home SAS, Biens Communs',
      trainer: '',
      type: INTRA_HOLDING,
    };
    const data = {
      dates: [
        {
          course,
          address: 'Rue Jean Jaurès 59620 Aulnoye-Aymeries',
          slots: [{ startHour: '09h30', endHour: '12h' }],
          date: '05/03/2020',
        },
        {
          course,
          address: '2 Place de la Concorde 59600 Maubeuge',
          slots: [{ startHour: '09h30', endHour: '12h' }],
          date: '08/09/2020',
        },
      ],
    };
    const table = {
      body: [
        [
          { text: 'Prénom NOM', style: 'header' },
          { text: 'Structure', style: 'header' },
          { text: '09h30 - 12h', style: 'header' },
        ],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }],
        [{ text: 'Signature de l\'intervenant·e', italics: true, margin: [0, 8, 0, 0] }, { text: '' }, { text: '' }],
      ],
      widths: ['50%', '30%', '*'],
      heights: ['auto', 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    };
    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 64 },
            [
              { image: paths[1], width: 132, height: 28, alignment: 'right' },
              { text: 'Feuille d\'émargement - 05/03/2020', style: 'title' },
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
              { text: 'Nom de la formation : La communication empathique - Groupe 3', bold: true, marginBottom: 10 },
              { text: 'Durée : 5h' },
              { text: 'Lieu : Rue Jean Jaurès 59620 Aulnoye-Aymeries' },
              { text: 'Structure : Alenvi Home SAS, Biens Communs' },
              { text: 'Intervenant·e : ' },
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
              { text: 'Feuille d\'émargement - 08/09/2020', style: 'title' },
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
              { text: 'Nom de la formation : La communication empathique - Groupe 3', bold: true, marginBottom: 10 },
              { text: 'Durée : 5h' },
              { text: 'Lieu : 2 Place de la Concorde 59600 Maubeuge' },
              { text: 'Structure : Alenvi Home SAS, Biens Communs' },
              { text: 'Intervenant·e : ' },
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

    const result = await IntraAttendanceSheet.getPdfContent(data);

    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('it should format and return pdf content (intra_holding) (2 slots per day)', async () => {
    const paths = [
      'src/data/pdf/tmp/conscience.png',
      'src/data/pdf/tmp/compani.png',
      'src/data/pdf/tmp/decision.png',
      'src/data/pdf/tmp/signature.png',
    ];
    const course = {
      name: 'La communication empathique - Groupe 3',
      duration: '5h',
      company: 'Alenvi Home SAS, Biens Communs',
      trainer: 'Anne Onyme',
      type: INTRA_HOLDING,
    };
    const data = {
      dates: [
        {
          course,
          address: 'Rue Jean Jaurès 59620 Aulnoye-Aymeries',
          slots: [{ startHour: '09h30', endHour: '12h' }, { startHour: '14h30', endHour: '17h' }],
          date: '05/03/2020',
        },
      ],
    };
    const table = {
      body: [
        [
          { text: 'Prénom NOM', style: 'header' },
          { text: 'Structure', style: 'header' },
          { text: '09h30 - 12h', style: 'header' },
          { text: '14h30 - 17h', style: 'header' },
        ],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        [
          { text: 'Signature de l\'intervenant·e', italics: true, margin: [0, 8, 0, 0] },
          { text: '' }, { text: '' },
          { text: '' },
        ],
      ],
      widths: ['40%', '25%', '*', '*'],
      heights: ['auto', 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    };
    const pdf = {
      content: [
        {
          columns: [
            { image: paths[0], width: 64 },
            [
              { image: paths[1], width: 132, height: 28, alignment: 'right' },
              { text: 'Feuille d\'émargement - 05/03/2020', style: 'title' },
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
              { text: 'Nom de la formation : La communication empathique - Groupe 3', bold: true, marginBottom: 10 },
              { text: 'Durée : 5h' },
              { text: 'Lieu : Rue Jean Jaurès 59620 Aulnoye-Aymeries' },
              { text: 'Structure : Alenvi Home SAS, Biens Communs' },
              { text: 'Intervenant·e : Anne Onyme' },
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

    const result = await IntraAttendanceSheet.getPdfContent(data);

    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});

describe('getPdf', () => {
  let getPdfContent;
  let generatePdf;

  beforeEach(() => {
    getPdfContent = sinon.stub(IntraAttendanceSheet, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    getPdfContent.restore();
    generatePdf.restore();
  });

  it('should get pdf', async () => {
    const data = {
      dates: [
        {
          address: 'Rue Jean Jaurès 59620 Aulnoye-Aymeries',
          slots: [{ startHour: '09h30', endHour: '12h' }],
          date: '05/03/2020',
        },
        {
          address: '2 Place de la Concorde 59600 Maubeuge',
          slots: [{ startHour: '09h30', endHour: '12h' }],
          date: '08/09/2020',
        },
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

    const result = await IntraAttendanceSheet.getPdf(data);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });
});
