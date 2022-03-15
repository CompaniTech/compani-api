const Boom = require('@hapi/boom');
const Company = require('../../models/Company');
const Course = require('../../models/Course');
const CourseBill = require('../../models/CourseBill');
const CourseBillingItem = require('../../models/CourseBillingItem');
const CourseFundingOrganisation = require('../../models/CourseFundingOrganisation');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.authorizeCourseBillCreation = async (req) => {
  const { course, company, courseFundingOrganisation } = req.payload;
  const companyExists = await Company.countDocuments({ _id: company });
  if (!companyExists) throw Boom.notFound();

  const courseExists = await Course.countDocuments({ _id: course, company });
  if (!courseExists) throw Boom.notFound();

  if (courseFundingOrganisation) {
    const courseFundingOrganisationExists = await CourseFundingOrganisation
      .countDocuments({ _id: courseFundingOrganisation });
    if (!courseFundingOrganisationExists) throw Boom.notFound();
  }

  return null;
};

exports.authorizeCourseBillGet = async (req) => {
  const { course } = req.query;
  const courseExists = await Course.countDocuments({ _id: course });
  if (!courseExists) throw Boom.notFound();

  return null;
};

exports.authorizeCourseBillUpdate = async (req) => {
  const courseBill = await CourseBill.findOne({ _id: req.params._id }).lean();
  if (!courseBill) throw Boom.notFound();

  if (req.payload.courseFundingOrganisation) {
    const courseFundingOrganisationExists = await CourseFundingOrganisation
      .countDocuments({ _id: req.payload.courseFundingOrganisation });
    if (!courseFundingOrganisationExists) throw Boom.notFound();
  }

  if (courseBill.billedAt) {
    if (req.payload.billedAt) throw Boom.forbidden();

    const payloadEntries = UtilsHelper.getEntriesOfNestedObject(req.payload);
    const courseBillEntries = UtilsHelper.getEntriesOfNestedObject(courseBill);
    const allowedUpdateKey = 'mainFee.description';

    for (const [payloadKey, payloadValue] of payloadEntries) {
      for (const [courseBillKey, courseBillValue] of courseBillEntries) {
        const requestingUpdate = payloadKey === courseBillKey && payloadValue !== courseBillValue;
        const updateIsAllowed = payloadKey === allowedUpdateKey;

        if (requestingUpdate && !updateIsAllowed) throw Boom.forbidden();
      }
    }
  }

  return null;
};

exports.authorizeCourseBillingPurchaseAddition = async (req) => {
  const { billingItem } = req.payload;
  const billingItemExists = await CourseBillingItem.countDocuments({ _id: billingItem });
  if (!billingItemExists) throw Boom.notFound();

  const courseBill = await CourseBill.findOne({ _id: req.params._id }).lean();
  if (!courseBill) throw Boom.notFound();

  if (courseBill.billingPurchaseList.find(p => UtilsHelper.areObjectIdsEquals(p.billingItem, billingItem))) {
    throw Boom.conflict(translate[language].courseBillingItemAlreadyAdded);
  }

  return null;
};

exports.authorizeCourseBillingPurchaseUpdate = async (req) => {
  const { _id: courseBillId, billingPurchaseId } = req.params;

  const purchaseRelatedToBill = await CourseBill.countDocuments({
    _id: courseBillId,
    'billingPurchaseList._id': billingPurchaseId,
  });
  if (!purchaseRelatedToBill) throw Boom.notFound();
  return null;
};

exports.authorizeCourseBillingPurchaseDelete = async (req) => {
  const { _id: courseBillId, billingPurchaseId } = req.params;

  const courseBill = await CourseBill.findOne({ _id: courseBillId }).lean();
  if (!courseBill) throw Boom.notFound();

  if (courseBill.billedAt) throw Boom.forbidden();

  const purchaseRelatedToBill = courseBill.billingPurchaseList
    .some(p => UtilsHelper.areObjectIdsEquals(p._id, billingPurchaseId));
  if (!purchaseRelatedToBill) throw Boom.notFound();

  return null;
};

exports.authorizeBillPdfGet = async (req) => {
  const isBillValidated = await CourseBill
    .countDocuments({ _id: req.params._id, billedAt: { $exists: true, $type: 'date' } });
  if (!isBillValidated) throw Boom.notFound();

  return null;
};
