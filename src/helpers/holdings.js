const CompanyHolding = require('../models/CompanyHolding');
const Holding = require('../models/Holding');

exports.create = async payload => Holding.create(payload);

exports.list = async () => Holding
  .find({}, { _id: 1, name: 1 })
  .populate({ path: 'companies' })
  .lean();

exports.update = async (holdingId, payload) => {
  if (payload.company) return CompanyHolding.create({ holding: holdingId, company: payload.company });

  return null;
};

exports.getById = async holdingId => Holding
  .findOne({ _id: holdingId }, { _id: 1, name: 1 })
  .populate({ path: 'companies', populate: { path: 'company', select: 'name' } })
  .populate({ path: 'users', populate: { path: 'user', select: 'identity local.email contact' } })
  .lean();
