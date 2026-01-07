const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../helpers/encryption');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { SIRET_VALIDATION, IBAN_VALIDATION, BIC_VALIDATION, ICS_VALIDATION } = require('./utils');
const addressSchemaDefinition = require('./schemaDefinitions/address');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');

const VendorCompanySchema = mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: mongoose.Schema(addressSchemaDefinition, { _id: false, id: false }), required: true },
  siret: { type: String, validate: SIRET_VALIDATION, required: true, unique: true },
  activityDeclarationNumber: { type: String, required: true, unique: true },
  iban: { type: String, validate: IBAN_VALIDATION, required: true, unique: true },
  bic: { type: String, validate: BIC_VALIDATION, required: true, unique: true },
  ics: { type: String, validate: ICS_VALIDATION, required: true, unique: true },
  billingRepresentative: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shareCapital: { type: Number, required: true },
  debitMandateTemplate: { type: driveResourceSchemaDefinition, _id: false, id: false },
}, { timestamps: true });

function cryptDatas() {
  const { $set, $unset } = this.getUpdate() || { $set: {}, $unset: {} };
  if (!Object.keys($set).length && !Object.keys($unset).length) return;

  if ($set.iban) $set.iban = encrypt($set.iban);

  if ($set.bic) $set.bic = encrypt($set.bic);

  if ($set.ics) $set.ics = encrypt($set.ics);
}

async function decryptDatas(doc) {
  if (!doc) return;

  // eslint-disable-next-line no-param-reassign
  if (doc.iban && doc.iban.includes(':')) doc.iban = decrypt(doc.iban);
  // eslint-disable-next-line no-param-reassign
  if (doc.bic && doc.bic.includes(':')) doc.bic = decrypt(doc.bic);
  // eslint-disable-next-line no-param-reassign
  if (doc.ics && doc.ics.includes(':')) doc.ics = decrypt(doc.ics);
}

VendorCompanySchema.pre('updateOne', cryptDatas);
VendorCompanySchema.post('findOne', decryptDatas);

queryMiddlewareList.map(middleware => VendorCompanySchema.pre(middleware, formatQuery));

module.exports = mongoose.model('VendorCompany', VendorCompanySchema);
