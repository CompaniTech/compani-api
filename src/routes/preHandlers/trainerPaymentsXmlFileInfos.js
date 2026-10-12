const Boom = require('@hapi/boom');
const get = require('lodash/get');
const TrainerPayment = require('../../models/TrainerPayment');
const TrainerPaymentsXmlFileInfos = require('../../models/TrainerPaymentsXmlFileInfos');
const VendorCompany = require('../../models/VendorCompany');
const translate = require('../../helpers/translate');
const { PENDING } = require('../../helpers/constants');

const { language } = translate;

exports.authorizeXMLFileDownload = async (req) => {
  const { payments: paymentIds, name } = req.payload;

  const xmlFileInfosAlreadyExist = await TrainerPaymentsXmlFileInfos
    .countDocuments({ $or: [{ trainerPayments: { $in: paymentIds } }, { name }] });
  if (xmlFileInfosAlreadyExist) throw Boom.conflict(translate[language].xmlSEPAFileInfosAlreadyExist);

  const paymentList = await TrainerPayment
    .find({ _id: { $in: paymentIds }, status: PENDING })
    .populate({ path: 'trainerBill', select: 'trainer', populate: { path: 'trainer', select: 'bic iban' } })
    .lean();

  if (paymentList.length !== paymentIds.length) {
    throw Boom.notFound(translate[language].trainerPaymentsXmlFileWrongPayment);
  }

  const everyTrainerHasBICAndIBAN = paymentList
    .every(payment => get(payment, 'trainerBill.trainer.bic') && get(payment, 'trainerBill.trainer.iban'));
  if (!everyTrainerHasBICAndIBAN) {
    throw Boom.forbidden(translate[language].trainerPaymentsXmlFileGenerationFailedMissingBankDetails);
  }

  const vendorCompanyHasBankDetails = await VendorCompany
    .countDocuments({ bic: { $exists: true }, iban: { $exists: true } });
  if (!vendorCompanyHasBankDetails) {
    throw Boom.forbidden(translate[language].trainerPaymentsXmlFileGenerationFailedMissingVendorInfos);
  }

  return null;
};
