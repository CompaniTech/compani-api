const cloneDeep = require('lodash/cloneDeep');
const get = require('lodash/get');
const Boom = require('@hapi/boom');
const moment = require('moment');
const Pay = require('../models/Pay');
const FinalPay = require('../models/FinalPay');
const User = require('../models/User');
const DraftPayHelper = require('./draftPay');
const DraftFinalPayHelper = require('./draftFinalPay');
const ContractHelper = require('./contracts');
const UtilsHelper = require('./utils');
const SectorHistoryRepository = require('../repositories/SectorHistoryRepository');
const SectorHistory = require('./sectorHistories');

exports.formatSurchargeDetail = (detail) => {
  const surchargeDetail = [];
  for (const key of Object.keys(detail)) {
    surchargeDetail.push({ ...detail[key], planId: key });
  }

  return surchargeDetail;
};

exports.formatPay = (draftPay, companyId) => {
  const payload = { ...cloneDeep(draftPay), company: companyId };
  const keys = ['surchargedAndNotExemptDetails', 'surchargedAndExemptDetails'];
  for (const key of keys) {
    if (draftPay[key]) {
      payload[key] = exports.formatSurchargeDetail(draftPay[key]);
    }
    if (draftPay.diff && draftPay.diff[key]) {
      payload.diff[key] = exports.formatSurchargeDetail(draftPay.diff[key]);
    }
  }

  return payload;
};

exports.createPayList = async (payToCreate, credentials) => {
  const list = [];
  const companyId = get(credentials, 'company._id', null);
  for (const pay of payToCreate) {
    list.push(new Pay(exports.formatPay(pay, companyId)));
  }

  await Pay.insertMany(list);
};

exports.getContract = (contracts, startDate, endDate) => contracts.find((cont) => {
  const contractStarted = moment(cont.startDate).isSameOrBefore(endDate);
  if (!contractStarted) return false;

  return !cont.endDate || moment(cont.endDate).isSameOrAfter(startDate);
});

exports.hoursBalanceDetail = async (query, credentials) => {
  const startDate = moment(query.month, 'MM-YYYY').startOf('M').toDate();
  const endDate = moment(query.month, 'MM-YYYY').endOf('M').toDate();

  if (query.sector) return exports.hoursBalanceDetailBySector(query.sector, startDate, endDate, credentials);

  return exports.hoursBalanceDetailByAuxiliary(query.auxiliary, startDate, endDate, credentials);
};

exports.hoursBalanceDetailByAuxiliary = async (auxiliaryId, startDate, endDate, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const sectorsId = await SectorHistory.getAuxiliarySectors(auxiliaryId, companyId, startDate, endDate);
  const month = moment(startDate).format('MM-YYYY');
  const pay = await Pay.findOne({ auxiliary: auxiliaryId, month }).lean();
  if (pay) return { ...pay, sectors: sectorsId, counterAndDiffRelevant: true };

  const finalPay = await FinalPay.findOne({ auxiliary: auxiliaryId, month }).lean();
  if (finalPay) return { ...finalPay, sectors: sectorsId, counterAndDiffRelevant: true };

  const auxiliary = await User.findOne({ _id: auxiliaryId }).populate('contracts').lean();
  const contract = exports.getContract(auxiliary.contracts, startDate, endDate);
  if (!contract) throw Boom.badRequest();

  const prevMonth = moment(month, 'MM-YYYY').subtract(1, 'M').format('MM-YYYY');
  const prevPay = await Pay.findOne({ month: prevMonth, auxiliary: auxiliaryId }).lean();

  const payQuery = { startDate, endDate };
  const [draft] = !contract.endDate || new Date(contract.endDate) > new Date(endDate)
    ? await DraftPayHelper.computeDraftPay([{ ...auxiliary, prevPay }], payQuery, credentials)
    : await DraftFinalPayHelper.computeDraftFinalPay([{ ...auxiliary, prevPay }], payQuery, credentials);

  const firstMonthContract = moment(startDate).startOf('M').isSameOrBefore(contract.startDate);

  return draft ? { ...draft, sectors: sectorsId, counterAndDiffRelevant: !!prevPay || firstMonthContract } : null;
};

exports.hoursBalanceDetailBySector = async (sector, startDate, endDate, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const sectors = UtilsHelper.formatObjectIdsArray(sector);

  const auxiliariesIds =
    await SectorHistoryRepository.getUsersFromSectorHistories(startDate, endDate, sectors, companyId);
  const result = [];
  const auxiliaries = await User.find(
    { _id: { $in: auxiliariesIds.map(aux => aux.auxiliaryId) } },
    { identity: 1, picture: 1 }
  )
    .populate('contracts')
    .lean();
  for (const auxiliary of auxiliaries) {
    if (!auxiliary.contracts) continue;

    const contract = exports.getContract(auxiliary.contracts, startDate, endDate);
    if (!contract) continue;

    const hbd = await exports.hoursBalanceDetailByAuxiliary(auxiliary._id, startDate, endDate, credentials);
    if (hbd) {
      result.push({ ...hbd, auxiliaryId: auxiliary._id, identity: auxiliary.identity, picture: auxiliary.picture });
    }
  }

  return result;
};

const updateVersionsWithSectorDates = (version, sector) => {
  const returnedVersion = {
    ...version,
    startDate: moment.max(moment(sector.startDate), moment(version.startDate)).startOf('d').toDate(),
  };

  if (version.endDate && sector.endDate) {
    returnedVersion.endDate = moment.min(moment(sector.endDate), moment(version.endDate)).endOf('d').toDate();
  } else if (sector.endDate) returnedVersion.endDate = moment(sector.endDate).endOf('d').toDate();

  return returnedVersion;
};

exports.computeHoursToWork = (month, contracts) => {
  const contractsInfoSum = { contractHours: 0, holidaysHours: 0, absencesHours: 0 };

  for (const contract of contracts) {
    const contractQuery = {
      startDate: moment.max(moment(month, 'MMYYYY').startOf('M'), moment(contract.sector.startDate)).toDate(),
      endDate: contract.sector.endDate
        ? moment.min(moment(month, 'MMYYYY').endOf('M'), moment(contract.sector.endDate)).toDate()
        : moment(month, 'MMYYYY').endOf('M').toDate(),
    };

    let versions = ContractHelper.getMatchingVersionsList(contract.versions || [], contractQuery);
    versions = versions.map(version => updateVersionsWithSectorDates(version, contract.sector));
    const contractWithSectorDates = { ...contract, versions };

    const contractInfo = DraftPayHelper.getContractMonthInfo(contractWithSectorDates, contractQuery);
    contractsInfoSum.contractHours += contractInfo.contractHours;
    contractsInfoSum.holidaysHours += contractInfo.holidaysHours;

    if (contractWithSectorDates.absences.length) {
      contractsInfoSum.absencesHours += DraftPayHelper.getPayFromAbsences(
        contractWithSectorDates.absences,
        contractWithSectorDates,
        contractQuery
      );
    }
  }

  return Math.max(contractsInfoSum.contractHours - contractsInfoSum.holidaysHours - contractsInfoSum.absencesHours, 0);
};

exports.getHoursToWorkBySector = async (query, credentials) => {
  const hoursToWorkBySector = [];
  const sectors = UtilsHelper.formatObjectIdsArray(query.sector);

  const contractsAndEventsBySector = await SectorHistoryRepository.getContractsAndAbsencesBySector(
    query.month,
    sectors,
    get(credentials, 'company._id', null)
  );

  for (const sector of contractsAndEventsBySector) {
    hoursToWorkBySector.push({
      sector: sector._id,
      hoursToWork: exports.computeHoursToWork(query.month, sector.contracts),
    });
  }

  return hoursToWorkBySector;
};
