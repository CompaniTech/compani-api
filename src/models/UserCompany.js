const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { DAY } = require('../helpers/constants');

const UserCompanySchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, immutable: true },
  startDate: { type: Date, default: () => CompaniDate().startOf(DAY).toISO() },
  endDate: { type: Date },
}, { timestamps: true });

queryMiddlewareList.map(middleware => UserCompanySchema.pre(middleware, formatQuery));

module.exports = mongoose.model('UserCompany', UserCompanySchema);
