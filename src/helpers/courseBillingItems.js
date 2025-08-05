const has = require('lodash/has');
const CourseBillingItem = require('../models/CourseBillingItem');

exports.list = async credentials => CourseBillingItem
  .find()
  .populate({ path: 'courseBillCount', options: { isVendorUser: has(credentials, 'role.vendor') } })
  .lean({ virtuals: true });

exports.create = async payload => CourseBillingItem.create(payload);

exports.remove = async params => CourseBillingItem.deleteOne(params);
