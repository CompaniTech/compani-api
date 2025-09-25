const os = require('os');
const path = require('path');
const groupBy = require('lodash/groupBy');
const randomize = require('randomatic');
const CoursePayment = require('../models/CoursePayment');
const VendorCompany = require('../models/VendorCompany');
const xmlSEPAFileInfos = require('../models/XmlSEPAFileInfos');
const XmlHelper = require('./xml');
const { XML_GENERATED } = require('./constants');
const { CompaniDate } = require('./dates/companiDates');
const { getFixedNumber } = require('./utils');

const generateSEPAHeader = data => ({
  MsgId: data.sepaId,
  CreDtTm: data.createdDate,
  NbOfTxs: data.transactionsCount,
  CtrlSum: data.totalSum,
  InitgPty: {
    Nm: data.creditorName,
    Id: { OrgId: { Othr: { Id: data.ics } } },
  },
});

const generateSEPAFile = async (paymentIds, name) => {
  const xmlContent = XmlHelper.createDocument();
  const outputPath = path.join(os.tmpdir(), name);

  const payments = await CoursePayment
    .find({ _id: { $in: paymentIds } })
    .populate({
      path: 'courseBill',
      select: 'payer',
      populate: { path: 'payer.company', select: 'bic iban name debitMandates' },
    })
    .lean();

  const paymentsGroupByPayer = groupBy(payments, p => p.courseBill.payer._id);
  const vendorCompany = await VendorCompany.findOne({}).lean();
  const randomId = randomize('0', 21);

  xmlContent.Document.CstmrDrctDbtInitn.GrpHdr = generateSEPAHeader({
    sepaId: `MSG00000${randomId}G`,
    createdDate: CompaniDate().format('yyyy-MM-DDTHH:mm:ss'),
    transactionsCount: Object.values(paymentsGroupByPayer).flat().length,
    totalSum: getFixedNumber(payments.reduce((acc, next) => acc + next.netInclTaxes, 0), 2),
    creditorName: vendorCompany.name,
    ics: vendorCompany.ics,
  });

  const nameWithousSpaces = name.replace(/ /g, '');
  return {
    file: await XmlHelper.generateXML(xmlContent, outputPath),
    fileName: `Prelevements_SEPA_${nameWithousSpaces}.xml`,
  };
};

exports.create = async (payload) => {
  const { payments, name } = payload;

  await xmlSEPAFileInfos.create({ coursePayments: payments, name });
  await CoursePayment.updateMany({ _id: { $in: payments } }, { $set: { status: XML_GENERATED } });

  return generateSEPAFile(payments, name);
};
