const moment = require('moment');
const get = require('lodash/get');
const { INTERNAL_HOUR, INTERVENTION, COMPANY_CONTRACT } = require('./constants');
const Company = require('../models/Company');
const Surcharge = require('../models/Surcharge');
const DistanceMatrix = require('../models/DistanceMatrix');
const Pay = require('../models/Pay');
const DraftPayHelper = require('./draftPay');

exports.getDraftStcByAuxiliary = async (events, absences, company, query, distanceMatrix, surcharges, prevPay) => {
  const { auxiliary } = events[0] && events[0][0] ? events[0][0] : absences[0];
  const { _id, identity, sector, contracts } = auxiliary;

  const hours = await DraftPayHelper.getPayFromEvents(events, distanceMatrix, surcharges);
  const absencesHours = DraftPayHelper.getPayFromAbsences(absences, contracts[0]);
  const contractInfo = DraftPayHelper.getContractMonthInfo(contracts[0], query);
  const hoursBalance = (hours.workedHours - contractInfo.contractHours) + absencesHours;

  return {
    auxiliaryId: auxiliary._id,
    auxiliary: { _id, identity, sector },
    startDate: query.startDate,
    endDate: contracts[0].endDate,
    endReason: contracts[0].endReason,
    endNotificationDate: contracts[0].endNotificationDate,
    month: moment(query.startDate).format('MMMM'),
    contractHours: contractInfo.contractHours,
    ...hours,
    hoursBalance,
    hoursCounter: prevPay ? prevPay.hoursBalance + hoursBalance : hoursBalance,
    overtimeHours: 0,
    additionalHours: 0,
    mutual: !get(auxiliary, 'administrative.mutualFund.has'),
    transport: DraftPayHelper.getTransportRefund(auxiliary, company, contractInfo.workedDaysRatio, hours.paidKm),
    otherFees: get(company, 'rhConfig.phoneSubRefunding', 0),
    bonus: 0,
    compensation: 0,
  };
};

exports.getDraftStc = async (auxiliaries, query) => {
  const rules = {
    type: { $in: [INTERNAL_HOUR, INTERVENTION] },
    startDate: { $gte: moment(query.startDate).startOf('d').toDate() },
    endDate: { $lte: moment(query.endDate).endOf('d').toDate() },
    auxiliary: { $in: auxiliaries },
    status: COMPANY_CONTRACT,
  };
  const eventsByAuxiliary = await DraftPayHelper.getEventToPay(rules);
  const absencesByAuxiliary = await DraftPayHelper.getPaidAbsences(auxiliaries);
  const company = await Company.findOne({}).lean();
  const surcharges = await Surcharge.find({});
  const distanceMatrix = await DistanceMatrix.find();
  const prevPayList = await Pay.find({ month: moment(query.startDate).subtract(1, 'M').format('MMMM') });

  const draftStc = [];
  for (const aux of auxiliaries) {
    const auxAbsences = absencesByAuxiliary.find(group => group._id.toHexString() === aux.toHexString());
    const auxEvents = eventsByAuxiliary.find(group => group._id.toHexString() === aux.toHexString());
    const prevPay = prevPayList.find(prev => prev.auxiliary.toHexString() === aux.toHexString());
    if (auxEvents || auxAbsences) {
      draftStc.push(await exports.getDraftStcByAuxiliary(
        auxEvents ? auxEvents.events : [],
        auxAbsences ? auxAbsences.events : [],
        company,
        query,
        distanceMatrix,
        surcharges,
        prevPay,
      ));
    }
  }

  return draftStc;
};
