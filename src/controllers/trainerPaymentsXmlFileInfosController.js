const Boom = require('@hapi/boom');
const TrainerPaymentsXmlFileInfosHelper = require('../helpers/trainerPaymentsXmlFileInfos');

const create = async (req, h) => {
  try {
    const file = await TrainerPaymentsXmlFileInfosHelper.create(req.payload);

    return h.file(file, { confine: false, mode: 'attachment' })
      .header('Content-Disposition')
      .type('application/octet-stream');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { create };
