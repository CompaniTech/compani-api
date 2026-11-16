const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const IdentityVerificationSchema = mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

queryMiddlewareList.map(middleware => IdentityVerificationSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('IdentityVerification', IdentityVerificationSchema);
