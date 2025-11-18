const { ObjectId } = require('mongodb');
const Boom = require('@hapi/boom');
const get = require('lodash/get');
const User = require('../../models/User');
const CourseBill = require('../../models/CourseBill');
const translate = require('../../helpers/translate');
const {
  TRAINER,
  COACH,
  CLIENT_ADMIN,
  TRAINEE,
  SINGLE,
  VAEI,
  BLENDED,
  START_COURSE,
  BEFORE_MIDDLE_COURSE_END_DATE,
  BETWEEN_MID_AND_END_COURSE,
  ENDED,
  END_COURSE,
  MIDDLE_COURSE,
} = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const UserCompaniesHelper = require('../../helpers/userCompanies');
const QuestionnaireHelper = require('../../helpers/questionnaires');

const { language } = translate;

exports.authorizeSendEmail = async (req) => {
  const { credentials } = req.auth;
  const isVendorUser = get(credentials, 'role.vendor') || false;

  const receiver = await User.findOne({ 'local.email': req.payload.email })
    .populate({ path: 'userCompanyList' })
    .populate({ path: 'role.vendor', select: 'name' })
    .populate({ path: 'role.client', select: 'name' })
    .lean();

  if (!receiver) throw Boom.notFound(translate[language].userNotFound);

  const receiverIsTrainer = get(receiver, 'role.vendor.name') === TRAINER;
  const receiverIsCoachOrAdmin = [COACH, CLIENT_ADMIN].includes(get(receiver, 'role.client.name'));
  const vendorIsSendingToAuthorizedType = isVendorUser &&
    (receiverIsTrainer || req.payload.type === TRAINEE || receiverIsCoachOrAdmin);
  const currentAndFutureCompanies = UserCompaniesHelper.getCurrentAndFutureCompanies(receiver.userCompanyList);
  const sameCompany = currentAndFutureCompanies
    .some(company => UtilsHelper.hasUserAccessToCompany(credentials, company));
  if (!vendorIsSendingToAuthorizedType && !sameCompany) throw Boom.notFound();

  return null;
};

const isVAEICourse = (course) => {
  const VAEI_SUBPROGRAM_IDS = process.env.VAEI_SUBPROGRAM_IDS.split(',').map(id => new ObjectId(id));
  return UtilsHelper.doesArrayIncludeId(VAEI_SUBPROGRAM_IDS, course.subProgram);
};

exports.authorizeSendEmailBillList = async (req) => {
  const { bills, type } = req.payload;

  const courseBills = await CourseBill
    .find({ _id: { $in: bills } }, { companies: 1, payer: 1, course: 1, number: 1 })
    .populate({
      path: 'payer',
      populate: [{ path: 'company', select: 'name' }, { path: 'fundingOrganisation', select: 'name' }],
    })
    .populate({ path: 'companies', select: 'name' })
    .populate({
      path: 'course',
      select: 'type format slots subProgram',
      populate: [{ path: 'slots' }, { path: 'slotsToPlan' }],
    })
    .lean();

  if (courseBills.length !== bills.length) throw Boom.notFound(translate[language].courseBillsNotFound);

  const everyCourseIsVAEI = courseBills.every(cb => isVAEICourse(cb.course));
  const everyCourseIsGroupCourse = courseBills.every(cb => cb.course.type !== SINGLE && cb.course.format === BLENDED);

  const courseBillsAreLinkedToSameCourseType = everyCourseIsVAEI || everyCourseIsGroupCourse;
  if (!courseBillsAreLinkedToSameCourseType) throw Boom.forbidden(translate[language].wrongCourseBills.courseType);

  const someCoursesAreNotVAEI = courseBills.some(cb => !isVAEICourse(cb.course));
  if (type === VAEI && someCoursesAreNotVAEI) {
    throw Boom.forbidden(translate[language].wrongCourseBills.someCoursesAreNotVAEI);
  }

  const someCoursesAreVAEI = courseBills.some(cb => isVAEICourse(cb.course));
  if (type !== VAEI && someCoursesAreVAEI) {
    throw Boom.forbidden(translate[language].wrongCourseBills.someCoursesAreVAEI);
  }

  const {
    courseTimeline: firstCourseBillCourseTimeline,
  } = await QuestionnaireHelper.getCourseInfos(courseBills[0].course._id);

  const promises = [];
  courseBills.forEach(cb => promises.push(QuestionnaireHelper.getCourseInfos(cb.course._id)));
  const results = await Promise.all(promises);

  const coursesHaveNotSameTimeline = results.some(res => res.courseTimeline !== firstCourseBillCourseTimeline);
  if (everyCourseIsGroupCourse && coursesHaveNotSameTimeline) {
    throw Boom.forbidden(translate[language].wrongCourseBills.courseTimeline);
  }

  const mappingBetweenTypeAndCourseTimeline = {
    [BEFORE_MIDDLE_COURSE_END_DATE]: START_COURSE,
    [BETWEEN_MID_AND_END_COURSE]: MIDDLE_COURSE,
    [ENDED]: END_COURSE,
  };
  const typeIsWrong = type !== mappingBetweenTypeAndCourseTimeline[firstCourseBillCourseTimeline];
  if (everyCourseIsGroupCourse && typeIsWrong) throw Boom.forbidden(translate[language].wrongCourseBills.wrongType);

  const someBillsAreAlreadyBeenSentButNotEvery = courseBills.some(cb => cb.sendingDates) &&
    courseBills.some(cb => !cb.sendingDates);
  if (someBillsAreAlreadyBeenSentButNotEvery) throw Boom.forbidden(translate[language].someBillsAreAlreadyBeenSent);

  return courseBills;
};
