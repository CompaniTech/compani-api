const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Course = require('../../models/Course');
const TrainingContract = require('../../models/TrainingContract');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
const { SINGLE } = require('../../helpers/constants');

const { language } = translate;

exports.authorizeTrainingContractUpload = async (req) => {
  const { course: courseId, company } = req.payload;
  const course = await Course.findOne({ _id: courseId, companies: company }, { type: 1 }).lean();
  if (!course) throw Boom.notFound();

  if (course.type !== SINGLE) {
    const trainingContractAlreadyExists = await TrainingContract.countDocuments({ course: courseId, company });
    if (trainingContractAlreadyExists) throw Boom.forbidden(translate[language].trainingContractAlreadyExists);
  }

  return null;
};

exports.authorizeTrainingContractGet = async (req) => {
  const { course: courseId, company, holding } = req.query;
  const { credentials } = req.auth;
  const isVendorUser = !!get(credentials, 'role.vendor');

  const course = await Course.findOne({ _id: courseId }).lean();
  if (!course) throw Boom.notFound();

  if (isVendorUser) return null;

  if (company) {
    const loggedUserCompany = get(credentials, 'company._id');
    const isCompanyInCourse = UtilsHelper.doesArrayIncludeId(course.companies, company);
    const isLoggedUserInCompany = UtilsHelper.areObjectIdsEquals(loggedUserCompany, company);

    if (!isCompanyInCourse || !isLoggedUserInCompany) throw Boom.forbidden();
  } else if (!holding) {
    throw Boom.badRequest();
  } else {
    const hasHoldingRole = !!get(credentials, 'role.holding');
    const isLoggedUserInHolding = UtilsHelper.areObjectIdsEquals(holding, get(credentials, 'holding._id'));
    const hasHoldingAccessToCourse = course.companies
      .some(c => UtilsHelper.doesArrayIncludeId(get(credentials, 'holding.companies') || [], c)) ||
      UtilsHelper.areObjectIdsEquals(course.holding, get(credentials, 'holding._id'));
    if (!hasHoldingRole || !isLoggedUserInHolding || !hasHoldingAccessToCourse) throw Boom.forbidden();
  }

  return null;
};

exports.authorizeTrainingContractDeletion = async (req) => {
  const { credentials } = req.auth;

  const trainingContract = await TrainingContract
    .findOne({ _id: req.params._id })
    .populate({ path: 'course', select: 'archivedAt' })
    .setOptions({ isVendorUser: !!get(credentials, 'role.vendor') })
    .lean();

  if (!trainingContract) throw Boom.notFound();
  if (get(trainingContract, 'course.archivedAt')) throw Boom.forbidden();

  return null;
};
