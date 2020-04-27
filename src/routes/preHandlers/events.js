const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Event = require('../../models/Event');
const Customer = require('../../models/Customer');
const ThirdPartyPayer = require('../../models/ThirdPartyPayer');
const Sector = require('../../models/Sector');
const User = require('../../models/User');
const InternalHour = require('../../models/InternalHour');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
const { AUXILIARY } = require('../../helpers/constants');

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

exports.authorizeEventGet = async (req) => {
  const companyId = get(req, 'auth.credentials.company._id', null);

  if (req.query.customer) {
    const customerIds = UtilsHelper.formatIdsArray(req.query.customer);
    const customerCount = await Customer.countDocuments({ _id: { $in: customerIds }, company: companyId });
    if (customerCount !== customerIds.length) throw Boom.forbidden();
  }

  if (req.query.auxiliary) {
    const auxiliariesIds = UtilsHelper.formatIdsArray(req.query.auxiliary);
    const auxiliariesCount = await User.countDocuments({ _id: { $in: auxiliariesIds }, company: companyId });
    if (auxiliariesCount !== auxiliariesIds.length) throw Boom.forbidden();
  }

  if (req.query.sector) {
    const sectorsIds = UtilsHelper.formatIdsArray(req.query.sector);
    const sectorCount = await Sector.countDocuments({ _id: { $in: sectorsIds }, company: companyId });
    if (sectorCount !== sectorsIds.length) throw Boom.forbidden();
  }

  return null;
};

exports.authorizeEventForCreditNoteGet = async (req) => {
  const companyId = get(req, 'auth.credentials.company._id', null);
  const customer = await Customer.findOne({ _id: req.query.customer, company: companyId }).lean();
  if (!customer) throw Boom.forbidden();

  if (req.query.thirdPartyPayer) {
    const tpp = await ThirdPartyPayer.findOne({ _id: req.query.thirdPartyPayer, company: companyId }).lean();
    if (!tpp) throw Boom.forbidden();
  }

  return null;
};

exports.authorizeEventDeletion = async (req) => {
  const { credentials } = req.auth;
  const { event } = req.pre;

  const isAuxiliary = get(credentials, 'role.client.name') === AUXILIARY;
  const isOwnEvent = event.auxiliary && event.auxiliary.toHexString() === credentials._id;
  if (isAuxiliary && !isOwnEvent) throw Boom.forbidden();

  return null;
};

exports.authorizeEventCreation = async (req) => {
  const { credentials } = req.auth;
  const { payload } = req;


  const isAuxiliary = get(credentials, 'role.client.name') === AUXILIARY;
  const isOwnEvent = payload.auxiliary && payload.auxiliary === credentials._id;
  if (isAuxiliary && !isOwnEvent) throw Boom.forbidden();

  return exports.checkEventCreationOrUpdate(req);
};

exports.authorizeEventUpdate = async (req) => {
  const { credentials } = req.auth;
  const { event } = req.pre;

  const isAuxiliary = get(credentials, 'role.client.name') === AUXILIARY;
  const isOwnEvent = (event.auxiliary && event.auxiliary.toHexString() === credentials._id) || !event.auxiliary;
  if (isAuxiliary && !isOwnEvent) throw Boom.forbidden();

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
  }

  if (req.payload.sector) {
    const sector = await Sector.findOne(({ _id: req.payload.sector, company: companyId })).lean();
    if (!sector) throw Boom.forbidden();
  }

  if (req.payload.internalHour) {
    const internalHour = await InternalHour.findOne(({ _id: req.payload.internalHour, company: companyId })).lean();
    if (!internalHour) throw Boom.forbidden();
  }

  return null;
};

exports.authorizeEventDeletionList = async (req) => {
  const { credentials } = req.auth;

  const isAuxiliary = get(credentials, 'role.client.name') === AUXILIARY;
  if (isAuxiliary) throw Boom.forbidden();

  const customer = await Customer.findOne({
    _id: req.query.customer,
    company: get(credentials, 'company._id', null),
  }).lean();
  if (!customer) throw Boom.forbidden();
  return null;
};
