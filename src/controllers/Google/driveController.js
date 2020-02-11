const Boom = require('boom');

const translate = require('../../helpers/translate');
const drive = require('../../models/Google/Drive');
const DriveHelper = require('../../helpers/drive');
const { generateDocx } = require('../../helpers/docx');

const { language } = translate;

const deleteFile = async (req) => {
  try {
    await drive.deleteFile({ fileId: req.params.id });
    return { message: translate[language].fileDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getFileById = async (req) => {
  try {
    const file = await drive.getFileById({ fileId: req.params.id });
    return { message: translate[language].fileFound, data: { file } };
  } catch (e) {
    req.log('error', e);
    if (e.message.match(/file not found/i)) {
      return Boom.notFound(translate[language].fileNotFound);
    }
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getList = async (req) => {
  try {
    const list = await drive.list({ folderId: req.query.folderId });
    return { message: translate[language].filesFound, data: { files: list.files } };
  } catch (e) {
    req.log('error', e);
    if (e.message.match(/file not found/i)) {
      return Boom.notFound(translate[language].filesNotFound);
    }
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const uploadFile = async (req) => {
  try {
    const fileInfo = await DriveHelper.uploadFile(req.params.id, req.payload);

    return {
      message: translate[language].fileCreated,
      data: { payload: fileInfo },
    };
  } catch (e) {
    req.log('error', e);
  }
};

const generateDocxFromDrive = async (req, h) => {
  try {
    const payload = {
      file: { fileId: req.params.id },
      data: req.payload,
    };
    const tmpOutputPath = await generateDocx(payload);
    return h.file(tmpOutputPath, { confine: false });
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  deleteFile,
  getFileById,
  getList,
  uploadFile,
  generateDocxFromDrive,
};
