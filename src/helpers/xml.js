const builder = require('xmlbuilder');
const fs = require('fs');
const os = require('os');
const path = require('path');

const generateXML = async (data, outputPath) => new Promise((resolve, reject) => {
  const finalDoc = builder.create(data, { encoding: 'utf-8' });
  const file = fs.createWriteStream(outputPath);
  file.write(finalDoc.end({ pretty: true }));
  file.end();
  file.on('finish', async () => { resolve(outputPath); });
  file.on('error', err => reject(err));
});

exports.generateSEPAFile = async (payments, name) => {
  const xmlContent = {
    Document: {
      '@xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02',
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@xsi:schemaLocation': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02 pain.008.001.02.xsd',
      CstmrDrctDbtInitn: {
        GrpHdr: {},
        PmtInf: [],
      },
    },
  };
  const outputPath = path.join(os.tmpdir(), name);

  const nameWithousSpaces = name.replace(/ /g, '');
  return { file: await generateXML(xmlContent, outputPath), fileName: `Prelevements_SEPA_${nameWithousSpaces}.xml` };
};
