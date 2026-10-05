const mongoose = require('mongoose');
const { validateQuery, validateAggregation, formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const TrainingContractSchema = mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  file: {
    publicId: { type: String, required: true },
    link: { type: String, trim: true, required: true },
  },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  startDate: { type: Date },
}, { timestamps: true });

TrainingContractSchema.pre('find', validateQuery);
TrainingContractSchema.pre('aggregate', validateAggregation);
queryMiddlewareList.map(middleware => TrainingContractSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('TrainingContract', TrainingContractSchema);
