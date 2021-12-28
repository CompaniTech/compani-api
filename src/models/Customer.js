const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const Boom = require('@hapi/boom');
const get = require('lodash/get');
const has = require('lodash/has');
const moment = require('../extensions/moment');
const { validateQuery, validateAggregation, formatQuery } = require('./preHooks/validate');
const {
  MONTHLY,
  ONCE,
  HOURLY,
  FIXED,
  UNKNOWN,
  HOME,
  NURSING_HOME,
  HOSPITALIZED,
  DECEASED,
  QUALITY,
  HOSPITALIZATION,
  DEATH,
  EPHAD_DEPARTURE,
  CONDITION_IMPROVEMENT,
  OTHER,
} = require('../helpers/constants');
const Event = require('./Event');
const { PHONE_VALIDATION } = require('./utils');
const addressSchemaDefinition = require('./schemaDefinitions/address');
const { identitySchemaDefinition } = require('./schemaDefinitions/identity');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');
const subscriptionSchemaDefinition = require('./schemaDefinitions/subscription');
const Repetition = require('./Repetition');

const FUNDING_FREQUENCIES = [MONTHLY, ONCE];
const FUNDING_NATURES = [FIXED, HOURLY];
const SITUATION_OPTIONS = [UNKNOWN, HOME, NURSING_HOME, HOSPITALIZED, DECEASED];
const STOP_REASONS = [QUALITY, HOSPITALIZATION, DEATH, EPHAD_DEPARTURE, CONDITION_IMPROVEMENT, OTHER];

const CustomerSchema = mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  serialNumber: { type: String, immutable: true, required: true, unique: true },
  driveFolder: driveResourceSchemaDefinition,
  identity: {
    type: mongoose.Schema(identitySchemaDefinition, { _id: false, id: false }),
    required: true,
  },
  contact: {
    primaryAddress: {
      type: mongoose.Schema(addressSchemaDefinition, { _id: false, id: false }),
      required: true,
    },
    secondaryAddress: { type: mongoose.Schema(addressSchemaDefinition, { _id: false, id: false }) },
    phone: { type: String, validate: PHONE_VALIDATION },
    accessCodes: { type: String },
    others: { type: String },
  },
  followUp: {
    situation: { type: String, enum: SITUATION_OPTIONS, default: UNKNOWN },
    environment: { type: String },
    objectives: { type: String },
    misc: { type: String },
  },
  payment: {
    bankAccountOwner: { type: String },
    iban: { type: String },
    bic: { type: String },
    mandates: [{
      rum: { type: String },
      everSignId: { type: String },
      drive: driveResourceSchemaDefinition,
      signedAt: { type: Date },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  financialCertificates: [driveResourceSchemaDefinition],
  subscriptions: [{
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    versions: [{
      ...subscriptionSchemaDefinition,
      createdAt: { type: Date, default: Date.now },
    }],
    createdAt: { type: Date, default: Date.now },
  }],
  subscriptionsHistory: [{
    subscriptions: [{
      ...subscriptionSchemaDefinition,
      subscriptionId: { type: mongoose.Schema.Types.ObjectId },
      service: { type: String },
      startDate: { type: Date },
    }],
    helper: {
      firstname: { type: String },
      lastname: { type: String },
      title: { type: String },
    },
    approvalDate: { type: Date, default: Date.now },
  }],
  quotes: [{
    quoteNumber: { type: String },
    subscriptions: [{
      ...subscriptionSchemaDefinition,
      service: {
        name: { type: String, required: true },
        nature: { type: String, required: true },
        surcharge: { evening: Number, sunday: Number },
      },
    }],
    drive: driveResourceSchemaDefinition,
    createdAt: { type: Date, default: Date.now },
  }],
  fundings: [{
    nature: { type: String, enum: FUNDING_NATURES },
    subscription: { type: mongoose.Schema.Types.ObjectId },
    thirdPartyPayer: { type: mongoose.Schema.Types.ObjectId, ref: 'ThirdPartyPayer' },
    frequency: { type: String, enum: FUNDING_FREQUENCIES },
    versions: [{
      amountTTC: { type: Number },
      unitTTCRate: { type: Number },
      careHours: { type: Number },
      careDays: [{ type: Number }],
      customerParticipationRate: { type: Number },
      folderNumber: { type: String },
      fundingPlanId: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      createdAt: { type: Date, default: Date.now },
    }],
  }],
  stoppedAt: { type: Date },
  archivedAt: { type: Date },
  stopReason: { type: String, enum: STOP_REASONS, required() { return this.stoppedAt; } },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

const countSubscriptionUsage = async (doc) => {
  if (doc && doc.subscriptions && doc.subscriptions.length > 0) {
    for (const subscription of doc.subscriptions) {
      subscription.eventCount = await Event.countDocuments({ subscription: subscription._id, company: doc.company });
      subscription.repetitionCount = await Repetition
        .countDocuments({ subscription: subscription._id, company: doc.company });
    }
  }
};

function validateAddress(next) {
  const { $set, $unset } = this.getUpdate();
  const setPrimaryAddressToNull = has($set, 'contact.primaryAddress') &&
    (!get($set, 'contact.primaryAddress') || !get($set, 'contact.primaryAddress.fullAddress'));
  const unsetPrimaryAddress = has($unset, 'contact.primaryAddress') ||
    has($unset, 'contact.primaryAddress.fullAddress');
  if (setPrimaryAddressToNull || unsetPrimaryAddress) throw Boom.badRequest('PrimaryAddress is required');

  next();
}

function populateReferent(doc, next) {
  const referentEndDate = get(doc, 'referent.endDate');
  if (referentEndDate && moment().isAfter(referentEndDate)) {
    // eslint-disable-next-line no-param-reassign
    delete doc.referent;
    return next();
  }

  // eslint-disable-next-line no-param-reassign
  if (get(doc, 'referent.auxiliary')) doc.referent = doc.referent.auxiliary;

  return next();
}

function populateReferents(docs, next) {
  for (const doc of docs) {
    if (doc && doc.referent) {
      doc.referent = doc.referent.auxiliary;
    }
  }

  return next();
}

function populateHelpersForList(docs, next) {
  for (const doc of docs) {
    if (doc && doc.helpers) doc.helpers = doc.helpers.map(h => h.user);
  }

  return next();
}

function populateHelpers(doc, next) {
  // eslint-disable-next-line no-param-reassign
  if (doc && doc.helpers) doc.helpers = doc.helpers.map(h => h.user);

  return next();
}

const setSerialNumber = (customer) => {
  const createdAt = moment(customer.createdAt).format('YYMMDD');
  const timestamp = moment(customer.createdAt).valueOf().toString();
  const lastname = customer.identity.lastname.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase();
  const firstname = customer.identity.firstname
    ? customer.identity.firstname.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase()
    : '';

  return `${lastname}${firstname}${createdAt}${timestamp.slice(-8)}`;
};

async function validate(next) {
  try {
    if (this.isNew) this.serialNumber = setSerialNumber(this);

    return next();
  } catch (e) {
    return next(e);
  }
}

CustomerSchema.virtual(
  'firstIntervention',
  { ref: 'Event', localField: '_id', foreignField: 'customer', justOne: true, options: { sort: { startDate: 1 } } }
);

CustomerSchema.virtual(
  'referent',
  {
    ref: 'ReferentHistory',
    localField: '_id',
    foreignField: 'customer',
    justOne: true,
    options: { sort: { startDate: -1 } },
  }
);

CustomerSchema.virtual(
  'referentHistories',
  { ref: 'ReferentHistory', localField: '_id', foreignField: 'customer', options: { sort: { startDate: -1 } } }
);

CustomerSchema.virtual('helpers', { ref: 'Helper', localField: '_id', foreignField: 'customer' });

CustomerSchema.pre('validate', validate);
CustomerSchema.pre('aggregate', validateAggregation);
CustomerSchema.pre('find', validateQuery);
CustomerSchema.pre('countDocuments', formatQuery);
CustomerSchema.pre('find', formatQuery);
CustomerSchema.pre('findOne', formatQuery);
CustomerSchema.pre('findOneAndUpdate', validateAddress);
CustomerSchema.post('findOne', countSubscriptionUsage);

CustomerSchema.post('findOne', populateHelpers);
CustomerSchema.post('findOneAndUpdate', populateHelpers);
CustomerSchema.post('find', populateHelpersForList);

CustomerSchema.post('findOne', populateReferent);
CustomerSchema.post('findOneAndUpdate', populateReferent);
CustomerSchema.post('find', populateReferents);

CustomerSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('Customer', CustomerSchema);
module.exports.FUNDING_FREQUENCIES = FUNDING_FREQUENCIES;
module.exports.FUNDING_NATURES = FUNDING_NATURES;
module.exports.SITUATION_OPTIONS = SITUATION_OPTIONS;
module.exports.STOP_REASONS = STOP_REASONS;
