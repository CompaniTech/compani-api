const Boom = require('@hapi/boom');
const get = require('lodash/get');
const XmlSEPAFileInfosHelper = require('../helpers/xmlSEPAFileInfos');

const create = async (req, h) => {
  try {
    req.log('teletransmissionController - generateDeliveryXml - query', req.query);
    req.log('teletransmissionController - generateDeliveryXml - company', get(req, 'auth.credentials.company._id'));

    const file = await XmlSEPAFileInfosHelper.create(req.payload);

    return h.file(file, { confine: false, mode: 'attachment' })
      .header('Content-Disposition')
      .type('application/octet-stream');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { create };
