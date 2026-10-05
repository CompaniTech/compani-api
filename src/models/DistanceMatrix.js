const mongoose = require('mongoose');
const { validateQuery, validateAggregation, formatQuery, formatQueryMiddlewareList } = require('./preHooks/validate');

const DistanceMatrixSchema = mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  origins: { type: String },
  destinations: { type: String },
  mode: { type: String },
  distance: { type: Number },
  duration: { type: Number },
}, {
  timestamps: true,
});

DistanceMatrixSchema.pre('find', validateQuery);
DistanceMatrixSchema.pre('aggregate', validateAggregation);
formatQueryMiddlewareList().map(middleware => DistanceMatrixSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('DistanceMatrix', DistanceMatrixSchema);
