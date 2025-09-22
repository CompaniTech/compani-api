const Boom = require('@hapi/boom');
const get = require('lodash/get');
const XmlSEPAFileInfosHelper = require('../helpers/xmlSEPAFileInfos');

const downloadXmlSEPAFile = async (req) => {
  try {
    req.log('teletransmissionController - generateDeliveryXml - query', req.query);
    req.log('teletransmissionController - generateDeliveryXml - company', get(req, 'auth.credentials.company._id'));

    const doc = await XmlSEPAFileInfosHelper.downloadXmlSEPAFile(req.payload);

    return doc;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { downloadXmlSEPAFile };
