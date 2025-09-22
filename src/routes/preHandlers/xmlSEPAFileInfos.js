const Boom = require('@hapi/boom');
const get = require('lodash/get');
const { DIRECT_DEBIT } = require('../../helpers/constants');
const CoursePayment = require('../../models/CoursePayment');
const xmlSEPAFileInfos = require('../../models/XmlSEPAFileInfos');

exports.authorizeXMLFileDownload = async (req) => {
  const { payments: paymentIds } = req.payload;

  const paymentList = await CoursePayment
    .find({ _id: { $in: paymentIds }, type: DIRECT_DEBIT })
    .populate({
      path: 'courseBill',
      option: { isVendorUser: true },
      populate: { path: 'payer.fundingOrganisation', select: 'name' },
    })
    .setOptions({ isVendorUser: true })
    .lean();
  if (paymentList.length !== paymentIds.length) throw Boom.notFound();
  if (paymentList.some(payment => get(payment, 'courseBill.payer.name'))) throw Boom.forbidden();

  const xmlSEPAFileInfosAlreadyExists = await xmlSEPAFileInfos.countDocuments({ payments: { $in: paymentIds } });
  if (xmlSEPAFileInfosAlreadyExists) throw Boom.conflict();

  return null;
};
