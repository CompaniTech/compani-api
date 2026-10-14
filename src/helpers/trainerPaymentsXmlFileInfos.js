const os = require('os');
const path = require('path');
const { ObjectId } = require('mongodb');
const randomize = require('randomatic');
const { decrypt } = require('./encryption');
const TrainerPayment = require('../models/TrainerPayment');
const VendorCompany = require('../models/VendorCompany');
const TrainerPaymentsXmlFileInfos = require('../models/TrainerPaymentsXmlFileInfos');
const XmlHelper = require('./xml');
const { XML_GENERATED, YYYY_MM_DD, BANK_TRANSFER } = require('./constants');
const { CompaniDate } = require('./dates/companiDates');
const UtilsHelper = require('./utils');
const NumbersHelper = require('./numbers');

exports.generateSEPAHeader = data => ({
  MsgId: data.sepaId,
  CreDtTm: data.createdDate,
  NbOfTxs: data.transactionsCount,
  CtrlSum: data.totalSum,
  InitgPty: { Nm: data.debtorName },
});

exports.generatePaymentInfo = data => ({
  PmtInfId: data._id,
  PmtMtd: 'TRF',
  BtchBookg: true,
  NbOfTxs: data.txNumber,
  CtrlSum: data.sum,
  PmtTpInf: {
    SvcLvl: { Cd: 'SEPA' },
    CtgyPurp: { Cd: 'SALA' },
  },
  ReqdExctnDt: data.executionDate,
  Dbtr: { Nm: data.debtor.name },
  DbtrAcct: {
    Id: { IBAN: data.debtor.iban },
    Ccy: 'EUR',
  },
  DbtrAgt: { FinInstnId: { BIC: data.debtor.bic } },
  ChrgBr: 'SLEV',
  CdtTrfTxInf: [],
});

exports.generateTransactionInfos = transaction => ({
  PmtId: {
    InstrId: transaction._id,
    EndToEndId: transaction.number,
  },
  Amt: {
    InstdAmt: {
      '@Ccy': 'EUR',
      '#text': transaction.amount,
    },
  },
  CdtrAgt: { FinInstnId: { BIC: transaction.creditorBIC } },
  Cdtr: { Nm: transaction.creditorName.trim() },
  CdtrAcct: { Id: { IBAN: transaction.creditorIBAN } },
  RmtInf: { Ustrd: transaction.trainerBillNumber },
});

exports.generateBankTransferFile = async (paymentIds, name) => {
  const xmlContent = XmlHelper.createDocument(BANK_TRANSFER);
  const outputPath = path.join(os.tmpdir(), UtilsHelper.sanitizeFileName(name));

  const payments = await TrainerPayment
    .find({ _id: { $in: paymentIds } })
    .populate({
      path: 'trainerBill',
      select: 'number trainer',
      populate: { path: 'trainer', select: 'identity bic iban' },
    })
    .lean();

  const paymentsWithDecryptedTrainer = payments.map((p) => {
    const { trainer } = p.trainerBill;
    const decryptedTrainer = { ...trainer };
    if (decryptedTrainer.iban.includes(':')) decryptedTrainer.iban = decrypt(decryptedTrainer.iban);
    if (decryptedTrainer.bic.includes(':')) decryptedTrainer.bic = decrypt(decryptedTrainer.bic);
    return { ...p, trainerBill: { ...p.trainerBill, trainer: decryptedTrainer } };
  });

  const vendorCompany = await VendorCompany.findOne().lean();
  const randomId = randomize('0', 21);
  const totalSum = NumbersHelper.toFixedToFloat(
    NumbersHelper.toNumber(payments.reduce((acc, next) => NumbersHelper.add(acc, next.amount), 0)),
    2
  );

  xmlContent.Document.CstmrCdtTrfInitn.GrpHdr = exports.generateSEPAHeader({
    sepaId: `MSG00000${randomId}G`,
    createdDate: CompaniDate().toLocalISO().slice(0, 19),
    transactionsCount: payments.length,
    totalSum,
    debtorName: vendorCompany.name,
  });

  const paymentInfo = exports.generatePaymentInfo({
    _id: `MSG00000${randomId}G`,
    txNumber: payments.length,
    sum: totalSum,
    executionDate: CompaniDate().format(YYYY_MM_DD),
    debtor: { name: vendorCompany.name, iban: vendorCompany.iban, bic: vendorCompany.bic },
  });

  for (const payment of paymentsWithDecryptedTrainer) {
    const { trainer, number: trainerBillNumber } = payment.trainerBill;
    const transactionAmount = NumbersHelper.toFixedToFloat(NumbersHelper.toNumber(payment.amount), 2);

    const formattedTransaction = {
      _id: new ObjectId().toHexString(),
      number: trainerBillNumber,
      amount: transactionAmount,
      creditorName: UtilsHelper.formatIdentity(trainer.identity, 'FL'),
      creditorIBAN: trainer.iban,
      creditorBIC: trainer.bic,
      trainerBillNumber,
    };
    paymentInfo.CdtTrfTxInf.push(exports.generateTransactionInfos(formattedTransaction));
  }

  xmlContent.Document.CstmrCdtTrfInitn.PmtInf = [paymentInfo];

  return XmlHelper.generateXML(xmlContent, outputPath);
};

exports.create = async (payload) => {
  const { payments, name } = payload;

  const file = await exports.generateBankTransferFile(payments, name);

  await TrainerPaymentsXmlFileInfos.create({ trainerPayments: payments, name });
  await TrainerPayment.updateMany({ _id: { $in: payments } }, { $set: { status: XML_GENERATED } });

  return file;
};
