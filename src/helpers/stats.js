const { ObjectId } = require('mongodb');
const get = require('lodash/get');
const pick = require('lodash/pick');
const UtilsHelper = require('./utils');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');
const StatRepository = require('../repositories/StatRepository');
const SectorHistoryRepository = require('../repositories/SectorHistoryRepository');
const CompanyRepository = require('../repositories/CompanyRepository');

const isHoliday = day => CompaniDate(day).startOf('day').isHoliday();

const isInCareDays = (careDays, day) => (careDays.includes(CompaniDate(day).weekday() - 1) && !isHoliday(day)) ||
  (careDays.includes(7) && isHoliday(day));

const isNotStarted = (eventStartDate, fundingStartDate) => CompaniDate(fundingStartDate).isAfter(eventStartDate);

const isEnded = (eventStartDate, fundingEndDate) => fundingEndDate &&
  CompaniDate(fundingEndDate).isBefore(eventStartDate);

const getMonthCareHours = (events, funding) => {
  const monthCareHours = events
    .reduce(
      (acc, event) => (!isInCareDays(funding.careDays, event.startDate) ||
      isNotStarted(event.startDate, funding.startDate) || isEnded(event.startDate, funding.endDate)
        ? acc
        : acc.add(CompaniDuration(CompaniDate(event.endDate).diff(event.startDate, 'minutes')))),
      CompaniDuration()
    )
    .asHours();

  return monthCareHours;
};

exports.getCustomerFollowUp = async (customerId, credentials) =>
  CompanyRepository.getCustomerFollowUp(customerId, credentials);

exports.getCustomerFundingsMonitoring = async (customerId, credentials) => {
  const fundingsDate = {
    maxStartDate: CompaniDate().endOf('month').toISO(),
    minEndDate: CompaniDate().startOf('month').toISO(),
  };
  const eventsDate = {
    minDate: CompaniDate().subtract({ months: 1 }).startOf('month').toISO(),
    maxDate: CompaniDate().endOf('month').toISO(),
  };
  const eventsGroupedByFundings = await StatRepository.getEventsGroupedByFundings(
    customerId,
    fundingsDate,
    eventsDate,
    get(credentials, 'company._id', null)
  );
  const customerFundingsMonitoring = [];

  for (const funding of eventsGroupedByFundings) {
    const isPrevMonthRelevant = CompaniDate(funding.startDate).isBefore(CompaniDate().startOf('month'));
    customerFundingsMonitoring.push({
      thirdPartyPayer: funding.thirdPartyPayer.name,
      careHours: funding.careHours,
      prevMonthCareHours: isPrevMonthRelevant ? getMonthCareHours(funding.prevMonthEvents, funding) : -1,
      currentMonthCareHours: getMonthCareHours(funding.currentMonthEvents, funding),
    });
  }

  return customerFundingsMonitoring;
};

exports.getAllCustomersFundingsMonitoring = async (credentials) => {
  const fundingsDate = {
    maxStartDate: CompaniDate().endOf('month').toISO(),
    minEndDate: CompaniDate().startOf('month').toISO(),
  };
  const eventsDate = {
    minDate: CompaniDate().subtract({ months: 1 }).startOf('month').toISO(),
    maxDate: CompaniDate().add({ months: 1 }).endOf('month').toISO(),
  };
  const eventsGroupedByFundingsforAllCustomers = await StatRepository.getEventsGroupedByFundingsforAllCustomers(
    fundingsDate,
    eventsDate,
    get(credentials, 'company._id', null)
  );

  const allCustomersFundingsMonitoring = [];
  for (const funding of eventsGroupedByFundingsforAllCustomers) {
    const isPrevMonthRelevant = CompaniDate(funding.startDate).isBefore(CompaniDate().startOf('month'));
    const isNextMonthRelevant = !funding.endDate ||
      CompaniDate(funding.endDate).isAfter(CompaniDate().endOf('month'));

    allCustomersFundingsMonitoring.push({
      ...pick(funding, ['sector', 'customer', 'referent', 'unitTTCRate', 'customerParticipationRate']),
      careHours: funding.careHours,
      tpp: funding.thirdPartyPayer,
      prevMonthCareHours: isPrevMonthRelevant ? getMonthCareHours(funding.prevMonthEvents, funding) : -1,
      currentMonthCareHours: getMonthCareHours(funding.currentMonthEvents, funding),
      nextMonthCareHours: isNextMonthRelevant ? getMonthCareHours(funding.nextMonthEvents, funding) : -1,
    });
  }

  return allCustomersFundingsMonitoring;
};

exports.getPaidInterventionStats = async (query, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  if (query.sector) {
    const sectors = UtilsHelper.formatObjectIdsArray(query.sector);
    const startOfMonth = CompaniDate(query.month, 'MM-yyyy').startOf('month').toISO();
    const endOfMonth = CompaniDate(query.month, 'MM-yyyy').endOf('month').toISO();
    const auxiliariesFromSectorHistories = await SectorHistoryRepository.getUsersFromSectorHistories(
      startOfMonth,
      endOfMonth,
      sectors,
      companyId
    );
    return SectorHistoryRepository.getPaidInterventionStats(
      auxiliariesFromSectorHistories.map(aux => aux.auxiliaryId),
      query.month,
      companyId
    );
  }
  return SectorHistoryRepository.getPaidInterventionStats([new ObjectId(query.auxiliary)], query.month, companyId);
};

exports.getCustomersAndDurationBySector = async (query, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const sectors = UtilsHelper.formatObjectIdsArray(query.sector);

  return StatRepository.getCustomersAndDurationBySector(sectors, query.month, companyId);
};

exports.getIntenalAndBilledHoursBySector = async (query, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const sectors = UtilsHelper.formatObjectIdsArray(query.sector);

  return StatRepository.getIntenalAndBilledHoursBySector(sectors, query.month, companyId);
};
