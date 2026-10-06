const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const TrainerBillSchema = mongoose.Schema({
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  number: { type: String, required: true },
  courseSlots: { type: [mongoose.Schema.Types.ObjectId], ref: 'CourseSlot', required: true },
  amount: { type: Number, required: true },
  submittedAt: { type: Date, required: true },
  file: {
    publicId: { type: String },
    link: { type: String, trim: true },
  },
}, { timestamps: true });

TrainerBillSchema.index({ trainer: 1, number: 1 }, { unique: true });

TrainerBillSchema.virtual(
  'payment',
  { ref: 'TrainerPayment', localField: '_id', foreignField: 'trainerBill', justOne: true }
);

queryMiddlewareList.map(middleware => TrainerBillSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('TrainerBill', TrainerBillSchema);
