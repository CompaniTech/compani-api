const Boom = require('@hapi/boom');
const get = require('lodash/get');
const CourseBillHelper = require('../helpers/courseBills');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const courseBills = await CourseBillHelper.list(req.query, req.auth.credentials);

    return {
      message: courseBills.length ? translate[language].courseBillsFound : translate[language].courseBillsNotFound,
      data: { courseBills },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    await CourseBillHelper.create(req.payload);

    return { message: translate[language].courseBillCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await CourseBillHelper.updateCourseBill(req.params._id, req.payload);

    return { message: translate[language].courseBillUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addBillingPurchase = async (req) => {
  try {
    await CourseBillHelper.addBillingPurchase(req.params._id, req.payload);

    return { message: translate[language].courseBillUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const updateBillingPurchase = async (req) => {
  try {
    const { _id: billId, billingPurchaseId } = req.params;
    await CourseBillHelper.updateBillingPurchase(billId, billingPurchaseId, req.payload);

    return { message: translate[language].courseBillUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const deleteBillingPurchase = async (req) => {
  try {
    const { _id: billId, billingPurchaseId } = req.params;
    await CourseBillHelper.deleteBillingPurchase(billId, billingPurchaseId);

    return { message: translate[language].courseBillUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const generateBillPdf = async (req, h) => {
  try {
    req.log('courseBillController - generateBillPdf - params', req.params);
    req.log('courseBillController - generateBillPdf - company', get(req, 'auth.credentials.company._id'));

    const {
      pdf,
      billNumber,
    } = await CourseBillHelper.generateBillPdf(req.params._id, req.pre.companies, req.auth.credentials);
    return h.response(pdf)
      .header('content-disposition', `inline; filename=${billNumber}.pdf`)
      .type('application/pdf');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const deleteBill = async (req) => {
  try {
    await CourseBillHelper.deleteBill(req.params._id);

    return { message: translate[language].courseBillDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const deleteBillList = async (req) => {
  try {
    await CourseBillHelper.deleteBillList(req.payload._ids);

    return { message: translate[language].courseBillsDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  list,
  create,
  update,
  addBillingPurchase,
  updateBillingPurchase,
  deleteBillingPurchase,
  generateBillPdf,
  deleteBill,
  deleteBillList,
};
