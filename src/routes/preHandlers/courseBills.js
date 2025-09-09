const Boom = require('@hapi/boom');
const { get, omit, has } = require('lodash');
const Company = require('../../models/Company');
const Course = require('../../models/Course');
const CourseBill = require('../../models/CourseBill');
const CourseBillingItem = require('../../models/CourseBillingItem');
const CourseFundingOrganisation = require('../../models/CourseFundingOrganisation');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');
const {
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  BALANCE,
  INTRA,
  GROUP,
  TRAINEE,
  SINGLE,
} = require('../../helpers/constants');

const { language } = translate;

exports.authorizeCourseBillListCreation = async (req) => {
  const { course: courseId, companies: companiesIds, payer, mainFee, quantity, maturityDate } = req.payload;

  const course = await Course
    .findOne({ _id: courseId }, { type: 1, expectedBillsCount: 1, companies: 1, prices: 1, interruptedAt: 1 })
    .lean();

  if (!course) throw Boom.notFound();

  if (course.interruptedAt) throw Boom.forbidden();

  const everyCompanyBelongsToCourse = course &&
    companiesIds.every(c => UtilsHelper.doesArrayIncludeId(course.companies, c));
  if (!everyCompanyBelongsToCourse) throw Boom.notFound();

  if (payer) {
    if (payer.fundingOrganisation) {
      const fundingOrganisation = await CourseFundingOrganisation
        .countDocuments({ _id: payer.fundingOrganisation }, { limit: 1 });
      if (!fundingOrganisation) throw Boom.notFound();
    } else {
      const company = await Company.countDocuments({ _id: payer.company }, { limit: 1 });
      if (!company) throw Boom.notFound();
    }
  }

  if (course.type !== SINGLE) {
    if (course.type === INTRA) {
      if (mainFee.countUnit !== GROUP || mainFee.count !== 1) throw Boom.badRequest();

      if (!course.expectedBillsCount) throw Boom.conflict();

      const courseBills = await CourseBill.find({ course: courseId }, { courseCreditNote: 1 })
        .populate({ path: 'courseCreditNote', options: { isVendorUser: true } })
        .setOptions({ isVendorUser: true })
        .lean();

      const courseBillsWithoutCreditNote = courseBills.filter(cb => !cb.courseCreditNote);
      if (courseBillsWithoutCreditNote.length + quantity > course.expectedBillsCount) throw Boom.conflict();
    }

    const companiesHavePrice = companiesIds
      .some(c => (course.prices || []).find(p => UtilsHelper.areObjectIdsEquals(p.company, c)));

    if (quantity === 1) {
      if (companiesHavePrice && !mainFee.percentage) throw Boom.badRequest();

      if (mainFee.percentage) {
        if (companiesIds.some(c => !(course.prices || []).find(p => UtilsHelper.areObjectIdsEquals(p.company, c)))) {
          throw Boom.forbidden();
        }
        const existingCourseBills = await CourseBill
          .find({ course: course._id, companies: { $in: companiesIds }, 'mainFee.percentage': { $exists: true } })
          .populate({ path: 'courseCreditNote', options: { isVendorUser: true } })
          .lean();

        const courseBillsWithoutCreditNote = existingCourseBills.filter(cb => !cb.courseCreditNote);

        for (const company of companiesIds) {
          const billedPercentageSum = courseBillsWithoutCreditNote
            .filter(bill => UtilsHelper.doesArrayIncludeId(bill.companies, company))
            .reduce((acc, bill) => acc + bill.mainFee.percentage, 0);

          if (billedPercentageSum + mainFee.percentage > 100) {
            throw Boom.conflict(translate[language].sumCourseBillsPercentageGreaterThan100);
          }
        }
      }
    } else if (maturityDate) throw Boom.badRequest();
  } else {
    if (mainFee.percentage) throw Boom.forbidden();

    const hasWrongCountUnit = mainFee.countUnit !== TRAINEE;
    const hasWrongQuantity = mainFee.count !== 1;
    if (hasWrongCountUnit || hasWrongQuantity) throw Boom.badRequest();

    if (!maturityDate) throw Boom.badRequest();

    if (!course.expectedBillsCount) throw Boom.conflict();

    const courseBills = await CourseBill.find({ course: courseId }, { courseCreditNote: 1 })
      .populate({ path: 'courseCreditNote', options: { isVendorUser: true } })
      .setOptions({ isVendorUser: true })
      .lean();

    const courseBillsWithoutCreditNote = courseBills.filter(cb => !cb.courseCreditNote);
    if (courseBillsWithoutCreditNote.length + quantity > course.expectedBillsCount) throw Boom.conflict();
  }

  return null;
};

exports.authorizeCourseBillGet = async (req) => {
  const { course, company, action } = req.query;

  const { credentials } = req.auth;
  const userVendorRole = get(credentials, 'role.vendor.name');
  const isAdminVendor = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(userVendorRole);

  if (!isAdminVendor) {
    if (action !== BALANCE) throw Boom.badRequest();
    if (!UtilsHelper.hasUserAccessToCompany(credentials, company)) throw Boom.forbidden();
  }

  if (course) {
    const courseExists = await Course.countDocuments({ _id: course }, { limit: 1 });
    if (!courseExists) throw Boom.notFound();
  }

  if (company) {
    const companyExists = await Company.countDocuments({ _id: company }, { limit: 1 });
    if (!companyExists) throw Boom.notFound();
  }
  return null;
};

exports.authorizeCourseBillUpdate = async (req) => {
  const courseBill = await CourseBill
    .findOne({ _id: req.params._id })
    .populate({ path: 'payer.company', select: 'address' })
    .populate({ path: 'payer.fundingOrganisation', select: 'address' })
    .populate({ path: 'course', select: 'type prices' })
    .lean();
  if (!courseBill) throw Boom.notFound();
  if (courseBill.mainFee.price && !courseBill.mainFee.percentage && has(req.payload, 'mainFee.percentage')) {
    throw Boom.forbidden();
  }
  if (courseBill.course.type === INTRA && get(req.payload, 'mainFee.countUnit') === TRAINEE) throw Boom.badRequest();
  if (courseBill.course.type === SINGLE) {
    const hasWrongCountUnit = get(req.payload, 'mainFee.countUnit') === GROUP;
    const hasWrongQuantity = has(req.payload, 'mainFee.count') && req.payload.mainFee.count !== 1;
    if (hasWrongCountUnit || hasWrongQuantity) throw Boom.badRequest();
  }
  if (req.payload.payer) {
    if (req.payload.payer.fundingOrganisation) {
      const courseFundingOrganisationExists = await CourseFundingOrganisation
        .countDocuments({ _id: req.payload.payer.fundingOrganisation }, { limit: 1 });

      if (!courseFundingOrganisationExists) throw Boom.notFound();
    } else {
      const companyExists = await Company.countDocuments({ _id: req.payload.payer.company }, { limit: 1 });
      if (!companyExists) throw Boom.notFound();
    }
  }

  if (req.payload.billedAt) {
    if (courseBill.billedAt) throw Boom.forbidden();
    if (!get(courseBill, 'payer.address')) {
      throw Boom.forbidden(translate[language].courseCompanyAddressMissing);
    }

    if (!get(courseBill, 'mainFee.price')) throw Boom.forbidden(translate[language].courseBillPriceMissing);
  }

  if (courseBill.billedAt) {
    const payloadKeys = UtilsHelper
      .getKeysOf2DepthObject(omit(req.payload, ['mainFee.description', 'payer']));
    const areFieldsChanged = payloadKeys.some(key => get(req.payload, key) !== get(courseBill, key)) ||
      !UtilsHelper.areObjectIdsEquals(Object.values(req.payload.payer)[0], courseBill.payer._id);
    if (areFieldsChanged) throw Boom.forbidden();
  }

  if (get(req.payload, 'mainFee.percentage')) {
    if (!get(req.payload, 'mainFee.price')) throw Boom.badRequest();

    const existingCourseBills = await CourseBill
      .find({
        _id: { $ne: courseBill._id },
        course: courseBill.course._id,
        companies: { $in: courseBill.companies },
        'mainFee.percentage': { $exists: true },
      })
      .populate({ path: 'courseCreditNote', options: { isVendorUser: true } })
      .lean();

    const courseBillsWithoutCreditNote = existingCourseBills.filter(cb => !cb.courseCreditNote);

    for (const company of courseBill.companies) {
      const billedPercentageSum = courseBillsWithoutCreditNote
        .filter(bill => UtilsHelper.doesArrayIncludeId(bill.companies, company))
        .reduce((acc, bill) => acc + bill.mainFee.percentage, 0);

      if (billedPercentageSum + req.payload.mainFee.percentage > 100) {
        throw Boom.conflict(translate[language].sumCourseBillsPercentageGreaterThan100);
      }
    }

    const everyCourseBillCompanyHasGlobalPrice = courseBill.companies
      .every(c => get(courseBill, 'course.prices', [])
        .find(p => UtilsHelper.areObjectIdsEquals(p.company, c) && p.global));
    if (!everyCourseBillCompanyHasGlobalPrice) throw Boom.forbidden();
  }

  return null;
};

exports.authorizeCourseBillListEdition = async (req) => {
  const { _ids: courseBillIds, billedAt, payer, maturityDate, mainFee } = req.payload;

  const courseBills = await CourseBill
    .find({ _id: { $in: courseBillIds } }, { billedAt: 1, payer: 1, 'mainFee.price': 1 })
    .populate({ path: 'payer.company', select: 'address' })
    .populate({ path: 'payer.fundingOrganisation', select: 'address' })
    .populate({ path: 'course', select: 'type' })
    .lean();
  if (courseBills.length !== courseBillIds.length) throw Boom.notFound();
  const someBillsAreAlreadyBilled = courseBills.some(bill => bill.billedAt);

  if (billedAt) {
    if (someBillsAreAlreadyBilled) throw Boom.forbidden();

    if (courseBills.some(bill => !get(bill, 'payer.address'))) {
      throw Boom.forbidden(translate[language].courseCompanyAddressMissing);
    }

    if (courseBills.some(bill => !get(bill, 'mainFee.price'))) {
      throw Boom.forbidden(translate[language].courseBillPriceMissing);
    }
  } else {
    const billsAreLinkedToSameCourse = courseBills
      .every(bill => UtilsHelper.areObjectIdsEquals(bill.course._id, courseBills[0].course._id));
    if (!billsAreLinkedToSameCourse) throw Boom.forbidden();
  }

  if (payer) {
    if (someBillsAreAlreadyBilled) throw Boom.forbidden();

    if (payer.fundingOrganisation) {
      const fundingOrganisation = await CourseFundingOrganisation
        .countDocuments({ _id: payer.fundingOrganisation }, { limit: 1 });
      if (!fundingOrganisation) throw Boom.notFound();
    } else {
      const company = await Company.countDocuments({ _id: payer.company }, { limit: 1 });
      if (!company) throw Boom.notFound();
    }
  }

  const isSingleCourse = courseBills[0].course.type === SINGLE;
  if (!isSingleCourse && (get(mainFee, 'price') || maturityDate)) throw Boom.badRequest();

  return null;
};

exports.authorizeCourseBillingPurchaseAddition = async (req) => {
  const { billingItem } = req.payload;
  const billingItemExists = await CourseBillingItem.countDocuments({ _id: billingItem }, { limit: 1 });
  if (!billingItemExists) throw Boom.notFound();

  const courseBill = await CourseBill.findOne({ _id: req.params._id }).lean();
  if (!courseBill) throw Boom.notFound();

  if (courseBill.billingPurchaseList.find(p => UtilsHelper.areObjectIdsEquals(p.billingItem, billingItem))) {
    throw Boom.conflict(translate[language].courseBillingItemAlreadyAdded);
  }

  if (courseBill.billedAt) throw Boom.forbidden();

  return null;
};

exports.authorizeCourseBillingPurchaseUpdate = async (req) => {
  const { _id: courseBillId, billingPurchaseId } = req.params;

  const courseBillRelatedToPurchase = await CourseBill
    .findOne({ _id: courseBillId, 'billingPurchaseList._id': billingPurchaseId })
    .lean();
  if (!courseBillRelatedToPurchase) throw Boom.notFound();

  const payloadKeys = Object.keys(omit(req.payload, 'description'));
  const purchase = courseBillRelatedToPurchase.billingPurchaseList
    .find(p => UtilsHelper.areObjectIdsEquals(p._id, billingPurchaseId));

  const areFieldsChanged = payloadKeys.some(key => get(req.payload, key) !== get(purchase, key));
  const isTrainerFeesWithPercentage = has(purchase, 'percentage') &&
    UtilsHelper.areObjectIdsEquals(purchase.billingItem, process.env.TRAINER_FEES_BILLING_ITEM);
  if (!isTrainerFeesWithPercentage && !(req.payload.price && req.payload.count)) throw Boom.badRequest();
  if ((courseBillRelatedToPurchase.billedAt || isTrainerFeesWithPercentage) && areFieldsChanged) throw Boom.forbidden();

  return null;
};

exports.authorizeCourseBillingPurchaseDelete = async (req) => {
  const { _id: courseBillId, billingPurchaseId } = req.params;

  const courseBill = await CourseBill.findOne({ _id: courseBillId }).lean();
  if (!courseBill) throw Boom.notFound();

  if (courseBill.billedAt) throw Boom.forbidden();

  const purchaseRelatedToBill = courseBill.billingPurchaseList
    .find(p => UtilsHelper.areObjectIdsEquals(p._id, billingPurchaseId));
  if (!purchaseRelatedToBill) throw Boom.notFound();
  const isTrainerFeesWithPercentage = purchaseRelatedToBill.percentage &&
    UtilsHelper.areObjectIdsEquals(purchaseRelatedToBill.billingItem, process.env.TRAINER_FEES_BILLING_ITEM);

  if (isTrainerFeesWithPercentage) throw Boom.forbidden();

  return null;
};

exports.authorizeBillPdfGet = async (req) => {
  const { credentials } = req.auth;
  const userVendorRole = get(credentials, 'role.vendor.name');
  const isAdminVendor = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(userVendorRole);
  const bill = await CourseBill
    .findOne({ _id: req.params._id, billedAt: { $exists: true, $type: 'date' } }, { companies: 1, payer: 1 }).lean();
  if (!bill) throw Boom.notFound();

  if (!isAdminVendor) {
    const hasAccessToCompanies = bill.companies
      .some(company => UtilsHelper.hasUserAccessToCompany(credentials, company));
    const hasAccessToPayer = UtilsHelper.hasUserAccessToCompany(credentials, bill.payer);
    if (!hasAccessToCompanies && !hasAccessToPayer) throw Boom.notFound();
  }

  return [...new Set([...bill.companies.map(c => c.toHexString()), bill.payer.toHexString()])];
};

exports.authorizeCourseBillListDeletion = async (req) => {
  const { _ids: courseBillIds } = req.payload;

  const courseBills = await CourseBill.find({ _id: { $in: courseBillIds } }, { billedAt: 1 }).lean();
  if (courseBills.length !== courseBillIds.length) throw Boom.notFound();

  if (courseBills.some(bill => bill.billedAt)) throw Boom.forbidden();

  return null;
};
