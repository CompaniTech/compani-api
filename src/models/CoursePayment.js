const mongoose = require('mongoose');
const { validateQuery, validateAggregation, formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { PAYMENT_NATURES, PAYMENT_TYPES } = require('./Payment');
const { CESU, PENDING, RECEIVED, XML_GENERATED } = require('../helpers/constants');

const COURSE_PAYMENT_TYPES = PAYMENT_TYPES.filter(type => type !== CESU);
const COURSE_PAYMENT_STATUS = [PENDING, RECEIVED, XML_GENERATED];

const CoursePaymentSchema = mongoose.Schema({
  number: { type: String, unique: true, immutable: true },
  date: { type: Date, default: Date.now },
  companies: { type: [mongoose.Schema.Types.ObjectId], ref: 'Company', required: true, immutable: true },
  courseBill: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseBill' },
  netInclTaxes: { type: Number },
  nature: { type: String, enum: PAYMENT_NATURES, immutable: true },
  type: { type: String, enum: COURSE_PAYMENT_TYPES },
  status: { type: String, enum: COURSE_PAYMENT_STATUS, required: true },
}, { timestamps: true });

CoursePaymentSchema.virtual(
  'xmlSEPAFileInfos',
  { ref: 'XmlSEPAFileInfos', localField: '_id', foreignField: 'coursePayments', justOne: true }
);

CoursePaymentSchema.pre('find', validateQuery);
CoursePaymentSchema.pre('aggregate', validateAggregation);
queryMiddlewareList.map(middleware => CoursePaymentSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('CoursePayment', CoursePaymentSchema);
module.exports.COURSE_PAYMENT_TYPES = COURSE_PAYMENT_TYPES;
module.exports.COURSE_PAYMENT_STATUS = COURSE_PAYMENT_STATUS;
