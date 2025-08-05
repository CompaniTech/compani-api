const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const CourseBillingItemSchema = mongoose.Schema({
  // unique mongo index on 'name' (with case and diacritics insensitive collation) has been added manually in mep58
  name: { type: String, required: true },
}, { timestamps: true });

CourseBillingItemSchema.virtual('courseBillCount', {
  ref: 'CourseBill',
  localField: '_id',
  foreignfield: 'billingPurchaseList.billingItem',
  count: true,
});

queryMiddlewareList.map(middleware => CourseBillingItemSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('CourseBillingItem', CourseBillingItemSchema);
