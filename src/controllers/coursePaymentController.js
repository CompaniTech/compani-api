const Boom = require('@hapi/boom');
const CoursePaymentsHelper = require('../helpers/coursePayments');
const translate = require('../helpers/translate');

const { language } = translate;

const create = async (req) => {
  try {
    await CoursePaymentsHelper.createCoursePayment(req.payload);

    return { message: translate[language].paymentCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await CoursePaymentsHelper.updateCoursePayment(req.params._id, req.payload);

    return { message: translate[language].paymentUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const list = async (req) => {
  try {
    const coursePayments = await CoursePaymentsHelper.list(req.query);

    return { data: { coursePayments }, message: translate[language].coursePaymentsFound };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const updatePaymentList = async (req) => {
  try {
    await CoursePaymentsHelper.updateList(req.payload);

    return { message: translate[language].coursePaymentsUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { create, update, list, updatePaymentList };
