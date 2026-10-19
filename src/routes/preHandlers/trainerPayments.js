const Boom = require('@hapi/boom');
const TrainerPayment = require('../../models/TrainerPayment');
const TrainerPaymentsXmlFileInfos = require('../../models/TrainerPaymentsXmlFileInfos');
const translate = require('../../helpers/translate');
const { PENDING, PAID } = require('../../helpers/constants');

const { language } = translate;

exports.authorizeTrainerPaymentUpdate = async (req) => {
  try {
    const trainerPayment = await TrainerPayment.findOne({ _id: req.params._id }, { _id: 1 }).lean();
    if (!trainerPayment) throw Boom.notFound();

    const isLinkedToXMLFile = await TrainerPaymentsXmlFileInfos.countDocuments({ trainerPayments: req.params._id });
    if (isLinkedToXMLFile && req.payload.status !== PAID) {
      throw Boom.conflict(translate[language].trainerPaymentStatusConflict);
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeTrainerPaymentDeletion = async (req) => {
  try {
    const trainerPayment = await TrainerPayment.findOne({ _id: req.params._id }, { status: 1 }).lean();
    if (!trainerPayment) throw Boom.notFound();

    if (trainerPayment.status !== PENDING) throw Boom.forbidden(translate[language].trainerPaymentWrongStatus);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
