const Boom = require('@hapi/boom');
const CourseBill = require('../../models/CourseBill');
const CoursePayment = require('../../models/CoursePayment');
const { XML_GENERATED, PENDING } = require('../../helpers/constants');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.authorizeCoursePaymentCreation = async (req) => {
  try {
    const { courseBill: courseBillId } = req.payload;

    const courseBill = await CourseBill.findOne({ _id: courseBillId }, { billedAt: 1 }).lean();
    if (!courseBill) throw Boom.notFound();
    if (!courseBill.billedAt) throw Boom.forbidden();

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeCoursePaymentUpdate = async (req) => {
  try {
    const coursePaymentExists = await CoursePayment.findOne({ _id: req.params._id }, { status: 1 }).lean();
    if (!coursePaymentExists) throw Boom.notFound();

    if (coursePaymentExists.status === XML_GENERATED && req.payload.status === PENDING) {
      throw Boom.badRequest(translate[language].coursePaymentStatusError);
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeCoursePaymentListEdition = async (req) => {
  try {
    const coursePayments = await CoursePayment.find({ _id: { $in: req.payload._ids } }, { status: 1 }).lean();
    if (coursePayments.length !== req.payload._ids.length) throw Boom.notFound();

    const somePaymentsAreXmlGenerated = coursePayments.some(coursePayment => coursePayment.status === XML_GENERATED);
    if (somePaymentsAreXmlGenerated && req.payload.status === PENDING) {
      throw Boom.badRequest(translate[language].coursePaymentStatusError);
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
