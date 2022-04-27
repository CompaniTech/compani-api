const moment = require('moment');
const get = require('lodash/get');
const pick = require('lodash/pick');
const Event = require('../models/Event');
const Bill = require('../models/Bill');
const BillingItem = require('../models/BillingItem');
const Company = require('../models/Company');
const BillNumber = require('../models/BillNumber');
const CreditNote = require('../models/CreditNote');
const FundingHistory = require('../models/FundingHistory');
const BillSlipHelper = require('./billSlips');
const UtilsHelper = require('./utils');
const NumbersHelper = require('./numbers');
const PdfHelper = require('./pdf');
const BillPdf = require('../data/pdf/billing/bill');
const { HOURLY, THIRD_PARTY, CIVILITY_LIST, COMPANI, AUTOMATIC, MANUAL, ROUNDING_ERROR } = require('./constants');
const { CompaniDate } = require('./dates/companiDates');

exports.formatBillNumber = (companyPrefixNumber, prefix, seq) =>
  `FACT-${companyPrefixNumber}${prefix}${seq.toString().padStart(5, '0')}`;

exports.formatBilledEvents = (bill) => {
  const pickedFields = ['auxiliary', 'startDate', 'endDate', 'surcharges'];
  if (bill.thirdPartyPayer) pickedFields.push('inclTaxesTpp', 'exclTaxesTpp', 'fundingId');
  else pickedFields.push('inclTaxesCustomer', 'exclTaxesCustomer');

  return bill.eventsList.map(ev => (ev.history && ev.history.careHours
    ? { eventId: ev.event, ...pick(ev, pickedFields), careHours: ev.history.careHours }
    : { eventId: ev.event, ...pick(ev, pickedFields) }
  ));
};

exports.formatSubscriptionData = (bill) => {
  const matchingServiceVersion = UtilsHelper.getMatchingVersion(bill.endDate, bill.subscription.service, 'startDate');

  return {
    ...pick(bill, ['startDate', 'endDate', 'hours', 'unitInclTaxes', 'exclTaxes', 'inclTaxes', 'discount']),
    subscription: bill.subscription._id,
    service: { serviceId: matchingServiceVersion._id, ...pick(matchingServiceVersion, ['name', 'nature']) },
    vat: matchingServiceVersion.vat,
    events: exports.formatBilledEvents(bill),
  };
};

exports.formatBillingItemData = bill => ({
  ...pick(bill, ['startDate', 'endDate', 'unitInclTaxes', 'exclTaxes', 'inclTaxes', 'vat', 'discount']),
  billingItem: bill.billingItem._id,
  events: bill.eventsList.map(ev => ({ ...pick(ev, ['startDate', 'endDate', 'auxiliary']), eventId: ev.event })),
  name: bill.billingItem.name,
  count: bill.eventsList.length,
});

exports.formatCustomerBills = (customerBills, customer, number, company) => {
  const billedEvents = {};
  const bill = {
    customer: customer._id,
    subscriptions: [],
    number: exports.formatBillNumber(company.prefixNumber, number.prefix, number.seq),
    netInclTaxes: UtilsHelper.getFixedNumber(customerBills.total, 2),
    date: customerBills.bills[0].endDate,
    shouldBeSent: customerBills.shouldBeSent,
    type: AUTOMATIC,
    company: company._id,
    billingItemList: [],
  };

  for (const draftBill of customerBills.bills) {
    if (draftBill.subscription) {
      bill.subscriptions.push(exports.formatSubscriptionData(draftBill));
      for (const ev of draftBill.eventsList) {
        billedEvents[ev.event] = { ...ev };
      }
    } else {
      bill.billingItemList.push(exports.formatBillingItemData(draftBill));
      for (const ev of draftBill.eventsList) {
        if (!billedEvents[ev.event]) {
          billedEvents[ev.event] = { event: ev.event, exclTaxesCustomer: 0, inclTaxesCustomer: 0 };
        }
        if (!billedEvents[ev.event].billingItems) billedEvents[ev.event].billingItems = [];
        if (!billedEvents[ev.event].exclTaxesCustomer) billedEvents[ev.event].exclTaxesCustomer = 0;
        if (!billedEvents[ev.event].inclTaxesCustomer) billedEvents[ev.event].inclTaxesCustomer = 0;

        billedEvents[ev.event].billingItems.push({
          billingItem: draftBill.billingItem._id,
          inclTaxes: draftBill.unitInclTaxes,
          exclTaxes: draftBill.unitExclTaxes,
        });
        billedEvents[ev.event].exclTaxesCustomer = NumbersHelper.add(
          billedEvents[ev.event].exclTaxesCustomer,
          draftBill.unitExclTaxes
        );
        billedEvents[ev.event].inclTaxesCustomer = NumbersHelper.add(
          billedEvents[ev.event].inclTaxesCustomer,
          draftBill.unitInclTaxes
        );
      }
    }
  }

  return { bill, billedEvents };
};

exports.formatThirdPartyPayerBills = (thirdPartyPayerBills, customer, number, company) => {
  let { seq } = number;
  const tppBills = [];
  const billedEvents = {};
  const histories = {};
  for (const tpp of thirdPartyPayerBills) {
    const tppBill = {
      customer: customer._id,
      thirdPartyPayer: get(tpp.bills[0], 'thirdPartyPayer._id', null),
      subscriptions: [],
      netInclTaxes: UtilsHelper.getFixedNumber(tpp.total, 2),
      date: tpp.bills[0].endDate,
      type: AUTOMATIC,
      company: company._id,
    };
    if (!tpp.bills[0].externalBilling) {
      tppBill.number = exports.formatBillNumber(company.prefixNumber, number.prefix, seq);
      seq += 1;
    } else tppBill.origin = THIRD_PARTY;

    for (const draftBill of tpp.bills) {
      tppBill.subscriptions.push(exports.formatSubscriptionData(draftBill));
      for (const ev of draftBill.eventsList) {
        if (ev.history.nature === HOURLY) billedEvents[ev.event] = { ...ev, careHours: ev.history.careHours };
        else billedEvents[ev.event] = { ...ev };

        if (ev.history.month) {
          if (!histories[ev.history.fundingId]) histories[ev.history.fundingId] = { [ev.history.month]: ev.history };
          else if (!histories[ev.history.fundingId][ev.history.month]) {
            histories[ev.history.fundingId][ev.history.month] = ev.history;
          } else {
            histories[ev.history.fundingId][ev.history.month].careHours = NumbersHelper.add(
              histories[ev.history.fundingId][ev.history.month].careHours,
              ev.history.careHours
            );
          }
        } else if (!histories[ev.history.fundingId]) histories[ev.history.fundingId] = { ...ev.history };
        else if (ev.history.nature === HOURLY) {
          histories[ev.history.fundingId].careHours = NumbersHelper.add(
            histories[ev.history.fundingId].careHours,
            ev.history.careHours
          );
        } else { // Funding with once frequency are only fixed !
          histories[ev.history.fundingId].amountTTC = NumbersHelper.add(
            histories[ev.history.fundingId].amountTTC,
            ev.history.amountTTC
          );
        }
      }
    }
    tppBills.push(tppBill);
  }

  return { tppBills, billedEvents, fundingHistories: histories };
};

exports.updateEvents = async (eventsToUpdate) => {
  const promises = [];
  for (const id of Object.keys(eventsToUpdate)) {
    promises.push(Event.updateOne({ _id: id }, { $set: { isBilled: true, bills: eventsToUpdate[id] } }));
  }
  await Promise.all(promises);
};

exports.updateFundingHistories = async (histories, companyId) => {
  const promises = [];
  for (const id of Object.keys(histories)) {
    if (histories[id].amountTTC) {
      promises.push(FundingHistory.updateOne(
        { fundingId: id, company: companyId },
        { $inc: { amountTTC: histories[id].amountTTC } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ));
    } else if (histories[id].careHours) {
      promises.push(FundingHistory.updateOne(
        { fundingId: id, company: companyId },
        { $inc: { careHours: histories[id].careHours } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ));
    } else {
      for (const month of Object.keys(histories[id])) {
        promises.push(FundingHistory.updateOne(
          { fundingId: id, month, company: companyId },
          { $inc: { careHours: histories[id][month].careHours } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        ));
      }
    }
  }
  await Promise.all(promises);
};

exports.getBillNumber = async (endDate, companyId) => {
  const prefix = moment(endDate).format('MMYY');

  return BillNumber
    .findOneAndUpdate({ prefix, company: companyId }, {}, { new: true, upsert: true, setDefaultsOnInsert: true })
    .lean();
};

exports.formatAndCreateList = async (groupByCustomerBills, credentials) => {
  const billList = [];
  let eventsToUpdate = {};
  let fundingHistories = {};
  const { company } = credentials;
  const { endDate } = groupByCustomerBills[0];
  const number = await exports.getBillNumber(endDate, company._id);

  for (const draftBills of groupByCustomerBills) {
    const { customer, customerBills, thirdPartyPayerBills } = draftBills;
    if (customerBills.bills && customerBills.bills.length > 0) {
      const customerBillingInfo = exports.formatCustomerBills(customerBills, customer, number, company);
      eventsToUpdate = { ...eventsToUpdate, ...customerBillingInfo.billedEvents };
      number.seq += 1;
      billList.push(customerBillingInfo.bill);
    }

    if (thirdPartyPayerBills && thirdPartyPayerBills.length > 0) {
      const tppBillingInfo = exports.formatThirdPartyPayerBills(thirdPartyPayerBills, customer, number, company);
      fundingHistories = { ...fundingHistories, ...tppBillingInfo.fundingHistories };
      for (const eventId of Object.keys(tppBillingInfo.billedEvents)) {
        if (!eventsToUpdate[eventId]) eventsToUpdate[eventId] = tppBillingInfo.billedEvents[eventId];
        else eventsToUpdate[eventId] = { ...tppBillingInfo.billedEvents[eventId], ...eventsToUpdate[eventId] };
      }
      for (const bill of tppBillingInfo.tppBills) {
        billList.push(bill);
        if (bill.number) number.seq += 1;
      }
    }
  }

  // Order is important
  await Bill.insertMany(billList);
  await exports.updateEvents(eventsToUpdate);
  await exports.updateFundingHistories(fundingHistories, company._id);
  await BillNumber.updateOne({ prefix: number.prefix, company: company._id }, { $set: { seq: number.seq } });
  await BillSlipHelper.createBillSlips(billList, endDate, credentials.company);
  await CreditNote.updateMany(
    { events: { $elemMatch: { eventId: { $in: Object.keys(eventsToUpdate) } } } },
    { isEditable: false }
  );
};

exports.list = async (query, credentials) => Bill
  .find({ ...query, company: credentials.company._id })
  .populate({ path: 'customer', select: 'identity' })
  .populate({ path: 'billingItemList', populate: { path: 'billingItem', select: 'name' } })
  .lean();

exports.formatBillingItem = (bi, bddBillingItemList) => {
  const bddBillingItem = bddBillingItemList.find(bddBI => UtilsHelper.areObjectIdsEquals(bddBI._id, bi.billingItem));
  const vatMultiplier = NumbersHelper.divide(bddBillingItem.vat, 100);
  const unitExclTaxes = NumbersHelper.divide(bi.unitInclTaxes, vatMultiplier + 1);
  const exclTaxes = NumbersHelper.oldMultiply(unitExclTaxes, bi.count);

  return {
    billingItem: bi.billingItem,
    name: bddBillingItem.name,
    unitInclTaxes: bi.unitInclTaxes,
    count: bi.count,
    inclTaxes: NumbersHelper.oldMultiply(bi.unitInclTaxes, bi.count),
    exclTaxes,
    vat: bddBillingItem.vat,
  };
};

exports.formatAndCreateBill = async (payload, credentials) => {
  const { date, billingItemList } = payload;
  const { company } = credentials;

  const billNumber = await exports.getBillNumber(date, company._id);

  const bddBillingItemList = await BillingItem
    .find({ _id: { $in: billingItemList.map(bi => bi.billingItem) } }, { vat: 1, name: 1 })
    .lean();

  let netInclTaxes = 0;
  for (const bi of billingItemList) {
    netInclTaxes = NumbersHelper.add(netInclTaxes, NumbersHelper.oldMultiply(bi.count, bi.unitInclTaxes));
  }

  const bill = {
    ...pick(payload, ['date', 'customer']),
    netInclTaxes,
    type: MANUAL,
    number: exports.formatBillNumber(company.prefixNumber, billNumber.prefix, billNumber.seq),
    billingItemList: billingItemList.map(bi => exports.formatBillingItem(bi, bddBillingItemList)),
    company: company._id,
  };

  await BillNumber.updateOne(
    { prefix: billNumber.prefix, company: company._id },
    { $set: { seq: billNumber.seq + 1 } }
  );
  await Bill.create(bill);
};

exports.getBills = async (query, credentials) => {
  const { startDate, endDate, ...billsQuery } = query;
  if (startDate || endDate) billsQuery.date = UtilsHelper.getDateQuery({ startDate, endDate });
  billsQuery.company = get(credentials, 'company._id', null);

  return Bill.find(billsQuery).populate({ path: 'thirdPartyPayer', select: '_id name' }).lean();
};

const getFunding = (fundings, thirdPartyPayer, event) => fundings
  .map(fund => UtilsHelper.mergeLastVersionWithBaseObject(fund, 'createdAt'))
  .find(fund => UtilsHelper.areObjectIdsEquals(fund.thirdPartyPayer, thirdPartyPayer._id) &&
    CompaniDate(fund.startDate).isSameOrBefore(event.startDate) &&
    (!fund.endDate || CompaniDate(fund.endDate).isSameOrAfter(event.startDate)));

exports.getUnitInclTaxes = (bill, subscription) => {
  if (!bill.thirdPartyPayer) return subscription.unitInclTaxes;

  const lastEvent = UtilsHelper.getLastVersion(subscription.events, 'startDate');
  const matchingVersion = getFunding(bill.customer.fundings, bill.thirdPartyPayer, lastEvent);
  if (!matchingVersion) return 0;

  if (matchingVersion.nature === HOURLY) {
    const customerParticipationRate = NumbersHelper.divide(matchingVersion.customerParticipationRate, 100);
    const tppParticipationRate = NumbersHelper.subtract(1, customerParticipationRate);

    return NumbersHelper.oldMultiply(matchingVersion.unitTTCRate, tppParticipationRate);
  }

  return subscription.unitInclTaxes;
};

exports.computeSurcharge = (subscription) => {
  let totalSurcharge = 0;
  for (const event of subscription.events) {
    if (!event.surcharges || event.surcharges.length === 0) continue;

    for (const surcharge of event.surcharges) {
      const duration = surcharge.startHour
        ? moment(surcharge.endHour).diff(surcharge.startHour, 'm') / 60
        : moment(event.endDate).diff(event.startDate, 'm') / 60;

      const surchargePrice = NumbersHelper.oldMultiply(
        duration,
        subscription.unitInclTaxes,
        NumbersHelper.divide(surcharge.percentage, 100)
      );

      totalSurcharge = NumbersHelper.add(totalSurcharge, surchargePrice);
    }
  }

  return totalSurcharge;
};

exports.formatBillDetailsForPdf = (bill) => {
  let totalExclTaxes = 0;
  let totalDiscount = 0;
  let totalSurcharge = 0;
  let totalSubscription = 0;
  const formattedDetails = [];

  for (const sub of bill.subscriptions) {
    const subExclTaxesWithDiscount = UtilsHelper.computeExclTaxesWithDiscount(sub.exclTaxes, sub.discount, sub.vat);
    totalExclTaxes = NumbersHelper.add(totalExclTaxes, subExclTaxesWithDiscount);

    const volume = sub.service.nature === HOURLY ? sub.hours : sub.events.length;
    const unitInclTaxes = exports.getUnitInclTaxes(bill, sub);
    const total = NumbersHelper.oldMultiply(volume, unitInclTaxes);

    formattedDetails.push({
      unitInclTaxes,
      vat: sub.vat || 0,
      name: sub.service.name,
      volume: sub.service.nature === HOURLY ? UtilsHelper.formatHour(volume) : volume,
      total,
    });
    totalSubscription = NumbersHelper.add(totalSubscription, total);
    totalSurcharge = NumbersHelper.add(totalSurcharge, exports.computeSurcharge(sub));
    totalDiscount = NumbersHelper.add(totalDiscount, sub.discount);
  }

  if (totalSurcharge) formattedDetails.push({ name: 'Majorations', total: totalSurcharge });

  let totalBillingItem = 0;
  if (bill.billingItemList) {
    for (const bi of bill.billingItemList) {
      const biExclTaxesWithDiscount = UtilsHelper.computeExclTaxesWithDiscount(bi.exclTaxes, bi.discount, bi.vat);
      totalExclTaxes = NumbersHelper.add(totalExclTaxes, biExclTaxesWithDiscount);
      totalBillingItem = NumbersHelper.add(totalBillingItem, bi.inclTaxes);
      totalDiscount = NumbersHelper.add(totalDiscount, bi.discount);

      formattedDetails.push({ ...pick(bi, ['name', 'unitInclTaxes', 'vat']), volume: bi.count, total: bi.inclTaxes });
    }
  }

  if (totalDiscount) formattedDetails.push({ name: 'Remises', total: -totalDiscount });

  const totalCustomer = NumbersHelper.add(totalSubscription, totalBillingItem, totalSurcharge);
  const totalTPP = NumbersHelper.add(NumbersHelper.subtract(bill.netInclTaxes, totalCustomer), totalDiscount);
  if (totalTPP < -ROUNDING_ERROR) {
    formattedDetails.push({ name: 'Prise en charge du/des tiers(s) payeur(s)', total: totalTPP });
  }

  return {
    totalExclTaxes: UtilsHelper.formatPrice(totalExclTaxes),
    totalVAT: UtilsHelper.formatPrice(NumbersHelper.subtract(bill.netInclTaxes, totalExclTaxes)),
    formattedDetails,
  };
};

exports.formatEventsForPdf = (events, service) => {
  const formattedEvents = [];

  const sortedEvents = events.map(ev => ev).sort((ev1, ev2) => ev1.startDate - ev2.startDate);
  for (const ev of sortedEvents) {
    const formattedEvent = {
      identity: `${ev.auxiliary.identity.firstname.substring(0, 1)}. ${ev.auxiliary.identity.lastname}`,
      date: moment(ev.startDate).format('DD/MM'),
      startTime: moment(ev.startDate).format('HH:mm'),
      endTime: moment(ev.endDate).format('HH:mm'),
      service: service.name,
    };
    if (ev.surcharges) {
      formattedEvent.surcharges = PdfHelper.formatEventSurchargesForPdf(ev.surcharges);
    }
    formattedEvents.push(formattedEvent);
  }

  return formattedEvents;
};

exports.formatPdf = (bill, company) => {
  const computedData = {
    netInclTaxes: UtilsHelper.formatPrice(bill.netInclTaxes),
    date: moment(bill.date).format('DD/MM/YYYY'),
    formattedEvents: [],
    recipient: {
      address: bill.thirdPartyPayer
        ? get(bill, 'thirdPartyPayer.address', {})
        : get(bill, 'customer.contact.primaryAddress', {}),
      name: bill.thirdPartyPayer
        ? bill.thirdPartyPayer.name
        : UtilsHelper.formatIdentity(bill.customer.identity, 'TFL'),
    },
    forTpp: !!bill.thirdPartyPayer,
    ...exports.formatBillDetailsForPdf(bill),
  };

  for (const sub of bill.subscriptions) {
    const formattedEvents = exports.formatEventsForPdf(sub.events, sub.service);
    computedData.formattedEvents.push(...formattedEvents);
  }

  return {
    bill: {
      type: bill.type,
      number: bill.number,
      customer: {
        identity: { ...get(bill, 'customer.identity'), title: CIVILITY_LIST[get(bill, 'customer.identity.title')] },
        contact: get(bill, 'customer.contact'),
      },
      ...computedData,
      company: pick(company, ['rcs', 'rna', 'address', 'logo', 'name', 'customersConfig.billFooter']),
    },
  };
};

exports.generateBillPdf = async (params, credentials) => {
  const bill = await Bill.findOne({ _id: params._id, origin: COMPANI })
    .populate({ path: 'thirdPartyPayer', select: '_id name address' })
    .populate({ path: 'customer', select: '_id identity contact fundings' })
    .populate({ path: 'subscriptions.events.auxiliary', select: 'identity' })
    .lean();

  const company = await Company.findOne({ _id: get(credentials, 'company._id', null) }).lean();
  const data = exports.formatPdf(bill, company);
  const template = await BillPdf.getPdfContent(data);
  const pdf = await PdfHelper.generatePdf(template);

  return { pdf, billNumber: bill.number };
};
