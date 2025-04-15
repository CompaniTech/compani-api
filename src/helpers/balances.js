const get = require('lodash/get');
const { ObjectId } = require('mongodb');
const { getLastVersion } = require('./utils');
const { PAYMENT, CESU } = require('./constants');
const BillRepository = require('../repositories/BillRepository');
const CreditNoteRepository = require('../repositories/CreditNoteRepository');
const PaymentRepository = require('../repositories/PaymentRepository');
const DatesHelper = require('./dates');
const NumbersHelper = require('./numbers');
const UtilsHelper = require('./utils');
const ThirdPartyPayer = require('../models/ThirdPartyPayer');
const Customer = require('../models/Customer');

exports.canBeDirectDebited = (bill) => {
  if (!bill) throw new Error('Bill must be provided');

  return !!(
    !bill._id.tpp &&
    bill.customer.payment &&
    bill.customer.payment.bankAccountOwner &&
    bill.customer.payment.bic &&
    bill.customer.payment.iban &&
    bill.customer.payment.mandates &&
    bill.customer.payment.mandates.length > 0 &&
    getLastVersion(bill.customer.payment.mandates, 'createdAt').signedAt
  );
};

exports.computeTotalString = (nature, total, netInclTaxes) => (nature === PAYMENT
  ? NumbersHelper.add(total, netInclTaxes)
  : NumbersHelper.subtract(total, netInclTaxes));

exports.computePayments = (payments) => {
  if (!payments || !Array.isArray(payments) || payments.length === 0) return 0;

  const totalString = payments.reduce(
    (acc, payment) => exports.computeTotalString(payment.nature, acc, payment.netInclTaxes),
    NumbersHelper.toString(0)
  );

  return NumbersHelper.toFixedToFloat(totalString);
};

exports.formatParticipationRate = (balanceDocument, tppList) => {
  const isTppBalance = !!balanceDocument.thirdPartyPayer;
  if (isTppBalance) return 0;

  const fundings = get(balanceDocument, 'customer.fundings') || null;
  if (!fundings) return 100;

  const sortedFundings = fundings
    .filter(fund => tppList.some(tpp => UtilsHelper.areObjectIdsEquals(tpp._id, fund.thirdPartyPayer) && tpp.isApa))
    .map(fund => UtilsHelper.mergeLastVersionWithBaseObject(fund, 'createdAt'))
    .sort((a, b) => b.customerParticipationRate - a.customerParticipationRate);

  return sortedFundings.length ? sortedFundings[0].customerParticipationRate : 100;
};

const isCustomerDoc = (base, doc) => !doc._id.tpp &&
  UtilsHelper.areObjectIdsEquals(doc._id.customer, base._id.customer);

const isCustomerAndTppDoc = (base, doc) => doc._id.tpp &&
  UtilsHelper.areObjectIdsEquals(doc._id.tpp, base._id.tpp) &&
  UtilsHelper.areObjectIdsEquals(doc._id.customer, base._id.customer);

exports.getBalance = (bill, customerAggregation, tppAggregation, payments, tppList) => {
  const matchingCreditNote = !bill._id.tpp
    ? customerAggregation.find(cn => isCustomerDoc(bill, cn))
    : tppAggregation.find(cn => isCustomerAndTppDoc(bill, cn));
  const matchingPayment = !bill._id.tpp
    ? payments.find(pay => isCustomerDoc(bill, pay))
    : payments.find(pay => isCustomerAndTppDoc(bill, pay));

  const paid = matchingPayment && matchingPayment.payments
    ? exports.computePayments(matchingPayment.payments)
    : 0;
  const billedString = NumbersHelper.subtract(bill.billed, (matchingCreditNote ? matchingCreditNote.refund : 0));
  const balance = NumbersHelper.toFixedToFloat(NumbersHelper.subtract(paid, billedString));

  const lastCesu = matchingPayment && matchingPayment.payments.filter(p => p.type === CESU)
    .sort(DatesHelper.descendingSort('date'))[0];

  return {
    ...bill,
    participationRate: exports.formatParticipationRate(bill, tppList),
    billed: NumbersHelper.toFixedToFloat(billedString),
    paid,
    balance,
    toPay: exports.canBeDirectDebited(bill) && balance < 0 ? Math.abs(balance) : 0,
    lastCesuDate: get(lastCesu, 'date') || null,
  };
};

exports.getBalancesFromCreditNotes = (creditNote, payments, tppList) => {
  const matchingPayment = !creditNote._id.tpp
    ? payments.find(pay => isCustomerDoc(creditNote, pay))
    : payments.find(pay => isCustomerAndTppDoc(creditNote, pay));

  const paid = matchingPayment && matchingPayment.payments ? exports.computePayments(matchingPayment.payments) : 0;
  const billedString = NumbersHelper.subtract(0, creditNote.refund);

  return {
    customer: creditNote.customer,
    participationRate: exports.formatParticipationRate(creditNote, tppList),
    billed: NumbersHelper.toFixedToFloat(billedString),
    paid,
    toPay: 0,
    balance: NumbersHelper.toFixedToFloat(NumbersHelper.subtract(paid, billedString)),
    ...(creditNote.thirdPartyPayer && { thirdPartyPayer: { ...creditNote.thirdPartyPayer } }),
  };
};

exports.getBalancesFromPayments = (payment, tppList) => {
  const paid = payment.payments ? exports.computePayments(payment.payments) : 0;

  return {
    customer: payment.customer,
    billed: 0,
    paid,
    toPay: 0,
    participationRate: exports.formatParticipationRate(payment, tppList),
    balance: paid,
    ...(payment.thirdPartyPayer && { thirdPartyPayer: { ...payment.thirdPartyPayer } }),
  };
};

const isAlreadyProcessed = (clients, doc) => clients.some((cl) => {
  const isCustomerDocument = UtilsHelper.areObjectIdsEquals(cl.customer, doc._id.customer);
  const noTpp = !cl.tpp && !doc._id.tpp;
  const isTppDoc = cl.tpp && doc._id.tpp && UtilsHelper.areObjectIdsEquals(cl.tpp, doc._id.tpp);

  return isCustomerDocument && (noTpp || isTppDoc);
});

exports.getBalances = async (credentials, customerId = null, maxDate = null) => {
  const companyId = get(credentials, 'company._id');
  let customersIds = [];

  if (customerId) customersIds.push(new ObjectId(`${customerId}`));
  else {
    const notArchivedCustomers = await Customer
      .find({ company: credentials.company._id, archivedAt: { $eq: null } }, { _id: 1 })
      .lean();
    customersIds = notArchivedCustomers.map(cus => cus._id);
  }

  const bills = await BillRepository.findAmountsGroupedByClient(companyId, customersIds, maxDate);
  const customerCNAggregation = await CreditNoteRepository
    .findAmountsGroupedByCustomer(companyId, customersIds, maxDate);
  const tppCNAggregation = await CreditNoteRepository.findAmountsGroupedByTpp(companyId, customersIds, maxDate);
  const payments = await PaymentRepository.findAmountsGroupedByClient(companyId, customersIds, maxDate);
  const tppList = await ThirdPartyPayer.find({ company: companyId }).lean();

  const balances = bills.map(b => exports.getBalance(b, customerCNAggregation, tppCNAggregation, payments, tppList));
  const clients = bills.map(b => ({ ...b._id }));

  const remainingCreditNotes = [...customerCNAggregation, ...tppCNAggregation]
    .filter(cn => !isAlreadyProcessed(clients, cn));
  for (const cn of remainingCreditNotes) {
    clients.push({ ...cn._id });
    balances.push(exports.getBalancesFromCreditNotes(cn, payments, tppList));
  }

  const remainingPayments = payments.filter(payment => !isAlreadyProcessed(clients, payment));
  for (const payment of remainingPayments) {
    balances.push(exports.getBalancesFromPayments(payment, tppList));
  }

  return balances;
};
