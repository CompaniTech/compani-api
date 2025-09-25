const builder = require('xmlbuilder');
const fs = require('fs');

exports.generateXML = async (data, outputPath) => new Promise((resolve, reject) => {
  const finalDoc = builder.create(data, { encoding: 'utf-8' });
  const file = fs.createWriteStream(outputPath);
  file.write(finalDoc.end({ pretty: true }));
  file.end();
  file.on('finish', async () => { resolve(outputPath); });
  file.on('error', err => reject(err));
});

exports.createDocument = () => ({
  Document: {
    '@xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02',
    '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    '@xsi:schemaLocation': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02 pain.008.001.02.xsd',
    CstmrDrctDbtInitn: {
      GrpHdr: {},
      PmtInf: [],
    },
  },
});
