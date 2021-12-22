const mongoose = require('mongoose');
const { validateAggregation, validateQuery, formatQuery } = require('./preHooks/validate');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');

const YEAR_VALIDATION = /^[2]{1}[0]{1}[0-9]{2}$/;

const TaxCertificateSchema = mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  year: { type: String, required: true, validate: YEAR_VALIDATION },
  date: { type: Date, default: Date.now },
  driveFile: driveResourceSchemaDefinition,
}, { timestamps: true });

TaxCertificateSchema.pre('find', validateQuery);
TaxCertificateSchema.pre('countDocuments', formatQuery);
TaxCertificateSchema.pre('find', formatQuery);
TaxCertificateSchema.pre('findOne', formatQuery);
TaxCertificateSchema.pre('aggregate', validateAggregation);

module.exports = mongoose.model('TaxCertificate', TaxCertificateSchema);
module.exports.YEAR_VALIDATION = YEAR_VALIDATION;
