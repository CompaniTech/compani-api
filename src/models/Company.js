const mongoose = require('mongoose');
const { MONTH, TWO_WEEKS, COMPANY, ASSOCIATION } = require('../helpers/constants');
const { encrypt, decrypt } = require('../helpers/encryption');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const addressSchemaDefinition = require('./schemaDefinitions/address');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');

const COMPANY_BILLING_PERIODS = [MONTH, TWO_WEEKS];
const COMPANY_TYPES = [COMPANY, ASSOCIATION];
const TRADE_NAME_REGEX = /^[0-9a-zA-Z]{0,11}$/;
const APE_CODE_REGEX = /^\d{3,4}[A-Z]$/;

const CompanySchema = mongoose.Schema({
  // unique mongo index on 'name' (with case and diacritics insensitive collation) has been added manually in mep58
  name: { type: String, required: true },
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
  billingRepresentative: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: COMPANY_TYPES },
  folderId: { type: String, required: true },
  directDebitsFolderId: { type: String, required: true },
  customersFolderId: { type: String, required: true },
  auxiliariesFolderId: { type: String, required: true },
  rhConfig: {
    grossHourlyRate: { type: Number, default: 0 },
    phoneFeeAmount: { type: Number },
    amountPerKm: { type: Number },
    transportSubs: [{
      department: { type: String },
      price: { type: Number },
    }],
    templates: {
      contract: driveResourceSchemaDefinition,
      contractVersion: driveResourceSchemaDefinition,
    },
    shouldPayHolidays: { type: Boolean, default: false },
  },
  customersConfig: {
    billingPeriod: { type: String, enum: COMPANY_BILLING_PERIODS, default: TWO_WEEKS },
    billFooter: { type: String },
    templates: {
      folderId: { type: String },
      debitMandate: driveResourceSchemaDefinition,
      quote: driveResourceSchemaDefinition,
      gcs: driveResourceSchemaDefinition,
    },
  },
  salesRepresentative: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

function populateHolding(doc, next) {
  if (!doc) next();
  // eslint-disable-next-line no-param-reassign
  doc.holding = doc.holding && doc.holding.holding;

  return next();
}

function populateHoldings(docs, next) {
  for (const doc of docs) {
    if (doc && doc.holding) {
      doc.holding = doc.holding.holding;
    }
  }

  return next();
}

function cryptDatas(next) {
  const { $set, $unset } = this.getUpdate() || { $set: {}, $unset: {} };
  if (!Object.keys($set).length && !Object.keys($unset).length) return next();

  if ($set.iban) $set.iban = encrypt($set.iban);

  return next();
}

async function decryptDatas(doc) {
  if (!doc) return;

  // eslint-disable-next-line no-param-reassign
  if (doc.iban && doc.iban.includes(':')) doc.iban = decrypt(doc.iban);
}

CompanySchema.virtual('holding', { ref: 'CompanyHolding', localField: '_id', foreignField: 'company', justOne: true });
CompanySchema.pre('findOneAndUpdate', cryptDatas);

queryMiddlewareList.map(middleware => CompanySchema.pre(middleware, formatQuery));

CompanySchema.post('find', populateHoldings);
CompanySchema.post('findOne', populateHolding);
CompanySchema.post('findOneAndUpdate', populateHolding);
CompanySchema.post('findOne', decryptDatas);

module.exports = mongoose.model('Company', CompanySchema);
module.exports.COMPANY_BILLING_PERIODS = COMPANY_BILLING_PERIODS;
module.exports.COMPANY_TYPES = COMPANY_TYPES;
module.exports.TRADE_NAME_REGEX = TRADE_NAME_REGEX;
module.exports.APE_CODE_REGEX = APE_CODE_REGEX;
