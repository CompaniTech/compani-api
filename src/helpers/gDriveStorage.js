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

exports.createCourseFolderAndSheet = async ({
  traineeName,
  traineeEmail,
  traineePhone,
  traineeCompany,
  coach = null,
  architect = null,
}) => {
  const parentFolderId = process.env.GOOGLE_DRIVE_VAEI_FOLDER_ID;
  const templateId = process.env.GOOGLE_SHEET_TEMPLATE_ID;

  if (!templateId) throw Boom.failedDependency('Template sheet ID missing.');

  const documentsName = `${traineeName} (${traineeCompany})`;
  const folder = await exports.createFolder(documentsName, parentFolderId);

  const sheetName = `${documentsName} - Fichier Apprenant`;
  const copiedSheet = await Gdrive.copy({
    fileId: templateId,
    name: sheetName,
    parents: [folder.id],
  });
  if (!copiedSheet) throw Boom.failedDependency('Google Sheet copy failed.');

  await Gsheets.writeData({
    spreadsheetId: copiedSheet.id,
    range: 'Coordonnées!E2:E4',
    values: [[traineeName], [traineeEmail], [traineePhone ? `'${traineePhone}` : '']],
  });

  if (coach) {
    await Gsheets.writeData({
      spreadsheetId: copiedSheet.id,
      range: 'Coordonnées!C2:C4',
      values: [[coach.name], [coach.email], [coach.phone ? `'${coach.phone}` : '']],
    });
  }
  if (architect) {
    await Gsheets.writeData({
      spreadsheetId: copiedSheet.id,
      range: 'Coordonnées!D2:D4',
      values: [[architect.name], [architect.email], [architect.phone ? `'${architect.phone}` : '']],
    });
  }

  return { folderId: folder.id, gSheetId: copiedSheet.id };
};
