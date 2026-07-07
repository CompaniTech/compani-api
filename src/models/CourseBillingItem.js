const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { COURSE, COURSE_BILL } = require('../helpers/constants');

const COURSE_BILLING_ITEM_TYPES = [COURSE, COURSE_BILL];

const CourseBillingItemSchema = mongoose.Schema({
  // unique mongo index on 'name' (with case and diacritics insensitive collation) has been added manually in mep58
  name: { type: String, required: true },
  type: { type: String, enum: COURSE_BILLING_ITEM_TYPES, required: true, immutable: true },
}, { timestamps: true });

CourseBillingItemSchema.virtual('courseBillCount', {
  ref: 'CourseBill',
  localField: '_id',
  foreignField: 'billingPurchaseList.billingItem',
  count: true,
});

CourseBillingItemSchema.virtual('courseCount', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'billingPurchaseList.billingItem',
  count: true,
});

queryMiddlewareList.map(middleware => CourseBillingItemSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('CourseBillingItem', CourseBillingItemSchema);
module.exports.COURSE_BILLING_ITEM_TYPES = COURSE_BILLING_ITEM_TYPES;
