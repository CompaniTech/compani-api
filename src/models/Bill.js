const mongoose = require('mongoose');
const ServiceSchema = require('./Service').schema;
const { billEventSurchargesSchemaDefinition, billingItemSchemaDefinition } = require('./schemaDefinitions/billing');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');
const { validateQuery, validateAggregation } = require('./preHooks/validate');
const { COMPANI, THIRD_PARTY, OGUST, AUTOMATIC, MANUAL } = require('../helpers/constants');
const { minLength } = require('./validations/utils');

const BILL_ORIGINS = [COMPANI, THIRD_PARTY, OGUST];
const BILL_TYPES = [AUTOMATIC, MANUAL];

const BillSchema = mongoose.Schema({
  number: { type: String, unique: true, partialFilterExpression: { number: { $exists: true, $type: 2 } } },
  date: { type: Date, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  thirdPartyPayer: { type: mongoose.Schema.Types.ObjectId, ref: 'ThirdPartyPayer' },
  subscriptions: [{
    startDate: { type: Date, required() { return this.type === AUTOMATIC; } },
    endDate: { type: Date, required() { return this.type === AUTOMATIC; } },
    subscription: { type: mongoose.Schema.Types.ObjectId, required() { return this.type === AUTOMATIC; } },
    service: {
      serviceId: { type: mongoose.Schema.Types.ObjectId, required() { return this.type === AUTOMATIC; } },
      name: String,
      nature: ServiceSchema.path('nature'),
    },
    vat: { type: Number, default: 0 },
    events: [{
      eventId: { type: mongoose.Schema.Types.ObjectId, required() { return this.type === AUTOMATIC; } },
      auxiliary: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required() { return this.type === AUTOMATIC; } },
      startDate: { type: Date, required() { return this.type === AUTOMATIC; } },
      endDate: { type: Date, required() { return this.type === AUTOMATIC; } },
      surcharges: billEventSurchargesSchemaDefinition,
      fundingId: { type: mongoose.Schema.Types.ObjectId },
      exclTaxesCustomer: { type: Number, required() { return !this.fundingId; } },
      inclTaxesCustomer: { type: Number, required() { return !this.fundingId; } },
      exclTaxesTpp: { type: Number, required() { return this.fundingId; } },
      inclTaxesTpp: { type: Number, required() { return this.fundingId; } },
      careHours: { type: Number },
    }],
    hours: { type: Number, required() { return this.type === AUTOMATIC; } },
    unitInclTaxes: { type: Number, required() { return this.type === AUTOMATIC; } },
    exclTaxes: { type: Number, required() { return this.type === AUTOMATIC; } },
    inclTaxes: { type: Number, required() { return this.type === AUTOMATIC; } },
    discount: Number,
  }],
  origin: { type: String, enum: BILL_ORIGINS, default: COMPANI },
  netInclTaxes: { type: Number, required: true },
  driveFile: driveResourceSchemaDefinition,
  sentAt: Date,
  shouldBeSent: { type: Boolean, default: false },
  type: { type: String, enum: BILL_TYPES, required: true, immutable: true },
  billingItemList: {
    type: [billingItemSchemaDefinition],
    required() { return this.type === MANUAL; },
    default: undefined,
    validate(val) { return this.type !== MANUAL || minLength(val, 1); },
  },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
}, { timestamps: true });

BillSchema.pre('find', validateQuery);
BillSchema.pre('aggregate', validateAggregation);

module.exports = mongoose.model('Bill', BillSchema);
module.exports.BILL_ORIGINS = BILL_ORIGINS;
module.exports.BILL_TYPES = BILL_TYPES;
