const Boom = require('@hapi/boom');
const get = require('lodash/get');
const { DIRECT_DEBIT, PENDING } = require('../../helpers/constants');
const CoursePayment = require('../../models/CoursePayment');
const xmlSEPAFileInfos = require('../../models/XmlSEPAFileInfos');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');

const { language } = translate;

exports.authorizeXMLFileDownload = async (req) => {
  const { payments: paymentIds, name } = req.payload;

  const xmlSEPAFileInfosAlreadyExists = await xmlSEPAFileInfos
    .countDocuments({ $or: [{ coursePayments: { $in: paymentIds } }, { name }] });
  if (xmlSEPAFileInfosAlreadyExists) throw Boom.conflict(translate[language].xmlSEPAFileInfosAlreadyExist);

  const paymentList = await CoursePayment
    .find({ _id: { $in: paymentIds }, type: DIRECT_DEBIT, status: PENDING })
    .populate({
      path: 'courseBill',
      option: { isVendorUser: true },
      select: 'payer isPayerCompany',
      populate: {
        path: 'payer',
        select: 'company fundingorganisation',
        populate: [{ path: 'company', select: 'name debitMandates' }],
      },
    })
    .setOptions({ isVendorUser: true })
    .lean();

  if (paymentList.length !== paymentIds.length) throw Boom.notFound(translate[language].xmlSEPAFileWrongPayment);

  if (paymentList.some(payment => !get(payment, 'courseBill.isPayerCompany'))) {
    throw Boom.forbidden(translate[language].xmlSEPAFileWrongPayer);
  }
  const everyPayerHasSignedMandate = paymentList.every((payment) => {
    const lastMandate = UtilsHelper.getLastVersion(payment.courseBill.payer.debitMandates, 'createdAt');
    return !!get(lastMandate, 'signedAt') && !!get(lastMandate, 'file.link');
  });
  if (!everyPayerHasSignedMandate) throw Boom.forbidden(translate[language].xmlSEPAFileGenerationMissingSignedMandate);

  return null;
};
