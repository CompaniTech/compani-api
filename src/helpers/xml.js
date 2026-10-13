const builder = require('xmlbuilder');
const fs = require('fs');
const { DIRECT_DEBIT } = require('./constants');

exports.generateXML = async (data, outputPath) => new Promise((resolve, reject) => {
  const finalDoc = builder.create(data, { encoding: 'utf-8' });
  const file = fs.createWriteStream(outputPath);
  file.write(finalDoc.end({ pretty: true }));
  file.end();
  file.on('finish', async () => { resolve(outputPath); });
  file.on('error', err => reject(err));
});

exports.createDocument = (type) => {
  const ISOMessage = type === DIRECT_DEBIT ? 'pain.008.001.02' : 'pain.001.001.03';
  const initObject = type === DIRECT_DEBIT
    ? { CstmrDrctDbtInitn: { GrpHdr: {}, PmtInf: [] } }
    : { CstmrCdtTrfInitn: { GrpHdr: {}, PmtInf: [] } };
  return {
    Document: {
      '@xmlns': `urn:iso:std:iso:20022:tech:xsd:${ISOMessage}`,
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@xsi:schemaLocation': `urn:iso:std:iso:20022:tech:xsd:${ISOMessage} ${ISOMessage}.xsd`,
      ...initObject,
    },
  };
};
