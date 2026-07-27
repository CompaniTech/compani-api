const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { INVOICED, PAID } = require('../helpers/constants');

const TrainerInvoiceSchema = mongoose.Schema({
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  number: { type: String, required: true },
  status: { type: String, enum: [INVOICED, PAID], required: true },
  courseSlots: { type: [mongoose.Schema.Types.ObjectId], ref: 'CourseSlot', required: true },
  amount: { type: Number, required: true },
  submittedAt: { type: Date, required: true },
}, { timestamps: true });

TrainerInvoiceSchema.index({ trainer: 1, number: 1 }, { unique: true });

queryMiddlewareList.map(middleware => TrainerInvoiceSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('TrainerInvoice', TrainerInvoiceSchema);
