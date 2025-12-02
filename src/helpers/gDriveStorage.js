const Boom = require('@hapi/boom');
const Gdrive = require('../models/Google/Drive');
const Gsheets = require('../models/Google/Sheets');

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
  const folder = await Gdrive.add({ name: companyName, parentFolderId, folder: true });

  if (!folder) throw Boom.failedDependency('Google drive folder creation failed.');

  return folder;
};

exports.addFile = async (params) => {
  const { parentFolderId, type, body, name } = params;
  const uploadedFile = await Gdrive.add({ name, parentFolderId, folder: false, type, body });

  return uploadedFile;
};

exports.deleteFile = async driveFileId => Gdrive.deleteFile({ fileId: driveFileId });

exports.createCourseFolderAndSheet = async ({ traineeName, traineeEmail, traineePhone }) => {
  const parentFolderId = process.env.GOOGLE_DRIVE_VAEI_FOLDER_ID;
  const templateId = process.env.GOOGLE_SHEET_TEMPLATE_ID;

  if (!templateId) throw Boom.failedDependency('Template sheet ID missing.');

  const folder = await Gdrive.add({ name: traineeName, parentFolderId, folder: true });
  if (!folder) throw Boom.failedDependency('Google drive folder creation failed.');

  const sheetName = `${traineeName} - Fichier Apprenant`;
  const copiedSheet = await Gdrive.copy({
    fileId: templateId,
    name: sheetName,
    parents: [folder.id],
  });
  if (!copiedSheet) throw Boom.failedDependency('Google Sheet copy failed.');

  await Gsheets.writeData({
    spreadsheetId: copiedSheet.id,
    range: 'Coordonnées!E2:E4',
    values: [[traineeName], [traineeEmail], [`'${traineePhone}`]],
  });

  return { folderId: folder.id, sheetId: copiedSheet.id };
};
