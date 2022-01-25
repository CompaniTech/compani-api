const mongoose = require('mongoose');
const { validateQuery, validateAggregation, formatQuery, formatQueryMiddlewareList } = require('./preHooks/validate');

const FundingHistorySchema = mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  fundingId: { type: mongoose.Schema.Types.ObjectId },
  amountTTC: { type: Number, default: 0 },
  careHours: { type: Number, default: 0 },
  month: String,
  nature: String,
}, { timestamps: true });

FundingHistorySchema.pre('aggregate', validateAggregation);
FundingHistorySchema.pre('find', validateQuery);
formatQueryMiddlewareList().map(middleware => FundingHistorySchema.pre(middleware, formatQuery));

module.exports = mongoose.model('FundingHistory', FundingHistorySchema);
