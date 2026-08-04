const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { INVOICED, PAID } = require('../helpers/constants');

const TrainerBillSchema = mongoose.Schema({
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  number: { type: String, required: true },
  status: { type: String, enum: [INVOICED, PAID], required: true },
  courseSlots: { type: [mongoose.Schema.Types.ObjectId], ref: 'CourseSlot', required: true },
  amount: { type: Number, required: true },
  submittedAt: { type: Date, required: true },
}, { timestamps: true });

TrainerBillSchema.index({ trainer: 1, number: 1 }, { unique: true });

queryMiddlewareList.map(middleware => TrainerBillSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('TrainerBill', TrainerBillSchema);
