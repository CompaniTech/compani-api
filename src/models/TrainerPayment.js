const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { PENDING, XML_GENERATED, PAID } = require('../helpers/constants');

const TRAINER_PAYMENT_STATUS = [PENDING, XML_GENERATED, PAID];

const TrainerPaymentSchema = mongoose.Schema({
  number: { type: String, required: true, unique: true, immutable: true },
  trainerBill: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainerBill', required: true, unique: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: TRAINER_PAYMENT_STATUS, required: true },
}, { timestamps: true });

queryMiddlewareList.map(middleware => TrainerPaymentSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('TrainerPayment', TrainerPaymentSchema);
module.exports.TRAINER_PAYMENT_STATUS = TRAINER_PAYMENT_STATUS;
