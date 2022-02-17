const Boom = require('@hapi/boom');
const moment = require('moment');
const get = require('lodash/get');
const omit = require('lodash/omit');
const set = require('lodash/set');
const cloneDeep = require('lodash/cloneDeep');
const pick = require('lodash/pick');
const has = require('lodash/has');
const {
  NEVER,
  EVERY_DAY,
  EVERY_WEEK_DAY,
  EVERY_WEEK,
  EVERY_TWO_WEEKS,
  ABSENCE,
  UNAVAILABILITY,
  INTERVENTION,
  INTERNAL_HOUR,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  FORCAST_PERIOD_FOR_CREATING_EVENTS,
} = require('./constants');
const Event = require('../models/Event');
const User = require('../models/User');
const Repetition = require('../models/Repetition');
const Customer = require('../models/Customer');
const CustomerAbsencesHelper = require('./customerAbsences');
const EventsHelper = require('./events');
const RepetitionsHelper = require('./repetitions');
const EventsValidationHelper = require('./eventsValidation');
const { CompaniInterval } = require('./dates/companiIntervals');
const translate = require('./translate');
const { CompaniDate } = require('./dates/companiDates');

const { language } = translate;

exports.formatRepeatedPayload = async (event, sector, date) => {
  const step = CompaniDate(date).diff(event.startDate, 'days');
  const isIntervention = event.type === INTERVENTION;
  let payload = {
    ...cloneDeep(omit(event, '_id')), // cloneDeep necessary to copy repetition
    startDate: CompaniDate(event.startDate).add(step).toISO(),
    endDate: CompaniDate(event.endDate).add(step).toISO(),
  };
  const hasConflicts = await EventsValidationHelper.hasConflicts(payload);

  if (isIntervention) {
    if (event.auxiliary && hasConflicts) {
      payload = { ...omit(payload, 'auxiliary'), 'repetition.frequency': NEVER, sector };
    }

    const customerIsAbsent = await CustomerAbsencesHelper.isAbsent(event.customer, payload.startDate);
    if (customerIsAbsent) return null;
  } else if (([INTERNAL_HOUR, UNAVAILABILITY].includes(event.type)) && hasConflicts) return null;

  return new Event(payload);
};

exports.createRepeatedEvents = async (payload, range, sector) => {
  const repeatedEvents = [];
  const isIntervention = payload.type === INTERVENTION;

  const customer = isIntervention
    ? await Customer.findOne({ _id: payload.customer, stoppedAt: { $exists: true } }, { stoppedAt: 1 }).lean()
    : null;

  for (const date of range) {
    const repeatedEvent = await exports.formatRepeatedPayload(payload, sector, date);
    if (isIntervention && has(customer, 'stoppedAt') && get(repeatedEvent, 'startDate') > customer.stoppedAt) break;
    if (repeatedEvent) repeatedEvents.push(repeatedEvent);
  }

  await Event.insertMany(repeatedEvents);
};

exports.getRange = (startDate, stepDuration) => {
  const lastestDate = CompaniDate().isAfter(startDate) ? CompaniDate() : CompaniDate(startDate);

  const start = CompaniDate(startDate).add(stepDuration);
  const end = lastestDate.startOf('day').add(FORCAST_PERIOD_FOR_CREATING_EVENTS);

  return CompaniInterval(start, end).rangeBy(stepDuration);
};

exports.createRepetitions = async (eventFromDb, payload, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  if (payload.repetition.frequency === NEVER) return eventFromDb;

  if (get(eventFromDb, 'repetition.frequency', NEVER) !== NEVER) {
    await Event.updateOne({ _id: eventFromDb._id }, { 'repetition.parentId': eventFromDb._id });
  }
  let sectorId = eventFromDb.sector;
  if (!eventFromDb.sector) {
    const user = await User.findOne({ _id: eventFromDb.auxiliary._id })
      .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
      .lean({ autopopulate: true, virtuals: true });
    sectorId = user.sector;
  }

  let range;
  switch (payload.repetition.frequency) {
    case EVERY_DAY:
      range = exports.getRange(payload.startDate, { days: 1 });
      break;
    case EVERY_WEEK_DAY: {
      const rangeByDay = exports.getRange(payload.startDate, { days: 1 });
      range = rangeByDay
        .filter(date => [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY].includes(CompaniDate(date).weekday()));
      break;
    } case EVERY_WEEK:
      range = exports.getRange(payload.startDate, { weeks: 1 });
      break;
    case EVERY_TWO_WEEKS:
      range = exports.getRange(payload.startDate, { weeks: 2 });
      break;
    default:
      break;
  }

  await exports.createRepeatedEvents(payload, range, sectorId);

  await (new Repetition({ ...payload, ...payload.repetition })).save();

  return eventFromDb;
};

exports.updateRepetition = async (eventFromDb, eventPayload, credentials) => {
  const parentStartDate = moment(eventPayload.startDate);
  const parentEndDate = moment(eventPayload.endDate);
  const promises = [];
  const companyId = get(credentials, 'company._id', null);

  const query = {
    'repetition.parentId': eventFromDb.repetition.parentId,
    'repetition.frequency': { $not: { $eq: NEVER } },
    startDate: { $gte: new Date(eventFromDb.startDate) },
    company: companyId,
  };
  const events = await Event.find(query).lean();

  let sectorId = eventFromDb.sector;
  if (!eventFromDb.sector) {
    const user = await User.findOne({ _id: eventFromDb.auxiliary })
      .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
      .lean();
    sectorId = user.sector;
  }

  for (let i = 0, l = events.length; i < l; i++) {
    const startDate = moment(events[i].startDate).hours(parentStartDate.hours())
      .minutes(parentStartDate.minutes()).toISOString();
    const endDate = moment(events[i].endDate).hours(parentEndDate.hours())
      .minutes(parentEndDate.minutes()).toISOString();
    let eventToSet = {
      ...eventPayload,
      startDate,
      endDate,
      _id: events[i]._id,
      type: events[i].type,
      ...(events[i].customer && { customer: events[i].customer }),
    };

    if (eventToSet.type === INTERVENTION) {
      const customerIsAbsent = await CustomerAbsencesHelper.isAbsent(eventToSet.customer, eventToSet.startDate);
      if (customerIsAbsent) continue;
    }

    const hasConflicts = await EventsValidationHelper.hasConflicts({ ...eventToSet, company: companyId });
    if (eventFromDb.type !== INTERVENTION && hasConflicts) promises.push(Event.deleteOne({ _id: events[i]._id }));
    else {
      const detachFromRepetition = !!eventPayload.auxiliary && hasConflicts;
      if (detachFromRepetition || !eventPayload.auxiliary) {
        eventToSet = set(omit(eventToSet, 'auxiliary'), 'sector', sectorId);
      }

      const payload = EventsHelper.formatEditionPayload(events[i], eventToSet, detachFromRepetition);
      promises.push(Event.updateOne({ _id: events[i]._id }, payload));
    }
  }

  await Promise.all([
    ...promises,
    RepetitionsHelper.updateRepetitions(eventPayload, eventFromDb.repetition.parentId),
  ]);

  return eventFromDb;
};

exports.isRepetitionValid = repetition => repetition.frequency !== NEVER && !!repetition.parentId;

exports.deleteRepetition = async (event, credentials) => {
  const { type, repetition } = event;
  if (type === ABSENCE || !repetition) return;
  if (!exports.isRepetitionValid(repetition)) throw Boom.badData(translate[language].invalidRepetition);

  const query = {
    'repetition.parentId': event.repetition.parentId,
    startDate: { $gte: new Date(event.startDate) },
    company: get(credentials, 'company._id'),
  };

  await EventsHelper.deleteEventsAndRepetition(query, true, credentials);
};

exports.formatEventBasedOnRepetition = async (repetition, date) => {
  const { frequency, parentId, startDate, endDate } = repetition;
  const startDateObj = moment(startDate).toObject();
  const endDateObj = moment(endDate).toObject();
  const timeFields = ['hours', 'minutes', 'seconds', 'milliseconds'];
  const newEventStartDate = moment(date).add(90, 'd').set(pick(startDateObj, timeFields)).toDate();
  const newEventEndDate = moment(date).add(90, 'd').set(pick(endDateObj, timeFields)).toDate();
  const pickedFields = [
    'type',
    'customer',
    'subscription',
    'auxiliary',
    'sector',
    'misc',
    'internalHour',
    'address',
    'company',
  ];
  let newEvent = {
    ...pick(cloneDeep(repetition), pickedFields),
    startDate: newEventStartDate,
    endDate: newEventEndDate,
    repetition: { frequency, parentId },
  };

  const hasConflicts = await EventsValidationHelper.hasConflicts(newEvent);
  if ([INTERNAL_HOUR, UNAVAILABILITY].includes(newEvent.type) && hasConflicts) return null;

  if (newEvent.type === INTERVENTION && newEvent.auxiliary && hasConflicts) {
    newEvent = await EventsHelper.detachAuxiliaryFromEvent(newEvent, repetition.company);
  }

  return newEvent;
};
