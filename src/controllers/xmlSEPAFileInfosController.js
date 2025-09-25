const Boom = require('@hapi/boom');
const get = require('lodash/get');
const XmlSEPAFileInfosHelper = require('../helpers/xmlSEPAFileInfos');

const create = async (req, h) => {
  try {
    req.log('teletransmissionController - generateDeliveryXml - query', req.query);
    req.log('teletransmissionController - generateDeliveryXml - company', get(req, 'auth.credentials.company._id'));

    const doc = await XmlSEPAFileInfosHelper.create(req.payload);

    return h.file(doc.file, { confine: false, filename: doc.fileName, mode: 'attachment' })
      .header('Access-Control-Expose-Headers', 'Content-Disposition')
      .type('application/xml');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { create };
