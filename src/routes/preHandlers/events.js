const Boom = require('boom');
const get = require('lodash/get');
const Event = require('../../models/Event');
const Customer = require('../../models/Customer');
const User = require('../../models/User');
const InternalHour = require('../../models/InternalHour');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.getEvent = async (req) => {
  try {
    const event = await Event.findById(req.params._id).lean();
    if (!event) throw Boom.notFound(translate[language].eventNotFound);

    return event;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeEventDeletion = async (req) => {
  const { credentials } = req.auth;
  const event = req.pre.event || req.payload;

  const canEditEvent = credentials.scope.includes('events:edit');
  const isOwnEvent = credentials.scope.includes('events:own:edit') && event.auxiliary === credentials._id;
  if (!canEditEvent && !isOwnEvent) throw Boom.forbidden();

  return null;
};

exports.authorizeEventCreation = async (req) => {
  const { credentials } = req.auth;
  const { payload } = req;

  const canEditEvent = credentials.scope.includes('events:edit');
  const isOwnEvent = credentials.scope.includes('events:own:edit') && payload.auxiliary === credentials._id;
  if (!canEditEvent && !isOwnEvent) throw Boom.forbidden();

  return exports.checkEventCreationOrUpdate(req);
};

exports.authorizeEventUpdate = async (req) => {
  const { credentials } = req.auth;
  const { pre } = req;

  const canEditEvent = credentials.scope.includes('events:edit');
  const isOwnEvent = pre.event.auxiliary && credentials.scope.includes('events:own:edit') &&
    pre.event.auxiliary.toHexString() === credentials._id;
  if (!canEditEvent && !isOwnEvent) throw Boom.forbidden();

  return exports.checkEventCreationOrUpdate(req);
};

exports.checkEventCreationOrUpdate = async (req) => {
  const { credentials } = req.auth;
  const event = req.pre.event || req.payload;
  const companyId = get(credentials, 'company._id', null);

  if (req.payload.customer || (event.customer && req.payload.subscription)) {
    const customerId = req.payload.customer || event.customer;
    const customer = await Customer.findOne(({ _id: customerId, company: companyId })).lean();
    if (!customer) throw Boom.forbidden();
    const subscriptionsIds = customer.subscriptions.map(subscription => subscription._id.toHexString());
    if (!(subscriptionsIds.includes(req.payload.subscription))) throw Boom.forbidden();
  }

  if (req.payload.auxiliary) {
    const auxiliary = await User.findOne(({ _id: req.payload.auxiliary, company: companyId })).lean();
    if (!auxiliary) throw Boom.forbidden();
    const eventSector = req.payload.sector || event.sector;
    if (auxiliary.sector.toHexString() !== eventSector) throw Boom.forbidden();
  }

  if (req.payload.internalHour) {
    const internalHour = await InternalHour.findOne(({ _id: req.payload.internalHour, company: companyId })).lean();
    if (!internalHour) throw Boom.forbidden();
  }

  return null;
};
