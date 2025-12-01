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

  const folder = await Gdrive.add({ name: traineeName, parentFolderId, folder: true });
  if (!folder) throw Boom.failedDependency('Google drive folder creation failed.');

  const sheetName = `${traineeName} - Fichier Apprenant`;
  const sheet = await Gdrive.add({
    name: sheetName,
    parentFolderId: folder.id,
    folder: false,
    type: 'application/vnd.google-apps.spreadsheet',
  });
  if (!sheet) throw Boom.failedDependency('Google Sheet creation failed.');

  const billingCompaniEmail = process.env.BILLING_COMPANI_EMAIL;
  await Gsheets.writeData({
    spreadsheetId: sheet.id,
    range: 'A1:F4',
    values: [
      ['Début de formation :', 'Tuteur.trice', 'Coach', 'Architecte de parcours', 'Apprenant.e', 'Compani'],
      ['Prénom Nom', '', '', '', traineeName, ''],
      ['Email', '', '', '', traineeEmail, billingCompaniEmail],
      ['Tel', '', '', '', traineePhone, ''],
    ],
    boldRanges: [
      { startRow: 1, endRow: 1, startCol: 1, endCol: 6 },
      { startRow: 2, endRow: 4, startCol: 1, endCol: 1 },
    ],
    backgroundColorRanges: [
      { startRow: 1, endRow: 1, startCol: 1, endCol: 1, color: '#ffe599' }, // A1
    ],
  });

  return { folderId: folder.id, sheetId: sheet.id };
};
