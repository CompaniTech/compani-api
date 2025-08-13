const flat = require('flat');
const { omit } = require('lodash');
const Company = require('../models/Company');
const CompanyHolding = require('../models/CompanyHolding');
const GDriveStorageHelper = require('./gDriveStorage');
const HoldingHelper = require('./holdings');
const { DIRECTORY } = require('./constants');
const { formatRumNumber } = require('./utils');
const { CompaniDate } = require('./dates/companiDates');

exports.createCompany = async (companyPayload) => {
  const companyFolder = await GDriveStorageHelper.createFolderForCompany(companyPayload.name);
  const [directDebitsFolder, customersFolder, auxiliariesFolder] = await Promise.all([
    GDriveStorageHelper.createFolder('direct debits', companyFolder.id),
    GDriveStorageHelper.createFolder('customers', companyFolder.id),
    GDriveStorageHelper.createFolder('auxiliaries', companyFolder.id),
  ]);
  const lastCompany = await Company.find().sort({ prefixNumber: -1 }).limit(1).lean();

  const prefixNumber = lastCompany[0].prefixNumber + 1;
  const date = CompaniDate().format('yyyyMM').slice(2);
  const rum = formatRumNumber(prefixNumber, date, 1);

  const company = await Company.create({
    ...omit(companyPayload, 'holding'),
    prefixNumber,
    directDebitsFolderId: directDebitsFolder.id,
    folderId: companyFolder.id,
    customersFolderId: customersFolder.id,
    auxiliariesFolderId: auxiliariesFolder.id,
    debitMandates: [{ rum }],
  });

  if (companyPayload.holding) {
    await HoldingHelper.update(companyPayload.holding, { companies: [company._id] });
  }

  return company;
};

exports.list = async (query) => {
  if (query.holding) {
    const companyHoldingList = await CompanyHolding
      .find({ holding: query.holding }, { company: 1 })
      .populate({
        path: 'company',
        select: 'name',
        populate: { path: 'billingRepresentative', select: '_id picture contact identity local' },
      })
      .lean();

    return companyHoldingList.map(ch => ch.company);
  }

  let linkedCompanyList = [];
  if (query.withoutHoldingCompanies) {
    const companyHoldings = await CompanyHolding.find({}, { company: 1 }).lean();
    linkedCompanyList = companyHoldings.map(ch => ch.company);
  }

  return query.action === DIRECTORY
    ? Company
      .find({ _id: { $nin: linkedCompanyList } }, { name: 1, salesRepresentative: 1 })
      .populate({ path: 'holding', populate: { path: 'holding', select: 'name' } })
      .lean()
    : Company.find({ _id: { $nin: linkedCompanyList } }, { name: 1, salesRepresentative: 1 }).lean();
};

exports.updateCompany = async (companyId, payload) =>
  Company.findOneAndUpdate({ _id: companyId }, { $set: flat(payload) }, { new: true });

exports.getCompany = async companyId => Company
  .findOne({ _id: companyId })
  .populate({ path: 'billingRepresentative', select: '_id picture contact identity local' })
  .populate({ path: 'salesRepresentative', select: '_id picture contact identity local' })
  .lean();
