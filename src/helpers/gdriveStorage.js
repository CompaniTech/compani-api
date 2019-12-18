const Boom = require('boom');
const Gdrive = require('../models/Google/Drive');

exports.addFile = async (params) => {
  const parentFolderId = params.driveFolderId;
  const uploadedFile = await Gdrive.add({
    name: params.name,
    parentFolderId,
    folder: false,
    type: params.type,
    body: params.body,
  });
  return uploadedFile;
};

exports.createFolder = async (identity, parentFolderId) => {
  const folder = await Gdrive.add({
    name: typeof identity === 'string' ? identity : `${identity.lastname.toUpperCase()} ${identity.firstname || ''}`,
    parentFolderId,
    folder: true,
  });

  if (!folder) throw Boom.failedDependency('Google drive folder creation failed.');

  return folder;
};

exports.createFolderForCompany = async (companyName) => {
  const parentFolderId = process.env.GOOGLE_DRIVE_COMPANY_FOLDER_ID;
  const folder = await Gdrive.add({
    name: companyName,
    parentFolderId,
    folder: true,
  });

  if (!folder) throw Boom.failedDependency('Google drive folder creation failed.');

  return folder;
};

exports.deleteFile = (driveFileId) => {
  if (process.env.NODE_ENV === 'test') return;
  return Gdrive.deleteFile({ fileId: driveFileId });
};
