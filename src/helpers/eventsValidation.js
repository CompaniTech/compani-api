const Boom = require('@hapi/boom');
const moment = require('moment');
const get = require('lodash/get');
const omit = require('lodash/omit');
const momentRange = require('moment-range');
const {
  INTERVENTION,
  ABSENCE,
  UNAVAILABILITY,
  NEVER,
  CUSTOMER_CONTRACT,
  INTERNAL_HOUR,
} = require('./constants');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Contract = require('../models/Contract');
const { populateSubscriptionsServices } = require('../helpers/subscriptions');
const ContractsHelper = require('../helpers/contracts');
const EventRepository = require('../repositories/EventRepository');
const translate = require('./translate');

const { language } = translate;

momentRange.extendMoment(moment);

exports.checkContracts = async (event, user) => {
  if (!user.contracts || user.contracts.length === 0) return false;

  // If the event is an intervention :
  // - if it's a customer contract subscription, the auxiliary should have an active contract with the customer
  // on the day of the intervention
  // - else (company contract subscription) the auxiliary should have an active contract on the day of the
  // intervention and this customer should have an active subscription
  if (event.type === INTERVENTION) {
    let customer = await Customer
      .findOne({ _id: event.customer })
      .populate({ path: 'subscriptions.service', populate: { path: 'versions.surcharge' } })
      .lean();
    customer = populateSubscriptionsServices(customer);

    const eventSubscription = customer.subscriptions.find(sub => sub._id.toHexString() == event.subscription);
    if (!eventSubscription) return false;

    if (eventSubscription.service.type === CUSTOMER_CONTRACT) {
      const contractBetweenAuxAndCus = await Contract.findOne({ user: event.auxiliary, customer: event.customer });
      if (!contractBetweenAuxAndCus) return false;
      return contractBetweenAuxAndCus.endDate
        ? moment(event.startDate).isBetween(contractBetweenAuxAndCus.startDate, contractBetweenAuxAndCus.endDate, '[]')
        : moment(event.startDate).isSameOrAfter(contractBetweenAuxAndCus.startDate);
    }

    return ContractsHelper.auxiliaryHasActiveCompanyContractOnDay(user.contracts, event.startDate);
  }

  // If the auxiliary is only under customer contract, create internal hours is not allowed
  if (event.type === INTERNAL_HOUR) {
    return ContractsHelper.auxiliaryHasActiveCompanyContractOnDay(user.contracts, event.startDate);
  }

  return true;
};

exports.hasConflicts = async (event) => {
  const { _id, auxiliary, startDate, endDate } = event;

  const auxiliaryEvents = event.type !== ABSENCE
    ? await EventRepository.getAuxiliaryEventsBetweenDates(auxiliary, startDate, endDate, event.company)
    : await EventRepository.getAuxiliaryEventsBetweenDates(auxiliary, startDate, endDate, event.company, ABSENCE);

  return auxiliaryEvents.some((ev) => {
    if ((_id && _id.toHexString() === ev._id.toHexString()) || ev.isCancelled) return false;
    return true;
  });
};

const isOneDayEvent = event => moment(event.startDate).isSame(event.endDate, 'day');
const isAuxiliaryUpdated = (payload, eventFromDB) => payload.auxiliary &&
  payload.auxiliary !== eventFromDB.auxiliary.toHexString();
const isRepetition = event => event.repetition && event.repetition.frequency && event.repetition.frequency !== NEVER;

exports.isEditionAllowed = async (event, credentials) => {
  if (event.type !== ABSENCE && !isOneDayEvent(event)) return false;
  if (!event.auxiliary) return event.type === INTERVENTION;
  const user = await User.findOne({ _id: event.auxiliary })
    .populate('contracts')
    .populate({ path: 'sector', select: '_id sector', match: { company: get(credentials, 'company._id', null) } })
    .lean({ autopopulate: true, virtuals: true });
  if (!await exports.checkContracts(event, user)) return false;

  return true;
};

exports.isCreationAllowed = async (event, credentials) => {
  const isConflict = !(isRepetition(event) && event.type === INTERVENTION) && await exports.hasConflicts(event);
  if (isConflict) throw Boom.conflict(translate[language].eventsConflict);

  return exports.isEditionAllowed(event, credentials);
};

exports.isUpdateAllowed = async (eventFromDB, payload, credentials) => {
  if (eventFromDB.type === INTERVENTION && eventFromDB.isBilled) return false;
  if ([ABSENCE, UNAVAILABILITY].includes(eventFromDB.type) && isAuxiliaryUpdated(payload, eventFromDB)) return false;

  const event = !payload.auxiliary
    ? { ...omit(eventFromDB, 'auxiliary'), ...payload }
    : { ...eventFromDB, ...payload };

  const isSingleIntervention = !(isRepetition(event) && event.type === INTERVENTION) && !event.isCancelled;
  const undoCancellation = eventFromDB.isCancelled && !payload.isCancelled;
  if ((isSingleIntervention || undoCancellation) && await exports.hasConflicts(event)) {
    throw Boom.conflict(translate[language].eventsConflict);
  }

  return exports.isEditionAllowed(event, credentials);
};

exports.isDeletionAllowed = event => event.type !== INTERVENTION || !event.isBilled;
