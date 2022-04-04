const mongoose = require('mongoose');
const { formatQuery, formatQueryMiddlewareList } = require('./preHooks/validate');
const { SIRET_VALIDATION } = require('./utils');
const addressSchemaDefinition = require('./schemaDefinitions/address');

const VendorCompanySchema = mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: mongoose.Schema(addressSchemaDefinition, { _id: false, id: false }), required: true },
  siret: { type: String, validate: SIRET_VALIDATION, required: true, unique: true },
}, { timestamps: true });

formatQueryMiddlewareList().map(middleware => VendorCompanySchema.pre(middleware, formatQuery));

module.exports = mongoose.model('VendorCompany', VendorCompanySchema);
