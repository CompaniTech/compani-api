const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.generateZip = (zipName, fileList = []) => new Promise((resolve, reject) => {
  const zip = new JSZip();
  for (const file of fileList) {
    zip.file(file.name, file.file);
  }

  const tmpOutputPath = path.join(os.tmpdir(), zipName);

  const stream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
  stream.pipe(fs.createWriteStream(tmpOutputPath))
    .on('finish', () => resolve({ zipPath: tmpOutputPath, zipName }))
    .on('error', err => reject(err));
});

exports.generateZipNew = (zipName, zip) => new Promise((resolve, reject) => {
  const tmpOutputPath = path.join(os.tmpdir(), zipName);

  const stream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
  stream.pipe(fs.createWriteStream(tmpOutputPath))
    .on('finish', () => resolve({ zipPath: tmpOutputPath, zipName }))
    .on('error', err => reject(err));
});
