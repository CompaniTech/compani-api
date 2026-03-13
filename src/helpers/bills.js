const moment = require('moment');
const get = require('lodash/get');
const pick = require('lodash/pick');
const Bill = require('../models/Bill');
const Company = require('../models/Company');
const UtilsHelper = require('./utils');
const DatesHelper = require('./dates');
const NumbersHelper = require('./numbers');
const PdfHelper = require('./pdf');
const BillPdf = require('../data/pdf/billing/bill');
const {
  HOURLY,
  CIVILITY_LIST,
  COMPANI,
  ROUNDING_ERROR,
} = require('./constants');
const { CompaniDate } = require('./dates/companiDates');

exports.filterFundingVersion = date => ver => DatesHelper.isSameOrBefore(ver.createdAt, date);

const getMatchingFunding = (bill, event) => bill.customer.fundings
  .map(fund => UtilsHelper.getMatchingVersion(bill.createdAt, fund, 'createdAt', exports.filterFundingVersion))
  .find(fund => UtilsHelper.areObjectIdsEquals(fund.thirdPartyPayer, bill.thirdPartyPayer._id) &&
      CompaniDate(fund.startDate).isSameOrBefore(event.startDate) &&
      (!fund.endDate || CompaniDate(fund.endDate).isSameOrAfter(event.startDate)));

exports.getUnitInclTaxes = (bill, subscription) => {
  if (!bill.thirdPartyPayer) return NumbersHelper.toString(subscription.unitInclTaxes);

  const lastEvent = UtilsHelper.getLastVersion(subscription.events, 'startDate');
  const matchingFundingVersion = getMatchingFunding(bill, lastEvent);
  if (!matchingFundingVersion) return NumbersHelper.toString(0);

  if (matchingFundingVersion.nature === HOURLY) {
    const customerParticipationRate = NumbersHelper.divide(matchingFundingVersion.customerParticipationRate, 100);
    const tppParticipationRate = NumbersHelper.subtract(1, customerParticipationRate);

    return NumbersHelper.multiply(matchingFundingVersion.unitTTCRate, tppParticipationRate);
  }

  return NumbersHelper.toString(subscription.unitInclTaxes);
};

exports.computeSurcharge = (subscription) => {
  let totalSurcharge = NumbersHelper.toString(0);
  for (const event of subscription.events) {
    if (!event.surcharges || event.surcharges.length === 0) continue;

    for (const surcharge of event.surcharges) {
      const duration = surcharge.startHour
        ? NumbersHelper.divide(moment(surcharge.endHour).diff(surcharge.startHour, 'm', true), 60)
        : NumbersHelper.divide(moment(event.endDate).diff(event.startDate, 'm', true), 60);

      const surchargePrice = NumbersHelper.multiply(
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
  let totalExclTaxes = NumbersHelper.toString(0);
  let totalDiscount = NumbersHelper.toString(0);
  let totalSurcharge = NumbersHelper.toString(0);
  let totalSubscription = NumbersHelper.toString(0);

  const formattedDetails = [];
  for (const sub of bill.subscriptions) {
    const subExclTaxesWithDiscount = UtilsHelper.computeExclTaxesWithDiscount(sub.inclTaxes, sub.discount, sub.vat);
    totalExclTaxes = NumbersHelper.add(totalExclTaxes, subExclTaxesWithDiscount);

    const volume = sub.service.nature === HOURLY ? sub.hours : sub.events.length;
    const unitInclTaxes = exports.getUnitInclTaxes(bill, sub);

    const customerFundings = get(bill, 'customer.fundings') || [];
    const matchingFunding = customerFundings
      .find(funding => UtilsHelper.areObjectIdsEquals(funding.subscription, sub.subscription));

    let total;
    if (bill.thirdPartyPayer && matchingFunding && matchingFunding.nature === HOURLY) {
      total = NumbersHelper.toString(sub.inclTaxes);
    } else {
      total = NumbersHelper.multiply(volume, unitInclTaxes);
    }

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

  if (!NumbersHelper.isEqualTo(totalSurcharge, '0')) {
    formattedDetails.push({ name: 'Majorations', total: totalSurcharge });
  }

  let totalBillingItem = 0;
  if (bill.billingItemList) {
    for (const bi of bill.billingItemList) {
      const biExclTaxesWithDiscount = UtilsHelper.computeExclTaxesWithDiscount(bi.inclTaxes, bi.discount, bi.vat);
      totalExclTaxes = NumbersHelper.add(totalExclTaxes, biExclTaxesWithDiscount);
      totalBillingItem = NumbersHelper.add(totalBillingItem, bi.inclTaxes);
      totalDiscount = NumbersHelper.add(totalDiscount, bi.discount);

      formattedDetails.push({
        ...pick(bi, ['name', 'vat']),
        unitInclTaxes: NumbersHelper.toString(bi.unitInclTaxes),
        volume: UtilsHelper.roundFrenchNumber(bi.count),
        total: NumbersHelper.toString(bi.inclTaxes),
      });
    }
  }

  if (!NumbersHelper.isEqualTo(totalDiscount, '0')) formattedDetails.push({ name: 'Remises', total: -totalDiscount });

  const totalCustomer = NumbersHelper.add(totalSubscription, totalBillingItem, totalSurcharge);
  const totalTPP = NumbersHelper.add(NumbersHelper.subtract(bill.netInclTaxes, totalCustomer), totalDiscount);
  if (NumbersHelper.isLessThan(totalTPP, -ROUNDING_ERROR) && !bill.thirdPartyPayer) {
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

  const sortedEvents = [...events].sort(DatesHelper.ascendingSort('startDate'));
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

  const company = await Company
    .findOne(
      { _id: get(credentials, 'company._id') },
      { rcs: 1, rna: 1, address: 1, logo: 1, name: 1, 'customersConfig.billFooter': 1 }
    )
    .lean();
  const data = exports.formatPdf(bill, company);
  const pdf = await BillPdf.getPdf(data);

  return { pdf, billNumber: bill.number };
};
