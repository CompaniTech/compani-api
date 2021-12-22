const mongoose = require('mongoose');
const { JOBS } = require('../helpers/constants');
const { validateQuery, validateAggregation, formatQuery } = require('./preHooks/validate');

const JOBS_ENUM = [...JOBS, ''];

const PartnerSchema = mongoose.Schema({
  identity: {
    type: mongoose.Schema(
      { firstname: { type: String }, lastname: { type: String, required: true } },
      { _id: false, id: false }
    ),
  },
  email: { type: String },
  phone: { type: String },
  job: { type: String, enum: JOBS_ENUM },
  partnerOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerOrganization', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
}, { timestamps: true });

PartnerSchema.virtual('customerPartners', { ref: 'CustomerPartner', localField: '_id', foreignField: 'partner' });

PartnerSchema.pre('find', validateQuery);
PartnerSchema.pre('countDocuments', formatQuery);
PartnerSchema.pre('find', formatQuery);
PartnerSchema.pre('findOne', formatQuery);
PartnerSchema.pre('aggregate', validateAggregation);

module.exports = mongoose.model('Partner', PartnerSchema);
