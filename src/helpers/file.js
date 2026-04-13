const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const randomize = require('randomatic');

const fsPromises = fs.promises;
const TMP_FILES_PATH = `${path.resolve(__dirname, '../data/pdf/tmp')}/`;

exports.createAndReadFile = async (stream, outputPath) => new Promise((resolve, reject) => {
  const tmpFile = fs.createWriteStream(outputPath)
    .on('finish', () => { resolve(outputPath); })
    .on('error', err => reject(err));

  stream.pipe(tmpFile);
});

exports.downloadImages = async (imageList) => {
  if (!fs.existsSync(TMP_FILES_PATH)) fs.mkdirSync(TMP_FILES_PATH);

  const paths = [];
  for (const image of imageList) {
    const { url, name } = image;
    const response = await axios.get(url, { responseType: 'stream' });
    const filePath = `${TMP_FILES_PATH}${randomize('Aa', 10)}${name}`;
    await this.createAndReadFile(response.data, filePath);
    paths.push(filePath);
  }

  return paths;
};

exports.deleteImages = (images = []) => { images.forEach((i) => { fs.rmSync(i); }); };

exports.exportToCsv = async (data) => {
  let csvContent = '\ufeff'; // UTF16LE BOM for Microsoft Excel
  data.forEach((rowArray, index) => {
    const rowArrayQuoted = rowArray.map((cell) => {
      if (cell === '') return cell;
      return typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell;
    });
    const row = rowArrayQuoted.join(';');

    csvContent += index === data.length - 1 ? row : `${row}\r\n`;
  });

  const date = new Date();
  const tmpOutputPath = path.join(os.tmpdir(), `exports-${date.getTime()}.csv`);

  await fsPromises.writeFile(tmpOutputPath, csvContent, 'utf8');

  return tmpOutputPath;
};

exports.exportToTxt = async (data) => {
  let textContent = '';
  data.forEach((rowArray) => { textContent += `${rowArray.join('\t')}\r\n`; });

  const date = new Date();
  const tmpOutputPath = path.join(os.tmpdir(), `exports-${date.getTime()}.txt`);

  await fsPromises.writeFile(tmpOutputPath, textContent, { encoding: 'ascii' });

  return tmpOutputPath;
};

exports.downloadPdfs = async fileList => Promise.all(
  fileList.map(async (file, index) => {
    const { data } = await axios.get(file.link, { responseType: 'arraybuffer' });
    const fileName = (file.name ? `${file.name}.pdf` : `document-${index + 1}.pdf`).replace(/[/\\]/g, '_');
    return { name: fileName, file: data };
  })
);
