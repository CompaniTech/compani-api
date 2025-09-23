const Boom = require('@hapi/boom');
const get = require('lodash/get');
const { DIRECT_DEBIT, PENDING } = require('../../helpers/constants');
const CoursePayment = require('../../models/CoursePayment');
const xmlSEPAFileInfos = require('../../models/XmlSEPAFileInfos');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.authorizeXMLFileDownload = async (req) => {
  const { payments: paymentIds, name } = req.payload;

  const paymentList = await CoursePayment
    .find({ _id: { $in: paymentIds }, type: DIRECT_DEBIT, status: PENDING })
    .populate({
      path: 'courseBill',
      option: { isVendorUser: true },
      populate: { path: 'payer.fundingOrganisation', select: 'name' },
    })
    .setOptions({ isVendorUser: true })
    .lean();
  if (paymentList.length !== paymentIds.length) throw Boom.notFound(translate[language].xmlSEPAFileWrongPayment);
  if (paymentList.some(payment => get(payment, 'courseBill.payer.name'))) {
    throw Boom.forbidden(translate[language].xmlSEPAFileWrongPayer);
  }

  const xmlSEPAFileInfosAlreadyExists = await xmlSEPAFileInfos
    .countDocuments({ $or: [{ payments: { $in: paymentIds } }, { name }] });
  if (xmlSEPAFileInfosAlreadyExists) throw Boom.conflict(translate[language].xmlSEPAFileInfosAlreadyExist);

  return null;
};
