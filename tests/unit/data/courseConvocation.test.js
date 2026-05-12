const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const FileHelper = require('../../../src/helpers/file');
const PdfHelper = require('../../../src/helpers/pdf');
const CourseConvocation = require('../../../src/data/pdf/courseConvocation');
const { COPPER_GREY_200, COPPER_500 } = require('../../../src/helpers/constants');

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
      'src/data/pdf/tmp/aux-pouce.png',
      'src/data/pdf/tmp/doct-explication.png',
      'src/data/pdf/tmp/doct-explication.png',
      'src/data/pdf/tmp/aux-perplexite.png',
    ];
    downloadImages.returns(paths);

    const data = {
      misc: 'groupe 3',
      tradeName: 'test',
      subProgram: { program: { name: 'test', description: 'on va apprendre' } },
      slots: [
        { date: '23/12/2020', hours: '12h - 14h', address: '' },
        { date: '14/01/2020', hours: '12h - 14h', address: '24 avenue du test' },
        { date: '15/01/2020', hours: '12h - 14h', meetingLink: 'https://pointerpointer.com/' },
      ],
      slotsToPlan: [{ _id: new ObjectId() }],
      trainers: [
        { formattedIdentity: 'Toto TITI', biography: 'Voici ma bio' },
        { formattedIdentity: 'Tata TUTU', biography: 'Voici ma bio' },
      ],
      contact: { formattedIdentity: 'Ca roule', formattedPhone: '09 87 65 43 21', email: 'test@test.fr' },
    };

    const result = await CourseConvocation.getPdfContent(data);

    const header = [
      {
        columns: [
          { image: 'src/data/pdf/tmp/aux-pouce.png', width: 64 },
          [
            { text: 'Vous êtes convoqué(e) à la formation', style: 'surtitle' },
            { text: 'test - groupe 3', style: 'title' },
            { canvas: [{ type: 'line', x1: 20, y1: 10, x2: 450, y2: 10, lineWidth: 1.5, lineColor: COPPER_GREY_200 }] },
          ],
        ],
      },
    ];

    const table = [
      {
        table: {
          body: [
            [
              { text: 'Dates', style: 'tableHeader' },
              { text: 'Heures', style: 'tableHeader' },
              { text: 'Lieux', style: 'tableHeader', alignment: 'left' },
            ],
            [
              { text: '23/12/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              { text: '' },
            ],
            [
              { text: '14/01/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              {
                text: [
                  { text: ' ', style: 'icon' },
                  { text: '24 avenue du test', style: 'tableContent', alignment: 'left' },
                ],
                margin: [0, 4, 0, 4],
              },
            ],
            [
              { text: '15/01/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              {
                text: [
                  { text: ' ', style: 'icon' },
                  {
                    text: 'https://pointerpointer.com/',
                    link: 'https://pointerpointer.com/',
                    style: 'tableContent',
                    decoration: 'underline',
                    alignment: 'left',
                  },
                ],
                margin: [0, 4, 0, 4],
              },
            ],
          ],
          height: 24,
          widths: ['auto', '*', '*'],
        },
        layout: { vLineWidth: () => 0, hLineWidth: () => 1, hLineColor: () => COPPER_GREY_200 },
        marginTop: 24,
      },
      { text: 'Il reste 1 créneau(x) à planifier.', style: 'notes' },
    ];

    const programInfo = {
      columns: [
        { image: 'src/data/pdf/tmp/doct-explication.png', width: 64 },
        [{ text: 'Programme de la formation', style: 'infoTitle' }, { text: 'on va apprendre', style: 'infoContent' }],
      ],
      marginTop: 24,
      columnGap: 12,
    };

    const trainersInfo = {
      columns: [
        { image: 'src/data/pdf/tmp/doct-explication.png', width: 64 },
        [
          [
            { text: 'Intervenant·e', style: 'infoTitle' },
            { text: 'Toto TITI', style: 'infoSubTitle' },
            { text: 'Voici ma bio', style: 'infoContent' },
          ],
          [
            { text: 'Intervenant·e', style: 'infoTitle' },
            { text: 'Tata TUTU', style: 'infoSubTitle' },
            { text: 'Voici ma bio', style: 'infoContent' },
          ],
        ],
      ],
      marginTop: 24,
      columnGap: 12,
    };

    const contactInfo = {
      columns: [
        { image: 'src/data/pdf/tmp/aux-perplexite.png', width: 64 },
        [
          { text: 'Votre contact pour la formation', style: 'infoTitle' },
          { text: 'Ca roule', style: 'infoSubTitle' },
          { text: '09 87 65 43 21', style: 'infoSubTitle' },
          { text: 'test@test.fr', style: 'infoSubTitle' },
        ],
      ],
      marginTop: 24,
      columnGap: 12,
    };

    const pdf = {
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
    };
    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-explication.png', name: 'doct-explication.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-quizz.png', name: 'doct-quizz.png' },
      { url: 'https://storage.googleapis.com/compani-main/aux-perplexite.png', name: 'aux-perplexite.png' },
    ];
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('it should format and return pdf content with less infos', async () => {
    const paths = [
      'src/data/pdf/tmp/aux-pouce.png',
      'src/data/pdf/tmp/doct-explication.png',
      'src/data/pdf/tmp/doct-explication.png',
      'src/data/pdf/tmp/aux-perplexite.png',
    ];
    downloadImages.returns(paths);

    const data = {
      tradeName: 'test',
      subProgram: { program: { name: 'test' } },
      slots: [
        { date: '23/12/2020', hours: '12h - 14h' },
        { date: '14/01/2020', hours: '12h - 14h', address: '24 avenue du test' },
        { date: '22/01/2020', hours: '12h - 14h', meetingLink: 'https://mondrianandme.com/' },
      ],
      trainers: [
        { identity: { firstname: 'Ken', lastname: 'Kaneki' }, formattedIdentity: 'Ken KANEKI', biography: 'Ghoul' },
      ],
    };

    const result = await CourseConvocation.getPdfContent(data);

    const header = [
      {
        columns: [
          { image: 'src/data/pdf/tmp/aux-pouce.png', width: 64 },
          [
            { text: 'Vous êtes convoqué(e) à la formation', style: 'surtitle' },
            { text: 'test', style: 'title' },
            { canvas: [{ type: 'line', x1: 20, y1: 10, x2: 450, y2: 10, lineWidth: 1.5, lineColor: COPPER_GREY_200 }] },
          ],
        ],
      },
    ];

    const table = [
      {
        table: {
          body: [
            [
              { text: 'Dates', style: 'tableHeader' },
              { text: 'Heures', style: 'tableHeader' },
              { text: 'Lieux', style: 'tableHeader', alignment: 'left' },
            ],
            [
              { text: '23/12/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              {
                text: '',
              },
            ],
            [
              { text: '14/01/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              {
                text: [
                  { text: ' ', style: 'icon' },
                  { text: '24 avenue du test', style: 'tableContent', alignment: 'left' },
                ],
                margin: [0, 4, 0, 4],
              },
            ],
            [
              { text: '22/01/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              {
                text: [
                  { text: ' ', style: 'icon' },
                  {
                    text: 'https://mondrianandme.com/',
                    link: 'https://mondrianandme.com/',
                    style: 'tableContent',
                    decoration: 'underline',
                    alignment: 'left',
                  },
                ],
                margin: [0, 4, 0, 4],
              },
            ],
          ],
          height: 24,
          widths: ['auto', '*', '*'],
        },
        layout: { vLineWidth: () => 0, hLineWidth: () => 1, hLineColor: () => COPPER_GREY_200 },
        marginTop: 24,
      },
    ];

    const programInfo = {
      columns: [
        { image: 'src/data/pdf/tmp/doct-explication.png', width: 64 },
        [{ text: 'Programme de la formation', style: 'infoTitle' }, { text: '', style: 'infoContent' }],
      ],
      marginTop: 24,
      columnGap: 12,
    };

    const trainersInfo = {
      columns: [
        { image: 'src/data/pdf/tmp/doct-explication.png', width: 64 },
        [
          [
            { text: 'Intervenant·e', style: 'infoTitle' },
            { text: 'Ken KANEKI', style: 'infoSubTitle' },
            { text: 'Ghoul', style: 'infoContent' },
          ],
        ],
      ],
      marginTop: 24,
      columnGap: 12,
    };

    const contactInfo = {
      columns: [
        { image: 'src/data/pdf/tmp/aux-perplexite.png', width: 64 },
        [
          { text: 'Votre contact pour la formation', style: 'infoTitle' },
          { text: '', style: 'infoSubTitle' },
          { text: '', style: 'infoSubTitle' },
          { text: '', style: 'infoSubTitle' },
        ],
      ],
      marginTop: 24,
      columnGap: 12,
    };

    const pdf = {
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
    };
    expect(JSON.stringify(result.template)).toEqual(JSON.stringify(pdf));
    expect(result.images).toEqual(paths);

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-explication.png', name: 'doct-explication.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-quizz.png', name: 'doct-quizz.png' },
      { url: 'https://storage.googleapis.com/compani-main/aux-perplexite.png', name: 'aux-perplexite.png' },
    ];
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});

describe('getPdf', () => {
  let getPdfContent;
  let generatePdf;

  beforeEach(() => {
    getPdfContent = sinon.stub(CourseConvocation, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    getPdfContent.restore();
    generatePdf.restore();
  });

  it('should get pdf', async () => {
    const data = {
      misc: 'groupe 3',
      tradeName: 'test',
      subProgram: { program: { name: 'test', description: 'on va apprendre' } },
      slots: [
        { date: '23/12/2020', hours: '12h - 14h', address: '' },
        { date: '14/01/2020', hours: '12h - 14h', address: '24 avenue du test' },
        { date: '15/01/2020', hours: '12h - 14h', meetingLink: 'https://pointerpointer.com/' },
      ],
      slotsToPlan: [{ _id: new ObjectId() }],
      trainer: { formattedIdentity: 'test OK', biography: 'Voici ma bio' },
      contact: { formattedIdentity: 'Ca roule', formattedPhone: '09 87 65 43 21', email: 'test@test.fr' },
    };
    const template = {
      content: [
        {
          columns: [
            { image: 'src/data/pdf/tmp/aux-pouce.png', width: 64 },
            [
              { text: 'Vous êtes convoqué(e) à la formation', style: 'surtitle' },
              { text: 'test', style: 'title' },
            ],
          ],
        },
        {
          columns: [
            { image: 'src/data/pdf/tmp/doct-explication.png', width: 64 },
            [{ text: 'Programme de la formation', style: 'infoTitle' }, { text: '', style: 'infoContent' }],
          ],
          marginTop: 24,
          columnGap: 12,
        },
      ].flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        title: { fontSize: 20, bold: true, color: COPPER_500, marginLeft: 24 },
        surtitle: { fontSize: 12, bold: true, marginTop: 24, marginLeft: 24 },
        infoTitle: { fontSize: 14, bold: true },
        infoContent: { italics: true, marginBottom: 12 },
      },
    };
    const images = [
      { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-explication.png', name: 'doct-explication.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-quizz.png', name: 'doct-quizz.png' },
      { url: 'https://storage.googleapis.com/compani-main/aux-perplexite.png', name: 'aux-perplexite.png' },
    ];
    getPdfContent.returns({ template, images });
    generatePdf.returns('pdf');

    const result = await CourseConvocation.getPdf(data);

    expect(result).toEqual('pdf');
    sinon.assert.calledOnceWithExactly(getPdfContent, data);
    sinon.assert.calledOnceWithExactly(generatePdf, template, images);
  });
});
