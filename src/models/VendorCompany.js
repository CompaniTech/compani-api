const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { SIRET_VALIDATION, IBAN_VALIDATION, BIC_VALIDATION } = require('./utils');
const addressSchemaDefinition = require('./schemaDefinitions/address');

const VendorCompanySchema = mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: mongoose.Schema(addressSchemaDefinition, { _id: false, id: false }), required: true },
  siret: { type: String, validate: SIRET_VALIDATION, required: true, unique: true },
  activityDeclarationNumber: { type: String, required: true, unique: true },
  iban: { type: String, validate: IBAN_VALIDATION, required: true, unique: true },
  bic: { type: String, validate: BIC_VALIDATION, required: true, unique: true },
  billingRepresentative: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shareCapital: { type: Number, required: true },
}, { timestamps: true });

queryMiddlewareList.map(middleware => VendorCompanySchema.pre(middleware, formatQuery));

module.exports = mongoose.model('VendorCompany', VendorCompanySchema);
