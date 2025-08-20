const flat = require('flat');
const omit = require('lodash/omit');
const get = require('lodash/get');
const { ObjectId } = require('mongodb');
const Company = require('../models/Company');
const CompanyHolding = require('../models/CompanyHolding');
const VendorCompany = require('../models/VendorCompany');
const Drive = require('../models/Google/Drive');
const GDriveStorageHelper = require('./gDriveStorage');
const HoldingHelper = require('./holdings');
const UtilsHelper = require('./utils');
const { DIRECTORY, DD_MM_YYYY } = require('./constants');
const { formatRumNumber } = require('./utils');
const { CompaniDate } = require('./dates/companiDates');
const DocxHelper = require('./docx');
const DatesUtilsHelper = require('./dates');

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

const getEditedField = (payload) => {
  if (payload.bic) return 'bic';
  if (payload.iban) return 'iban';
  if (payload.address) return 'address';
  return null;
};

exports.updateCompany = async (companyId, payload) => {
  let debitMandate = {};
  const company = await Company.findOne({ _id: companyId }).lean();
  const lastMandate = company.debitMandates.sort(DatesUtilsHelper.descendingSort('createdAt'))[0];

  const field = getEditedField(payload);
  const isMandateSigned = !!lastMandate.signedAt || !!lastMandate.file;
  const hasToCreateNewMandate = isMandateSigned && payload[field] !== company[field];
  if (hasToCreateNewMandate) {
    const today = CompaniDate();
    const date = today.format('yyyyMM').slice(2);
    const mandateNumber = company.debitMandates.length + 1;
    const rum = formatRumNumber(company.prefixNumber, date, mandateNumber);
    debitMandate = { _id: new ObjectId(), rum, createdAt: today.toISO() };
  }

  return Company.findOneAndUpdate(
    { _id: companyId },
    { $set: flat(payload), ...Object.keys(debitMandate).length && { $addToSet: { debitMandates: debitMandate } } },
    { new: true }
  ).lean();
};

exports.getCompany = async companyId => Company
  .findOne({ _id: companyId })
  .populate({ path: 'billingRepresentative', select: '_id picture contact identity local' })
  .populate({ path: 'salesRepresentative', select: '_id picture contact identity local' })
  .lean();

exports.generateMandate = async (companyId, mandateId) => {
  const vendorCompany = await VendorCompany.findOne().lean();
  const company = await Company.findOne({ _id: companyId }).lean();
  const mandate = company.debitMandates.find(dm => UtilsHelper.areObjectIdsEquals(dm._id, mandateId));

  const data = {
    vendorCompanyName: vendorCompany.name,
    vendorCompanyIcs: vendorCompany.ics,
    vendorCompanyAddress: vendorCompany.address.fullAddress || '',
    companyName: company.name || '',
    companyAddress: get(company, 'address.fullAddress') || '',
    companyBic: company.bic || '',
    companyIban: company.iban || '',
    companyRum: mandate.rum,
    downloadDate: CompaniDate().format(DD_MM_YYYY),
  };

  const templateId = get(vendorCompany, 'debitMandateTemplate.driveId');
  return DocxHelper.generateDocx({ file: { fileId: templateId }, data });
};

exports.updateMandate = async (companyId, mandateId, payload) => {
  await Company.findOneAndUpdate(
    { _id: companyId, 'debitMandates._id': mandateId },
    { $set: flat({ 'debitMandates.$': { ...payload } }) },
    { new: true, autopopulate: false }
  );
};

exports.uploadMandate = async (companyId, mandateId, payload) => {
  const company = await Company.findOne({ _id: companyId }).lean();
  const mandateNumber = company.debitMandates.findIndex(m => UtilsHelper.areObjectIdsEquals(m._id, mandateId)) + 1;

  const uploadedFile = await GDriveStorageHelper.addFile({
    driveFolderId: company.directDebitsFolderId,
    name: `${company.name}_mandat_prelevement_signe_${mandateNumber}`,
    type: 'application/pdf',
    body: payload.file,
  });
  const driveFileInfo = await Drive.getFileById({ fileId: uploadedFile.id });
  const file = { driveId: uploadedFile.id, link: driveFileInfo.webViewLink };

  await Company.findOneAndUpdate(
    { _id: companyId, 'debitMandates._id': mandateId },
    { $set: UtilsHelper.flatQuery({ 'debitMandates.$': { _id: mandateId, file } }, { safe: true }) }
  );
};
