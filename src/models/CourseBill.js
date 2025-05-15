const mongoose = require('mongoose');
const get = require('lodash/get');
const { GROUP, TRAINEE } = require('../helpers/constants');
const { validateQuery, validateAggregation, formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const CourseBillSchema = mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  mainFee: {
    price: { type: Number, required: true },
    percentage: { type: Number },
    count: { type: Number, required: true },
    countUnit: { type: String, enum: [GROUP, TRAINEE], required: true },
    description: { type: String },
  },
  companies: { type: [mongoose.Schema.Types.ObjectId], ref: 'Company', required: true },
  payer: {
    type: mongoose.Schema({
      fundingOrganisation: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseFundingOrganisation' },
      company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    }, { _id: false, id: false }),
    required: true,
    validate() { return !!this.payer.company !== !!this.payer.fundingOrganisation; },
  },
  billingPurchaseList: {
    type: [mongoose.Schema({
      billingItem: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseBillingItem', required: true },
      price: { type: Number, required: true },
      percentage: { type: Number },
      count: { type: Number, required: true },
      description: { type: String },
    }
    )],
  },
  billedAt: { type: Date, required() { return !!this.number; } },
  number: { type: String, required() { return !!this.billedAt; } },
  maturityDate: { type: Date },
}, { timestamps: true });

function formatPayer(doc, next) {
  if (get(doc, 'payer.company')) {
    // eslint-disable-next-line no-param-reassign
    doc.payer = doc.payer.company;
    // eslint-disable-next-line no-param-reassign
    doc.isPayerCompany = true;
  }
  if (get(doc, 'payer.fundingOrganisation')) {
    // eslint-disable-next-line no-param-reassign
    doc.payer = doc.payer.fundingOrganisation;
    // eslint-disable-next-line no-param-reassign
    doc.isPayerCompany = false;
  }

  return next();
}

function formatPayers(docs, next) {
  if (this._fields['payer.fundingOrganisation']) return next();

  for (const doc of docs) {
    if (get(doc, 'payer.company')) {
      doc.payer = doc.payer.company;
      doc.isPayerCompany = true;
    }
    if (get(doc, 'payer.fundingOrganisation')) {
      doc.payer = doc.payer.fundingOrganisation;
      doc.isPayerCompany = false;
    }
  }

  return next();
}

CourseBillSchema.virtual('coursePayments', { ref: 'CoursePayment', localField: '_id', foreignField: 'courseBill' });

CourseBillSchema.virtual(
  'courseCreditNote',
  { ref: 'CourseCreditNote', localField: '_id', foreignField: 'courseBill', justOne: true }
);

CourseBillSchema.pre('find', validateQuery);
CourseBillSchema.pre('aggregate', validateAggregation);
queryMiddlewareList.map(middleware => CourseBillSchema.pre(middleware, formatQuery));

CourseBillSchema.post('find', formatPayers);
CourseBillSchema.post('findOne', formatPayer);
CourseBillSchema.post('findOneAndUpdate', formatPayer);

module.exports = mongoose.model('CourseBill', CourseBillSchema);
