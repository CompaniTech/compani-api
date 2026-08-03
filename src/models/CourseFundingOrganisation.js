const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const CourseFundingOrganisationSchema = mongoose.Schema({
  // unique mongo index on 'name' (with case and diacritics insensitive collation) has been added manually in mep58
  name: { type: String, required: true },
  address: { type: String, required: true },
  billingInfos: { type: String },
}, { timestamps: true });

CourseFundingOrganisationSchema.virtual('courseBillCount', {
  ref: 'CourseBill',
  localField: '_id',
  foreignField: 'payer.fundingOrganisation',
  count: true,
});

queryMiddlewareList.map(middleware => CourseFundingOrganisationSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('CourseFundingOrganisation', CourseFundingOrganisationSchema);
