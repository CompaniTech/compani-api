const { expect } = require('expect');
const axios = require('axios');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FileHelper = require('../../../src/helpers/file');

describe('downloadImages', () => {
  let get;
  let createAndReadFile;

  beforeEach(() => {
    get = sinon.stub(axios, 'get');
    createAndReadFile = sinon.stub(FileHelper, 'createAndReadFile');
  });

  afterEach(() => {
    get.restore();
    createAndReadFile.restore();
  });

  it('should download images from GCS', async () => {
    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/aux-conscience-eclairee.png', name: 'conscience.png' },
      { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
    ];
    const response = { data: {} };

    get.returns(response);

    const result = await FileHelper.downloadImages(imageList);

    sinon.assert.match(result[0], new RegExp(`src/data/pdf/tmp/[A-Za-z]{10}${imageList[0].name}`));
    sinon.assert.match(result[1], new RegExp(`src/data/pdf/tmp/[A-Za-z]{10}${imageList[1].name}`));
    sinon.assert.calledWithExactly(get.getCall(0), imageList[0].url, { responseType: 'stream' });
    sinon.assert.calledWithExactly(get.getCall(1), imageList[1].url, { responseType: 'stream' });
    sinon.assert.calledWithExactly(
      createAndReadFile.getCall(0),
      response.data,
      sinon.match(new RegExp(`src/data/pdf/tmp/[A-Za-z]{10}${imageList[0].name}`))
    );
    sinon.assert.calledWithExactly(
      createAndReadFile.getCall(1),
      response.data,
      sinon.match(new RegExp(`src/data/pdf/tmp/[A-Za-z]{10}${imageList[1].name}`))
    );
  });
});

describe('deleteImages', () => {
  let rmSync;

  beforeEach(() => {
    rmSync = sinon.stub(fs, 'rmSync');
  });

  afterEach(() => {
    rmSync.restore();
  });

  it('should do nothing if no images to delete', async () => {
    await FileHelper.deleteImages([]);

    sinon.assert.notCalled(rmSync);
  });

  it('should delete images', async () => {
    const images = ['src/data/pdf/tmp/toto.png', 'src/data/pdf/tmp/tata.pdf'];
    await FileHelper.deleteImages(images);

    sinon.assert.calledTwice(rmSync);
    sinon.assert.calledWithExactly(rmSync.getCall(0), 'src/data/pdf/tmp/toto.png');
    sinon.assert.calledWithExactly(rmSync.getCall(1), 'src/data/pdf/tmp/tata.pdf');
  });
});

describe('exportToCsv', () => {
  it('should return a csv file path from data array', async () => {
    const date = new Date('2020-01-04');
    const fakeDate = sinon.useFakeTimers(date);
    const data = [['Prénom', 'Nom', 'Age'], ['Jean', 'Bonbeurre', 50], ['Bob', 'Eponge', 20]];
    const outputPath = path.join(os.tmpdir(), `exports-${date.getTime()}.csv`);
    const writeFileStub = sinon.stub(fs.promises, 'writeFile');
    const csvContent = '\ufeff"Prénom";"Nom";"Age"\r\n"Jean";"Bonbeurre";50\r\n"Bob";"Eponge";20';

    const result = await FileHelper.exportToCsv(data);
    expect(result).toBe(outputPath);
    sinon.assert.calledWithExactly(writeFileStub, outputPath, csvContent, 'utf8');
    writeFileStub.restore();
    fakeDate.restore();
  });
});

describe('downloadFiles', () => {
  let get;

  beforeEach(() => {
    get = sinon.stub(axios, 'get');
  });

  afterEach(() => {
    get.restore();
  });

  it('should download list of pdfs', async () => {
    const fileList = [
      { link: 'https://test/compani/pdf-1.pdf', name: 'name/test' },
      { link: 'https://test/compani/pdf-2.pdf' },
      { link: 'https://test/compani/png-1.png' },
    ];

    get.onCall(0).returns({ data: { buffer: '1' }, headers: { 'content-type': 'application/pdf' } });
    get.onCall(1).returns({ data: { buffer: '2' }, headers: { 'content-type': 'application/pdf' } });
    get.onCall(2).returns({ data: { buffer: '3' }, headers: { 'content-type': 'image/png' } });

    const result = await FileHelper.downloadFiles(fileList);
    expect(result).toEqual([
      { name: 'name_test.pdf', file: { buffer: '1' } },
      { name: 'document-2.pdf', file: { buffer: '2' } },
      { name: 'document-3.png', file: { buffer: '3' } },
    ]);

    sinon.assert.calledWithExactly(get.getCall(0), fileList[0].link, { responseType: 'arraybuffer' });
    sinon.assert.calledWithExactly(get.getCall(1), fileList[1].link, { responseType: 'arraybuffer' });
    sinon.assert.calledWithExactly(get.getCall(2), fileList[2].link, { responseType: 'arraybuffer' });
  });
});
