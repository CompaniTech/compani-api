const Boom = require('@hapi/boom');
const get = require('lodash/get');
const { DIRECT_DEBIT, PENDING } = require('../../helpers/constants');
const CoursePayment = require('../../models/CoursePayment');
const xmlSEPAFileInfos = require('../../models/XmlSEPAFileInfos');
const VendorCompany = require('../../models/VendorCompany');
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
        select: 'company',
        populate: [{ path: 'company', select: 'name debitMandates bic iban' }],
      },
    })
    .setOptions({ isVendorUser: true })
    .lean();

  if (paymentList.length !== paymentIds.length) throw Boom.notFound(translate[language].xmlSEPAFileWrongPayment);

  if (paymentList.some(payment => !get(payment, 'courseBill.isPayerCompany'))) {
    throw Boom.forbidden(translate[language].xmlSEPAFileWrongPayer);
  }

  const everyPayerHasBICAndIBAN = paymentList
    .every(payment => payment.courseBill.payer.bic && payment.courseBill.payer.iban);
  if (!everyPayerHasBICAndIBAN) throw Boom.forbidden(translate[language].xmlSEPAFileGenerationFailedMissingBankDetails);

  const everyPayerHasSignedMandate = paymentList.every((payment) => {
    const lastMandate = UtilsHelper.getLastVersion(payment.courseBill.payer.debitMandates, 'createdAt');
    return !!get(lastMandate, 'signedAt') && !!get(lastMandate, 'file.link');
  });
  if (!everyPayerHasSignedMandate) {
    throw Boom.forbidden(translate[language].xmlSEPAFileGenerationFailedMissingSignedMandate);
  }

  const vendorCompanyHasBankDetails = await VendorCompany
    .countDocuments({ bic: { $exists: true }, iban: { $exists: true }, ics: { $exists: true } });
  if (!vendorCompanyHasBankDetails) {
    throw Boom.forbidden(translate[language].xmlSEPAFileGenerationFailedMissingVendorInfos);
  }

  return null;
};
