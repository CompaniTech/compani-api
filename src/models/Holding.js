const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const HoldingSchema = mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: String },
}, { timestamps: true });

function populateCompany(doc) {
  if (!doc) return;

  // eslint-disable-next-line no-param-reassign
  doc.companies = doc.companies.map(c => c.company);
}

function populateCompanies(docs) {
  for (const doc of docs) {
    if (doc && doc.companies) {
      doc.companies = doc.companies.map(c => c.company);
    }
  }
}

function populateUser(doc) {
  if (!doc) return;

  // eslint-disable-next-line no-param-reassign
  doc.users = doc.users.map(u => u.user);
}

function populateUsers(docs) {
  for (const doc of docs) {
    if (doc && doc.users) {
      doc.users = doc.users.map(u => u.user);
    }
  }
}

HoldingSchema.virtual('companies', { ref: 'CompanyHolding', localField: '_id', foreignField: 'holding' });

HoldingSchema.virtual('users', { ref: 'UserHolding', localField: '_id', foreignField: 'holding' });

queryMiddlewareList.map(middleware => HoldingSchema.pre(middleware, formatQuery));

HoldingSchema.post('find', populateCompanies);
HoldingSchema.post('findOne', populateCompany);
HoldingSchema.post('findOneAndUpdate', populateCompany);
HoldingSchema.post('find', populateUsers);
HoldingSchema.post('findOne', populateUser);
HoldingSchema.post('findOneAndUpdate', populateUser);

module.exports = mongoose.model('Holding', HoldingSchema);
