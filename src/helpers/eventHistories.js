const moment = require('moment');
const get = require('lodash/get');
const pickBy = require('lodash/pickBy');
const EventHistory = require('../models/EventHistory');
const User = require('../models/User');
const { EVENT_CREATION, EVENT_DELETION, EVENT_UPDATE, INTERNAL_HOUR, ABSENCE } = require('./constants');
const UtilsHelper = require('./utils');
const EventHistoryRepository = require('../repositories/EventHistoryRepository');

exports.getEventHistories = async (query, credentials) => {
  const { createdAt } = query;
  const listQuery = exports.getListQuery(query, credentials);

  return EventHistoryRepository.paginate(listQuery, createdAt);
};

exports.getListQuery = (query, credentials) => {
  const { sectors, auxiliaries, createdAt } = query;
  const queryCompany = { company: get(credentials, 'company._id', null) };
  if (createdAt) queryCompany.createdAt = { $lte: createdAt };

  const orRules = [];
  if (sectors) orRules.push(...UtilsHelper.formatArrayOrStringQueryParam(sectors, 'sectors'));
  if (auxiliaries) orRules.push(...UtilsHelper.formatArrayOrStringQueryParam(auxiliaries, 'auxiliaries'));

  if (orRules.length === 0) return queryCompany;
  if (orRules.length === 1) return { ...queryCompany, ...orRules[0] };
  return { ...queryCompany, $or: orRules };
};

exports.createEventHistory = async (payload, credentials, action) => {
  const { _id: createdBy } = credentials;
  const {
    customer,
    startDate,
    endDate,
    type,
    absence,
    internalHour,
    address,
    misc,
    repetition,
  } = payload;

  const eventHistory = {
    company: get(credentials, 'company._id', null),
    createdBy,
    action,
    event: pickBy({
      type,
      startDate,
      endDate,
      customer,
      absence,
      internalHour,
      address,
      misc,
      repetition,
    }),
  };

  if (payload.sector) eventHistory.sectors = [payload.sector];
  if (payload.auxiliary) {
    eventHistory.auxiliaries = [payload.auxiliary];
    eventHistory.event.auxiliary = payload.auxiliary;
    const aux = await User
      .findOne({ _id: payload.auxiliary })
      .populate({ path: 'sector', select: '_id sector', match: { company: get(credentials, 'company._id', null) } })
      .lean({ autopopulate: true, virtuals: true });
    eventHistory.sectors = [aux.sector.toHexString()];
  }

  await EventHistory.create(eventHistory);
};

exports.createEventHistoryOnCreate = async (payload, credentials) =>
  exports.createEventHistory(payload, credentials, EVENT_CREATION);

exports.createEventHistoryOnDelete = async (payload, credentials) =>
  exports.createEventHistory(payload, credentials, EVENT_DELETION);

const areDaysChanged = (event, payload) => !moment(event.startDate).isSame(payload.startDate, 'day') ||
  !moment(event.endDate).isSame(payload.endDate, 'day');

const isAuxiliaryUpdated = (event, payload) => (!event.auxiliary && payload.auxiliary) ||
  (event.auxiliary && event.auxiliary.toHexString() !== payload.auxiliary);

const areHoursChanged = (event, payload) => {
  const eventStartHour = moment(event.startDate).format('HH:mm');
  const eventEndHour = moment(event.endDate).format('HH:mm');
  const payloadStartHour = moment(payload.startDate).format('HH:mm');
  const payloadEndHour = moment(payload.endDate).format('HH:mm');

  return eventStartHour !== payloadStartHour || eventEndHour !== payloadEndHour;
};

exports.createEventHistoryOnUpdate = async (payload, event, credentials) => {
  const { _id: createdBy } = credentials;
  const { customer, type, repetition } = event;
  const { startDate, endDate, misc } = payload;
  const companyId = get(credentials, 'company._id', null);

  const eventHistory = {
    company: companyId,
    createdBy,
    action: EVENT_UPDATE,
    event: { type, startDate, endDate, customer, misc },
  };
  if (payload.shouldUpdateRepetition) eventHistory.event.repetition = repetition;
  if (event.type === INTERNAL_HOUR) eventHistory.event.internalHour = payload.internalHour || event.internalHour;
  if (event.type === ABSENCE) eventHistory.event.absence = payload.absence || event.absence;

  const promises = [];
  if (isAuxiliaryUpdated(event, payload)) {
    const auxiliaryUpdateHistory = await exports.formatEventHistoryForAuxiliaryUpdate(eventHistory, payload, event, companyId);
    promises.push(new EventHistory(auxiliaryUpdateHistory).save());
  }
  if (areDaysChanged(event, payload)) {
    const datesUpdateHistory = await exports.formatEventHistoryForDatesUpdate(eventHistory, payload, event, companyId);
    promises.push(new EventHistory(datesUpdateHistory).save());
  } else if (areHoursChanged(event, payload)) {
    const hoursUpdateHistory = await exports.formatEventHistoryForHoursUpdate(eventHistory, payload, event, companyId);
    promises.push(new EventHistory(hoursUpdateHistory).save());
  }
  if (payload.isCancelled && !event.isCancelled) {
    const cancelUpdateHistory = await exports.formatEventHistoryForCancelUpdate(eventHistory, payload, companyId);
    promises.push(new EventHistory(cancelUpdateHistory).save());
  }

  await Promise.all(promises);
};

exports.formatEventHistoryForAuxiliaryUpdate = async (mainInfo, payload, event, companyId) => {
  const sectors = [];
  let auxiliaries = [];
  let update = [];
  if (event.auxiliary && payload.auxiliary) {
    auxiliaries = [event.auxiliary.toHexString(), payload.auxiliary];
    update = { auxiliary: { from: event.auxiliary.toHexString(), to: payload.auxiliary } };

    const auxiliaryList = await User
      .find({ _id: { $in: [event.auxiliary, payload.auxiliary] } })
      .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
      .lean({ autopopulate: true, virtuals: true });
    for (const aux of auxiliaryList) {
      if (!sectors.includes(aux.sector._id)) sectors.push(aux.sector);
    }
  } else if (event.auxiliary) {
    auxiliaries = [event.auxiliary.toHexString()];
    update = { auxiliary: { from: event.auxiliary.toHexString() } };
    const aux = await User
      .findOne({ _id: event.auxiliary })
      .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
      .lean({ autopopulate: true, virtuals: true });
    if (!sectors.includes(aux.sector)) sectors.push(aux.sector.toHexString());
  } else if (payload.auxiliary) {
    auxiliaries = [payload.auxiliary];
    update = { auxiliary: { to: payload.auxiliary } };
    const aux = await User
      .findOne({ _id: payload.auxiliary })
      .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
      .lean({ autopopulate: true, virtuals: true });
    if (!sectors.includes(aux.sector)) sectors.push(aux.sector.toHexString());
  }

  if (payload.sector && !sectors.includes(payload.sector)) sectors.push(payload.sector);
  if (event.sector && !sectors.includes(event.sector.toHexString())) sectors.push(event.sector.toHexString());

  return { ...mainInfo, sectors, auxiliaries, update };
};

const isOneDayEvent = (event, payload) => moment(event.endDate).isSame(event.startDate, 'day') &&
  moment(payload.endDate).isSame(payload.startDate, 'day');

exports.formatEventHistoryForDatesUpdate = async (mainInfo, payload, event, companyId) => {
  const datesUpdateHistory = {
    ...mainInfo,
    update: { startDate: { from: event.startDate, to: payload.startDate } },
  };

  if (payload.sector) datesUpdateHistory.sectors = [payload.sector];
  else {
    const aux = await User
      .findOne({ _id: payload.auxiliary })
      .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
      .lean({ autopopulate: true, virtuals: true });
    datesUpdateHistory.sectors = [aux.sector.toHexString()];
    datesUpdateHistory.auxiliaries = [payload.auxiliary];
    datesUpdateHistory.event.auxiliary = payload.auxiliary;
  }

  if (!isOneDayEvent(event, payload)) datesUpdateHistory.update.endDate = { from: event.endDate, to: payload.endDate };

  return datesUpdateHistory;
};

exports.formatEventHistoryForHoursUpdate = async (mainInfo, payload, event, companyId) => {
  const hoursUpdateHistory = {
    ...mainInfo,
    update: {
      startHour: { from: event.startDate, to: payload.startDate },
      endHour: { from: event.endDate, to: payload.endDate },
    },
  };

  if (payload.sector) hoursUpdateHistory.sectors = [payload.sector];
  else {
    const aux = await User
      .findOne({ _id: payload.auxiliary })
      .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
      .lean({ autopopulate: true, virtuals: true });
    hoursUpdateHistory.sectors = [aux.sector.toHexString()];
    hoursUpdateHistory.auxiliaries = [payload.auxiliary];
    hoursUpdateHistory.event.auxiliary = payload.auxiliary;
  }

  return hoursUpdateHistory;
};

exports.formatEventHistoryForCancelUpdate = async (mainInfo, payload, companyId) => {
  const { cancel } = payload;
  const datesUpdateHistory = { ...mainInfo, update: { cancel } };

  if (payload.sector) datesUpdateHistory.sectors = [payload.sector];
  else {
    const aux = await User
      .findOne({ _id: payload.auxiliary })
      .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
      .lean({ autopopulate: true, virtuals: true });
    datesUpdateHistory.sectors = [aux.sector.toHexString()];
    datesUpdateHistory.auxiliaries = [payload.auxiliary];
    datesUpdateHistory.event.auxiliary = payload.auxiliary;
  }

  return datesUpdateHistory;
};
