const mongoose = require('mongoose');
const { formatQuery } = require('./preHooks/validate');

const UserCompanySchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, immutable: true },
}, { timestamps: true });

UserCompanySchema.pre('countDocuments', formatQuery);
UserCompanySchema.pre('find', formatQuery);
UserCompanySchema.pre('findOne', formatQuery);

module.exports = mongoose.model('UserCompany', UserCompanySchema);
