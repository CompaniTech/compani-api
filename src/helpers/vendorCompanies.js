const VendorCompany = require('../models/VendorCompany');
const drive = require('../models/Google/Drive');
const GDriveStorageHelper = require('./gDriveStorage');

exports.get = async () => VendorCompany
  .findOne()
  .populate({ path: 'billingRepresentative', select: '_id picture contact identity local' })
  .lean();

exports.update = async payload => VendorCompany.updateOne({}, { $set: payload });

exports.uploadDebitMandateTemplate = async (payload) => {
  const uploadedFile = await GDriveStorageHelper.addFile({
    driveFolderId: process.env.DEBIT_MANDAT_FOLDER_ID,
    name: 'template_mandat_prelevement_SEPA_Compani',
    type: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    body: payload.file,
  });

  const driveFileInfo = await drive.getFileById({ fileId: uploadedFile.id });

  const vendorCompanyPayload = { debitMandateTemplate: { driveId: uploadedFile.id, link: driveFileInfo.webViewLink } };
  await VendorCompany.updateOne({}, { $set: vendorCompanyPayload }).lean();
};

exports.removeDebitMandateTemplate = async () => {
  const vendorCompany = await VendorCompany.findOne({}).lean();

  await GDriveStorageHelper.deleteFile(vendorCompany.debitMandateTemplate.driveId);

  await VendorCompany.updateOne({}, { $unset: { debitMandateTemplate: '' } });
};
