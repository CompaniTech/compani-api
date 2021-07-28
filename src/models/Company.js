const mongoose = require('mongoose');

const { MONTH, TWO_WEEKS, COMPANY, ASSOCIATION } = require('../helpers/constants');
const addressSchemaDefinition = require('./schemaDefinitions/address');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');

const COMPANY_BILLING_PERIODS = [MONTH, TWO_WEEKS];
const COMPANY_TYPES = [COMPANY, ASSOCIATION];
const TRADE_NAME_REGEX = /^[0-9a-zA-Z]{0,11}$/;
const APE_CODE_REGEX = /^\d{3,4}[A-Z]$/;

const CompanySchema = mongoose.Schema({
  name: { type: String, unique: true, required: true },
  tradeName: { type: String, maxLength: 11, validate: TRADE_NAME_REGEX },
  prefixNumber: { type: Number, required: true, unique: true },
  address: { type: mongoose.Schema(addressSchemaDefinition, { _id: false, id: false }) },
  subscriptions: { erp: { type: Boolean, default: false } },
  rcs: { type: String },
  rna: { type: String },
  ics: { type: String },
  iban: { type: String },
  bic: { type: String },
  billingAssistance: { type: String, lowercase: true, trim: true },
  logo: { type: String },
  apeCode: { type: String, validate: APE_CODE_REGEX },
  legalRepresentative: {
    lastname: { type: String },
    firstname: { type: String },
    position: { type: String },
  },
  type: { type: String, enum: COMPANY_TYPES, default: COMPANY },
  folderId: { type: String, required: true },
  directDebitsFolderId: { type: String, required: true },
  customersFolderId: { type: String, required: true },
  auxiliariesFolderId: { type: String, required: true },
  rhConfig: {
    grossHourlyRate: { type: Number, default: 0 },
    phoneFeeAmount: Number,
    amountPerKm: Number,
    transportSubs: [{
      department: String,
      price: Number,
    }],
    templates: {
      contract: driveResourceSchemaDefinition,
      contractVersion: driveResourceSchemaDefinition,
    },
  },
  customersConfig: {
    billingPeriod: { type: String, enum: COMPANY_BILLING_PERIODS, default: TWO_WEEKS },
    templates: {
      folderId: String,
      debitMandate: driveResourceSchemaDefinition,
      quote: driveResourceSchemaDefinition,
      gcs: driveResourceSchemaDefinition,
    },
  },
}, { timestamps: true });

module.exports = mongoose.model('Company', CompanySchema);
module.exports.COMPANY_BILLING_PERIODS = COMPANY_BILLING_PERIODS;
module.exports.COMPANY_TYPES = COMPANY_TYPES;
module.exports.TRADE_NAME_REGEX = TRADE_NAME_REGEX;
module.exports.APE_CODE_REGEX = APE_CODE_REGEX;
