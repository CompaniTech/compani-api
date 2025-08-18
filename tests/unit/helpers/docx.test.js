const sinon = require('sinon');
const { expect } = require('expect');
const path = require('path');
const os = require('os');
const fs = require('fs');
const DocxTemplater = require('docxtemplater');
const DocxHelper = require('../../../src/helpers/docx');
const drive = require('../../../src/models/Google/Drive');

describe('createDocx', () => {
  it('should return filled docx template path', async () => {
    const createDocxStub = sinon.stub(DocxHelper, 'createDocxTemplater').returns(new DocxTemplater());
    const generateStub = sinon.stub().returns('This is a filled zip file');
    const getZipStub = sinon.stub(DocxTemplater.prototype, 'getZip').returns({ generate: generateStub });
    const readFileStub = sinon.stub(fs.promises, 'readFile');
    const writeFileStub = sinon.stub(fs.promises, 'writeFile');
    const date = new Date('01-01-2020');
    const fakeDate = sinon.useFakeTimers(date);
    const filePath = '/src/test/docx.docx';
    const data = { name: 'Test' };
    const outputPath = path.join(os.tmpdir(), `template-filled-${date.getTime()}.docx`);

    const result = await DocxHelper.createDocx(filePath, data);

    expect(result).toBe(outputPath);
    sinon.assert.calledWithExactly(readFileStub, filePath, 'binary');
    sinon.assert.calledOnce(createDocxStub);
    sinon.assert.calledOnce(getZipStub);
    sinon.assert.calledWithExactly(generateStub, { type: 'nodebuffer' });
    sinon.assert.calledWithExactly(writeFileStub, outputPath, 'This is a filled zip file');
    getZipStub.restore();
    readFileStub.restore();
    writeFileStub.restore();
    fakeDate.restore();
  });
});

describe('generateDocx', () => {
  it('should download docx template from drive and return filled template path', async () => {
    const downloadFileByIdStub = sinon.stub(drive, 'downloadFileById');
    const createDocxStub = sinon.stub(DocxHelper, 'createDocx');
    const params = { file: { fileId: '1234567890' }, data: { name: 'Test' } };
    const tmpFilePath = path.join(os.tmpdir(), 'template.docx');
    const filledTemplate = path.join(os.tmpdir(), 'template-filled.docx');
    createDocxStub.returns(filledTemplate);

    const result = await DocxHelper.generateDocx(params);

    expect(result).toBe(filledTemplate);
    sinon.assert.calledWithExactly(downloadFileByIdStub, { ...params.file, tmpFilePath });
    sinon.assert.calledWithExactly(createDocxStub, tmpFilePath, params.data);
    downloadFileByIdStub.restore();
    createDocxStub.restore();
  });
});
