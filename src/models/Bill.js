const mongoose = require('mongoose');
const ServiceSchema = require('./Service').schema;
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');
const { COMPANI, THIRD_PARTY, OGUST } = require('../helpers/constants');
const billEventSurchargesSchemaDefinition = require('./schemaDefinitions/billEventSurcharges');
const { validatePayload, validateQuery, validateAggregation } = require('./preHooks/validate');

const BILL_ORIGINS = [COMPANI, THIRD_PARTY, OGUST];

const BillSchema = mongoose.Schema({
  number: { type: String },
  date: { type: Date, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'ThirdPartyPayer' },
  subscriptions: [{
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, required: true },
    service: {
      serviceId: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: String,
      nature: ServiceSchema.path('nature'),
    },
    vat: { type: Number, default: 0 },
    events: [{
      eventId: { type: mongoose.Schema.Types.ObjectId, required: true },
      auxiliary: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      surcharges: billEventSurchargesSchemaDefinition,
    }],
    hours: { type: Number, required: true },
    unitInclTaxes: { type: Number, required: true },
    exclTaxes: { type: Number, required: true },
    inclTaxes: { type: Number, required: true },
    discount: Number,
  }],
  origin: { type: String, enum: BILL_ORIGINS, default: COMPANI },
  netInclTaxes: { type: Number, required: true },
  driveFile: driveResourceSchemaDefinition,
  sentAt: Date,
  shouldBeSent: { type: Boolean, default: false },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
}, { timestamps: true });

BillSchema.pre('validate', validatePayload);
BillSchema.pre('find', validateQuery);
BillSchema.pre('aggregate', validateAggregation);

module.exports = mongoose.model('Bill', BillSchema);
module.exports.BILL_ORIGINS = BILL_ORIGINS;
