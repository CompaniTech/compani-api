const mongoose = require('mongoose');
const { COMPANI, OGUST } = require('../helpers/constants');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');
const billEventSurchargesSchemaDefinition = require('./schemaDefinitions/billEventSurcharges');
const { SERVICE_NATURES } = require('./Service');
const { validatePayload, validateQuery } = require('./preHooks/validate');

const CREDIT_NOTE_ORIGINS = [COMPANI, OGUST];

const CreditNoteSchema = mongoose.Schema(
  {
    number: String,
    date: { type: Date, required: true },
    startDate: Date,
    endDate: Date,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    thirdPartyPayer: { type: mongoose.Schema.Types.ObjectId, ref: 'ThirdPartyPayer' },
    exclTaxesCustomer: {
      type: Number,
      required() {
        return !this.thirdPartyPayer;
      },
    },
    inclTaxesCustomer: {
      type: Number,
      required() {
        return !this.thirdPartyPayer;
      },
    },
    exclTaxesTpp: {
      type: Number,
      required() {
        return !!this.thirdPartyPayer;
      },
    },
    inclTaxesTpp: {
      type: Number,
      required() {
        return !!this.thirdPartyPayer;
      },
    },
    events: [
      {
        eventId: { type: mongoose.Schema.Types.ObjectId, required: true },
        auxiliary: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        serviceName: { type: String, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        bills: {
          type: mongoose.Schema(
            {
              inclTaxesCustomer: Number,
              exclTaxesCustomer: Number,
              thirdPartyPayer: { type: mongoose.Schema.Types.ObjectId },
              inclTaxesTpp: Number,
              exclTaxesTpp: Number,
              fundingId: { type: mongoose.Schema.Types.ObjectId },
              nature: String,
              careHours: Number,
              surcharges: billEventSurchargesSchemaDefinition,
            },
            { id: false }
          ),
          required: true,
        },
      },
    ],
    subscription: {
      _id: { type: mongoose.Schema.Types.ObjectId },
      service: {
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          required() {
            return !!this.subscription.serviceId;
          },
        },
        nature: {
          type: String,
          enum: SERVICE_NATURES,
          required() {
            return !!this.subscription.serviceId;
          },
        },
        name: {
          type: String,
          required() {
            return !!this.subscription.serviceId;
          },
        },
      },
      vat: Number,
      unitInclTaxes: Number,
    },
    linkedCreditNote: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditNote' },
    origin: { type: String, enum: CREDIT_NOTE_ORIGINS, default: COMPANI },
    driveFile: driveResourceSchemaDefinition,
    company: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

CreditNoteSchema.pre('validate', validatePayload);
CreditNoteSchema.pre('find', validateQuery);

module.exports = mongoose.model('CreditNote', CreditNoteSchema);
module.exports.CREDIT_NOTE_ORIGINS = CREDIT_NOTE_ORIGINS;
