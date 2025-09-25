const CoursePayment = require('../models/CoursePayment');
const xmlSEPAFileInfos = require('../models/XmlSEPAFileInfos');
const XmlHelper = require('./xml');
const { XML_GENERATED } = require('./constants');

exports.create = async (payload) => {
  const { payments, name } = payload;

  await xmlSEPAFileInfos.create({ coursePayments: payments, name });
  await CoursePayment.updateMany({ _id: { $in: payments } }, { $set: { status: XML_GENERATED } });

  return XmlHelper.generateSEPAFile(payments, name);
};
