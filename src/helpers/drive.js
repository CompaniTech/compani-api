const path = require('path');
const os = require('os');
const drive = require('../models/Google/Drive');

exports.downloadFile = async (driveId) => {
  const filePath = path.join(os.tmpdir(), 'download');
  const { type } = await drive.downloadFileById({ fileId: driveId, tmpFilePath: filePath });
  return { filePath, type };
};
