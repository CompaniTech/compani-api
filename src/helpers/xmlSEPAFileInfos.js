const CoursePayment = require('../models/CoursePayment');
const xmlSEPAFileInfos = require('../models/XmlSEPAFileInfos');
const { XML_GENERATED } = require('./constants');

exports.downloadXmlSEPAFile = async (payload) => {
  const { payments, name } = payload;

  await xmlSEPAFileInfos.create({ coursePayments: payments, name });
  await CoursePayment.updateMany({ _id: { $in: payments } }, { $set: { status: XML_GENERATED } });

  return { name: `Prelevements_SEPA_${name}.xml` };
};
