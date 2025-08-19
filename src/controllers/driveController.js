const Boom = require('@hapi/boom');
const DriveHelper = require('../helpers/drive');

const downloadFile = async (req, h) => {
  try {
    const { filePath, type } = await DriveHelper.downloadFile(req.params.id);

    return h.file(filePath, { confine: false, mode: 'attachment' }).type(type);
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { downloadFile };
