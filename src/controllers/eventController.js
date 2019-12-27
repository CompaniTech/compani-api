const Boom = require('boom');
const moment = require('moment');
const translate = require('../helpers/translate');
const EventsHelper = require('../helpers/events');
const { isEditionAllowed } = require('../helpers/eventsValidation');
const { deleteRepetition } = require('../helpers/eventsRepetition');
const { ABSENCE } = require('../helpers/constants');

const { language } = translate;

const list = async (req) => {
  try {
    const events = await EventsHelper.list(req.query, req.auth.credentials);
    return {
      message: events.length === 0 ? translate[language].eventsNotFound : translate[language].eventsFound,
      data: { events },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const listForCreditNotes = async (req) => {
  try {
    const events = await EventsHelper.listForCreditNotes(req.query, req.auth.credentials);
    return {
      message: events.length === 0 ? translate[language].eventsNotFound : translate[language].eventsFound,
      data: { events },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    const { payload, auth } = req;
    const event = await EventsHelper.createEvent(payload, auth.credentials);

    return {
      message: translate[language].eventCreated,
      data: { event },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    const { payload, auth } = req;
    let { event } = req.pre;

    if (event.type !== ABSENCE && !moment(payload.startDate).isSame(payload.endDate, 'day')) {
      throw Boom.badRequest(translate[language].eventDatesNotOnSameDay);
    }

    if (!(await isEditionAllowed(event, payload))) return Boom.badData();

    event = await EventsHelper.updateEvent(event, payload, auth.credentials);

    return {
      message: translate[language].eventUpdated,
      data: { event },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    const { auth, pre } = req;
    const event = await EventsHelper.deleteEvent(pre.event, auth.credentials);
    if (!event) return Boom.notFound(translate[language].eventNotFound);

    return { message: translate[language].eventDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeRepetition = async (req) => {
  try {
    const { auth, pre } = req;
    const event = await deleteRepetition(pre.event, auth.credentials);

    return {
      message: translate[language].eventDeleted,
      data: { event },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const deleteList = async (req) => {
  try {
    const { query, auth } = req;

    await EventsHelper.deleteList(query.customer, query.startDate, query.endDate, auth.credentials);

    return { message: translate[language].eventsDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getWorkingStats = async (req) => {
  try {
    const { query, auth } = req;
    const stats = await EventsHelper.workingStats(query, auth.credentials);

    return {
      message: translate[language].hoursBalanceDetail,
      data: { workingStats: stats },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  list,
  create,
  update,
  remove,
  removeRepetition,
  deleteList,
  listForCreditNotes,
  getWorkingStats,
};
