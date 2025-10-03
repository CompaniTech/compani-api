const os = require('os');
const path = require('path');
const groupBy = require('lodash/groupBy');
const pick = require('lodash/pick');
const randomize = require('randomatic');
const { decrypt } = require('./encryption');
const CoursePayment = require('../models/CoursePayment');
const VendorCompany = require('../models/VendorCompany');
const xmlSEPAFileInfos = require('../models/XmlSEPAFileInfos');
const XmlHelper = require('./xml');
const { XML_GENERATED, YYYY_MM_DD } = require('./constants');
const { CompaniDate } = require('./dates/companiDates');
const UtilsHelper = require('./utils');

exports.generateSEPAHeader = data => ({
  MsgId: data.sepaId,
  CreDtTm: data.createdDate,
  NbOfTxs: data.transactionsCount,
  CtrlSum: data.totalSum,
  InitgPty: {
    Nm: data.creditorName,
    Id: { OrgId: { Othr: { Id: data.ics } } },
  },
});

exports.generatePaymentInfo = data => ({
  PmtInfId: data.id,
  PmtMtd: data.method,
  NbOfTxs: data.txNumber,
  CtrlSum: data.sum,
  PmtTpInf: {
    SvcLvl: { Cd: 'SEPA' },
    LclInstrm: { Cd: 'CORE' },
    SeqTp: data.sequenceType,
  },
  ReqdColltnDt: data.collectionDate,
  Cdtr: { Nm: data.creditor.name },
  CdtrAcct: {
    Id: { IBAN: data.creditor.iban },
    Ccy: 'EUR',
  },
  CdtrAgt: { FinInstnId: { BIC: data.creditor.bic } },
  ChrgBr: 'SLEV',
  CdtrSchmeId: {
    Id: {
      PrvtId: {
        Othr: {
          Id: data.creditor.ics,
          SchmeNm: { Prtry: 'SEPA' },
        },
      },
    },
  },
  DrctDbtTxInf: [],
});

exports.generateTransactionInfos = transaction => ({
  PmtId: {
    EndToEndId: transaction.number,
  },
  InstdAmt: {
    '@Ccy': 'EUR',
    '#text': transaction.amount,
  },
  DrctDbtTx: {
    MndtRltdInf: {
      MndtId: transaction.debitorRUM,
      DtOfSgntr: transaction.mandateSignatureDate,
    },
  },
  DbtrAgt: { FinInstnId: { BIC: transaction.debitorBIC } },
  Dbtr: { Nm: transaction.debitorName.trim() },
  DbtrAcct: { Id: { IBAN: transaction.debitorIBAN } },
  RmtInf: { Ustrd: transaction.globalTransactionName },
});

exports.formatTransactionNumber = (payments) => {
  const paymentsGroupByCourseBill = groupBy(payments, p => p.courseBill.number);
  const transactionNumber = [];
  for (const courseBillNumber of Object.keys(paymentsGroupByCourseBill)) {
    const courseBillPayments = paymentsGroupByCourseBill[courseBillNumber];
    const paymentNumberList = courseBillPayments.map(p => p.number).join(',');
    transactionNumber.push(`${courseBillNumber}:${paymentNumberList}`);
  }
  return transactionNumber.join(',');
};

exports.generateSEPAFile = async (paymentIds, name) => {
  const xmlContent = XmlHelper.createDocument();
  const outputPath = path.join(os.tmpdir(), name);

  const payments = await CoursePayment
    .find({ _id: { $in: paymentIds } })
    .populate({
      path: 'courseBill',
      select: 'payer number',
      populate: { path: 'payer.company', select: 'bic iban name debitMandates' },
    })
    .setOptions({ isVendorUser: true })
    .lean();

  const paymentsWithDecryptedPayer = payments.map((p) => {
    const { payer } = p.courseBill;
    if (payer.iban.includes(':')) payer.iban = decrypt(payer.iban);
    if (payer.bic.includes(':')) payer.bic = decrypt(payer.bic);
    return { ...p, courseBill: { ...p.courseBill, payer } };
  });

  const paymentsGroupByPayer = groupBy(paymentsWithDecryptedPayer, 'courseBill.payer._id');
  const vendorCompany = await VendorCompany.findOne({}).lean();
  const randomId = randomize('0', 21);
  const totalSum = UtilsHelper.getFixedNumber(payments.reduce((acc, next) => acc + next.netInclTaxes, 0), 2);

  xmlContent.Document.CstmrDrctDbtInitn.GrpHdr = exports.generateSEPAHeader({
    sepaId: `MSG00000${randomId}G`,
    createdDate: CompaniDate().toISO(),
    transactionsCount: Object.keys(paymentsGroupByPayer).length,
    totalSum,
    creditorName: vendorCompany.name,
    ics: vendorCompany.ics,
  });

  const paymentInfo = exports.generatePaymentInfo({
    id: `MSG00000${randomId}R`,
    sequenceType: 'RCUR',
    method: 'DD',
    txNumber: Object.keys(paymentsGroupByPayer).length,
    sum: totalSum,
    collectionDate: CompaniDate().add('P1D').format(YYYY_MM_DD),
    creditor: {
      name: vendorCompany.name.split(' ')[0],
      iban: vendorCompany.iban,
      bic: vendorCompany.bic,
      ics: vendorCompany.ics,
    },
  });

  for (const payer of Object.keys(paymentsGroupByPayer)) {
    const payerPayments = paymentsGroupByPayer[payer];
    const transactionAmount = UtilsHelper.getFixedNumber(
      payerPayments.reduce((acc, next) => acc + next.netInclTaxes, 0),
      2
    );
    const payerInfos = pick(payerPayments[0].courseBill.payer, ['iban', 'bic', 'debitMandates', 'name']);
    const lastMandate = UtilsHelper.getLastVersion(payerInfos.debitMandates, 'createdAt');

    const formattedTransaction = {
      number: exports.formatTransactionNumber(payerPayments),
      amount: transactionAmount,
      debitorName: payerInfos.name,
      debitorIBAN: payerInfos.iban,
      debitorBIC: payerInfos.bic,
      debitorRUM: lastMandate.rum,
      mandateSignatureDate: CompaniDate(lastMandate.signedAt).format(YYYY_MM_DD),
      globalTransactionName: name.trim(),
    };
    paymentInfo.DrctDbtTxInf.push(exports.generateTransactionInfos(formattedTransaction));
  }

  xmlContent.Document.CstmrDrctDbtInitn.PmtInf = [paymentInfo];

  return XmlHelper.generateXML(xmlContent, outputPath);
};

exports.create = async (payload) => {
  const { payments, name } = payload;

  const file = exports.generateSEPAFile(payments, name);

  await xmlSEPAFileInfos.create({ coursePayments: payments, name });
  await CoursePayment.updateMany({ _id: { $in: payments } }, { $set: { status: XML_GENERATED } });

  return file;
};
