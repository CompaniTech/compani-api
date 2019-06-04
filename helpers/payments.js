const moment = require('moment');
const get = require('lodash/get');
const randomize = require('randomatic');
const { ObjectID } = require('mongodb');

const Payment = require('../models/Payment');
const PaymentNumber = require('../models/PaymentNumber');
const { REFUND, PAYMENT, WITHDRAWAL, PAYMENT_TYPES_LIST } = require('./constants');
const {
  createDocument,
  generateSEPAHeader,
  generateSEPAXml,
  generatePaymentInfo,
  addTransactionInfo
} = require('../helpers/xml');
const UtilsHelper = require('./utils');


exports.generatePaymentNumber = async (paymentNature) => {
  const numberQuery = {};
  switch (paymentNature) {
    case REFUND:
      numberQuery.prefix = `REMB-${moment().format('YYMM')}`;
      break;
    case PAYMENT:
      numberQuery.prefix = `REG-${moment().format('YYMM')}`;
      break;
  }
  const number = await PaymentNumber.findOneAndUpdate(
    numberQuery,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${number.prefix}${number.seq.toString().padStart(3, '0')}`;
};

const generateXML = async (firstPayments, recurPayments, company) => {
  const randomId = randomize('0', 31);
  const firstPaymentsTotal = firstPayments.reduce((acc, next) => acc + next.netInclTaxes, 0);
  const recurPaymentsTotal = recurPayments.reduce((acc, next) => acc + next.netInclTaxes, 0);
  const totalPayments = firstPaymentsTotal + recurPaymentsTotal;
  let firstPaymentsInfo = null;
  let recurPaymentsInfo = null;
  const doc = createDocument();
  const header = generateSEPAHeader({
    id: `MSG${randomId}G`,
    created: new Date(),
    initiatorName: company.name.split(' ')[0],
    txNumber: firstPayments.length + recurPayments.length,
    sum: totalPayments,
    ics: company.ics,
  });

  if (firstPayments.length > 0) {
    firstPaymentsInfo = generatePaymentInfo({
      id: `MSG${randomId}F`,
      sequenceType: 'FRST',
      method: 'DD',
      txNumber: firstPayments.length,
      sum: firstPaymentsTotal,
      collectionDate: new Date(),
      creditor: {
        name: company.name.split(' ')[0],
        iban: company.iban,
        bic: company.bic,
        ics: company.ics,
      }
    });
    firstPaymentsInfo = addTransactionInfo(firstPaymentsInfo, firstPayments);
  }

  if (recurPayments.length > 0) {
    recurPaymentsInfo = generatePaymentInfo({
      id: `MSG${randomId}R`,
      sequenceType: 'RCUR',
      method: 'DD',
      txNumber: recurPayments.length,
      sum: recurPaymentsTotal,
      collectionDate: new Date(),
      creditor: {
        name: company.name.split(' ')[0],
        iban: company.iban,
        bic: company.bic,
        ics: company.ics,
      }
    });
    recurPaymentsInfo = addTransactionInfo(recurPaymentsInfo, recurPayments);
  }

  const outputPath = await generateSEPAXml(doc, header, firstPaymentsInfo, recurPaymentsInfo);
  return outputPath;
};

exports.formatPayment = async (payment) => {
  const paymentNumber = await exports.generatePaymentNumber(payment.nature);
  payment.number = paymentNumber;
  payment._id = new ObjectID();
  return payment;
};

exports.savePayments = async (req) => {
  const promises = [];
  const firstPayments = [];
  const recurPayments = [];
  for (let payment of req.payload) {
    payment = await exports.formatPayment(payment);
    const countPayments = await Payment.countDocuments({ customer: payment.customer, type: WITHDRAWAL, rum: payment.rum });
    if (countPayments === 0) {
      firstPayments.push(payment);
    } else {
      recurPayments.push(payment);
    }

    const savedPayment = new Payment(payment);
    promises.push(savedPayment.save());
  }

  await Promise.all(promises);
  return generateXML(firstPayments, recurPayments, req.auth.credentials.company);
};

exports.exportPaymentsHistory = async (startDate, endDate) => {
  const query = {
    nature: PAYMENT,
    date: { $lte: endDate, $gte: startDate }
  };

  const payments = await Payment.find(query)
    .sort({ date: 'desc' })
    .populate({ path: 'customer', select: 'identity' })
    .populate({ path: 'client' })
    .lean();

  const header = [
    'Identifiant',
    'Date',
    'Id Bénéficiaire',
    'Bénéficiaire',
    'Id tiers payeur',
    'Tiers payeur',
    'Moyen de paiement',
    'Montant TTC en €'
  ];

  const rows = [header];

  for (const payment of payments) {
    const customerId = get(payment.customer, '_id');
    const clientId = get(payment.client, '_id');
    const cells = [
      payment.paymentNumber || '',
      moment(payment.date).format('DD/MM/YYYY'),
      customerId ? customerId.toHexString() : '',
      UtilsHelper.getFullTitleFromIdentity(get(payment.customer, 'identity')),
      clientId ? clientId.toHexString() : '',
      get(payment.client, 'name') || '',
      PAYMENT_TYPES_LIST[payment.type] || '',
      UtilsHelper.formatFloatForExport(payment.netInclTaxes),
    ];

    rows.push(cells);
  }

  return rows;
};
