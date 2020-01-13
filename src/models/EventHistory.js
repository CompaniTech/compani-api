const mongoose = require('mongoose');
const { EVENT_TYPES, ABSENCE_TYPES } = require('./Event');
const {
  EVENT_CREATION,
  EVENT_DELETION,
  EVENT_UPDATE,
  REPETITION_FREQUENCIES,
  EVENT_CANCELLATION_CONDITIONS,
  EVENT_CANCELLATION_REASONS,
} = require('../helpers/constants');
const addressSchemaDefinition = require('./schemaDefinitions/address');
const { validateQuery, validatePayload, validateAggregation } = require('./preHooks/validate');

const EVENTS_HISTORY_ACTIONS = [EVENT_CREATION, EVENT_DELETION, EVENT_UPDATE];

const EventHistorySchema = mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, enum: EVENTS_HISTORY_ACTIONS },
  update: {
    auxiliary: {
      from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    startDate: {
      from: Date,
      to: Date,
    },
    endDate: {
      from: Date,
      to: Date,
    },
    startHour: {
      from: Date,
      to: Date,
    },
    endHour: {
      from: Date,
      to: Date,
    },
    cancel: {
      condition: { type: String, enum: EVENT_CANCELLATION_CONDITIONS },
      reason: { type: String, enum: EVENT_CANCELLATION_REASONS },
    },
  },
  event: {
    type: { type: String, enum: EVENT_TYPES },
    startDate: Date,
    endDate: Date,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    auxiliary: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    absence: { type: String, enum: ABSENCE_TYPES },
    internalHour: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalHour' },
    address: { type: mongoose.Schema(addressSchemaDefinition, { _id: false }) },
    misc: { type: String },
    repetition: {
      frequency: { type: String, enum: REPETITION_FREQUENCIES },
    },
  },
  auxiliaries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  sectors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sector' }],
}, { timestamps: true });

EventHistorySchema.pre('validate', validatePayload);
EventHistorySchema.pre('find', validateQuery);
EventHistorySchema.pre('aggregate', validateAggregation);

module.exports = mongoose.model('EventHistory', EventHistorySchema);
