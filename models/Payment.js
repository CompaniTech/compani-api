const mongoose = require('mongoose');

const { PAYMENT, REFUND, PAYMENT_TYPES } = require('../helpers/constants');

const PaymentSchema = mongoose.Schema({
  number: String,
  date: { type: Date, default: Date.now },
  customer: mongoose.Schema.Types.ObjectId,
  client: mongoose.Schema.Types.ObjectId,
  netInclTaxes: Number,
  nature: { type: String, enum: [REFUND, PAYMENT] },
  type: { type: String, enum: PAYMENT_TYPES },

}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
