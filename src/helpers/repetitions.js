const omit = require('lodash/omit');
const get = require('lodash/get');
const Repetition = require('../models/Repetition');
const Event = require('../models/Event');
const EventsHelper = require('./events');
const { CompaniDate } = require('./dates/companiDates');
const {
  FIELDS_NOT_APPLICABLE_TO_REPETITION,
  EVERY_TWO_WEEKS,
  EVERY_WEEK,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
  SUNDAY,
  EVERY_DAY,
  EVERY_WEEK_DAY,
} = require('./constants');

exports.updateRepetitions = async (eventPayload, parentId) => {
  const repetition = await Repetition.findOne({ parentId }).lean();
  if (!repetition) return;

  const payloadStartHour = CompaniDate(eventPayload.startDate).getUnits(['hour', 'minute']);
  const payloadEndHour = CompaniDate(eventPayload.endDate).getUnits(['hour', 'minute']);
  const startDate = CompaniDate(repetition.startDate).set(payloadStartHour).toISO();
  const endDate = CompaniDate(repetition.endDate).set(payloadEndHour).toISO();

  const repetitionPayload = { ...omit(eventPayload, ['_id']), startDate, endDate };
  const payload = EventsHelper.formatEditionPayload(repetition, repetitionPayload, false);
  await Repetition.findOneAndUpdate({ parentId }, payload);
};

exports.formatPayloadForRepetitionCreation = (event, payload, companyId) => ({
  ...omit(payload, FIELDS_NOT_APPLICABLE_TO_REPETITION),
  company: companyId,
  repetition: { ...payload.repetition, parentId: event._id },
});

exports.list = async (query, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const { auxiliary, customer } = query;

  let repetitions = [];
  if (auxiliary) {
    repetitions = await Repetition
      .find({ auxiliary, company: companyId }, { attachement: 0, misc: 0, address: 0, sector: 0 })
      .populate({
        path: 'customer',
        select: 'identity subscriptions.service subscriptions._id',
        populate: { path: 'subscriptions.service', select: 'versions.name versions.createdAt' },
      })
      .populate({ path: 'internalHour', select: 'name' })
      .lean();
  }

  if (customer) {
    repetitions = await Repetition
      .find({ customer, company: companyId }, { attachement: 0, misc: 0, address: 0 })
      .populate({
        path: 'customer',
        select: 'subscriptions.service subscriptions._id',
        populate: { path: 'subscriptions.service', select: 'versions.name versions.createdAt' },
      })
      .populate({ path: 'auxiliary', select: 'identity picture' })
      .populate({ path: 'sector', select: 'name' })
      .lean();
  }

  const repetitionsGroupedByDay = {
    [MONDAY]: [],
    [TUESDAY]: [],
    [WEDNESDAY]: [],
    [THURSDAY]: [],
    [FRIDAY]: [],
    [SATURDAY]: [],
    [SUNDAY]: [],
  };

  for (const day of Object.keys(repetitionsGroupedByDay)) {
    for (const repetition of repetitions) {
      switch (repetition.frequency) {
        case EVERY_TWO_WEEKS: case EVERY_WEEK:
          if ((CompaniDate(repetition.startDate).weekday()).toString() === day) {
            repetitionsGroupedByDay[day].push(repetition);
          }
          break;
        case EVERY_DAY:
          repetitionsGroupedByDay[day].push(repetition);
          break;
        case EVERY_WEEK_DAY:
          if (day !== SATURDAY.toString() && day !== SUNDAY.toString()) repetitionsGroupedByDay[day].push(repetition);
          break;
      }
    }
    repetitionsGroupedByDay[day].sort((a, b) => {
      const getFirstRepetitionHours = CompaniDate(a.startDate).getUnits(['hour', 'minute']);
      const getSecondRepetitionHours = CompaniDate(b.startDate).getUnits(['hour', 'minute']);
      const formattedFirstRepetitionHours = CompaniDate().set(getFirstRepetitionHours).toISO();
      const formattedSecondRepetitionHours = CompaniDate().set(getSecondRepetitionHours).toISO();

      if (CompaniDate(formattedFirstRepetitionHours).isSameOrBefore(formattedSecondRepetitionHours)) return -1;
      return 1;
    });
  }

  return repetitionsGroupedByDay;
};

exports.delete = async (repetitionId, startDate, credentials) => {
  const companyId = get(credentials, 'company._id');
  const bddRepetition = await Repetition.findOne({ _id: repetitionId, company: companyId }, { parentId: 1 }).lean();

  const query = { 'repetition.parentId': bddRepetition.parentId, startDate: { $gte: startDate }, company: companyId };

  const eventsLinkedToRepetition = await Event.countDocuments(query);

  if (eventsLinkedToRepetition) await EventsHelper.deleteEventsAndRepetition(query, true, credentials);
  else await Repetition.deleteOne({ _id: repetitionId });
};
