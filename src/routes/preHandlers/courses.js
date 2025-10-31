const Boom = require('@hapi/boom');
const compact = require('lodash/compact');
const get = require('lodash/get');
const has = require('lodash/has');
const pick = require('lodash/pick');
const isEqual = require('lodash/isEqual');
const { isObjectIdOrHexString } = require('mongoose');
const Course = require('../../models/Course');
const User = require('../../models/User');
const Company = require('../../models/Company');
const CompletionCertificate = require('../../models/CompletionCertificate');
const CompanyHolding = require('../../models/CompanyHolding');
const CourseBill = require('../../models/CourseBill');
const AttendanceSheet = require('../../models/AttendanceSheet');
const Role = require('../../models/Role');
const SubProgram = require('../../models/SubProgram');
const Holding = require('../../models/Holding');
const UserCompany = require('../../models/UserCompany');
const {
  TRAINER,
  INTRA,
  INTER_B2B,
  VENDOR_ADMIN,
  CLIENT_ADMIN,
  COACH,
  TRAINING_ORGANISATION_MANAGER,
  STRICTLY_E_LEARNING,
  BLENDED,
  MOBILE,
  OTHER,
  OPERATIONS,
  CONVOCATION,
  COURSE,
  TRAINEE,
  PEDAGOGY,
  PUBLISHED,
  HOLDING_ADMIN,
  INTRA_HOLDING,
  ALL_WORD,
  PDF,
  OFFICIAL,
  MONTHLY,
  SINGLE,
} = require('../../helpers/constants');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
const CourseHistoriesHelper = require('../../helpers/courseHistories');
const { CompaniDate } = require('../../helpers/dates/companiDates');
const UserCompaniesHelper = require('../../helpers/userCompanies');
const { checkVendorUserExistsAndHasRightRole } = require('./utils');
const {
  EMAIL_VALIDATION,
  COUNTRY_CODE_VALIDATION,
  PHONE_VALIDATION,
  SUFFIX_EMAIL_VALIDATION,
} = require('../../models/utils');

const { language } = translate;

exports.checkAuthorization = (credentials, courseTrainerIds, companies, holding = null) => {
  const userVendorRole = get(credentials, 'role.vendor.name');
  const userClientRole = get(credentials, 'role.client.name');
  const userHoldingRole = get(credentials, 'role.holding.name');
  const userId = get(credentials, '_id');

  const isAdminVendor = userVendorRole === VENDOR_ADMIN;
  const isTOM = userVendorRole === TRAINING_ORGANISATION_MANAGER;
  const isTrainerAndAuthorized = userVendorRole === TRAINER && UtilsHelper.doesArrayIncludeId(courseTrainerIds, userId);

  const hasAccessToHolding = UtilsHelper.areObjectIdsEquals(holding, get(credentials, 'holding._id'));
  const hasAccessToCompany = companies.some(company => UtilsHelper.hasUserAccessToCompany(credentials, company));
  const isHoldingAndAuthorized = userHoldingRole === HOLDING_ADMIN && hasAccessToHolding;
  const isClientAndAuthorized = [CLIENT_ADMIN, COACH].includes(userClientRole) && hasAccessToCompany;

  if (!isAdminVendor && !isTOM && !isTrainerAndAuthorized && !isClientAndAuthorized && !isHoldingAndAuthorized) {
    throw Boom.forbidden();
  }
};

exports.checkCompanyRepresentativeExists = async (req, course, isRofOrAdmin) => {
  const { credentials } = req.auth;
  if (course.type === INTER_B2B) throw Boom.forbidden();
  const isIntraHoldingCourse = course.type === INTRA_HOLDING;
  const isIntraOrSingleCourse = [INTRA, SINGLE].includes(course.type);
  const isHoldingAdmin = get(req, 'auth.credentials.role.holding.name') === HOLDING_ADMIN;
  const hasAccessToCompany = course.companies.some(c => UtilsHelper.hasUserAccessToCompany(credentials, c));
  if (isIntraHoldingCourse && !(isRofOrAdmin || isHoldingAdmin)) throw Boom.forbidden();
  if (isIntraOrSingleCourse && !isRofOrAdmin && !hasAccessToCompany) throw Boom.forbidden();

  const companyRepresentative = await User
    .findOne({ _id: req.payload.companyRepresentative }, { role: 1 })
    .populate({ path: 'company' })
    .populate({ path: 'holding' })
    .lean({ autopopulate: true });

  if (![COACH, CLIENT_ADMIN].includes(get(companyRepresentative, 'role.client.name'))) throw Boom.forbidden();

  const companyRepIsNotFromIntraOrSingleCourseCompany = [INTRA, SINGLE].includes(course.type) &&
  !UtilsHelper.areObjectIdsEquals(companyRepresentative.company, course.companies[0]);
  if (companyRepIsNotFromIntraOrSingleCourseCompany) {
    if (get(companyRepresentative, 'role.holding.name') !== HOLDING_ADMIN) throw Boom.forbidden();

    const companyRepresentativeHolding = await CompanyHolding
      .findOne({ company: companyRepresentative.company })
      .lean();
    const courseCompanyHolding = await CompanyHolding.findOne({ company: course.companies[0] }).lean();

    if (!UtilsHelper.areObjectIdsEquals(companyRepresentativeHolding.holding, courseCompanyHolding.holding)) {
      throw Boom.notFound();
    }
  } else if (course.type === INTRA_HOLDING) {
    const hasCompRepHoldingAdminRole = [HOLDING_ADMIN].includes(get(companyRepresentative, 'role.holding.name'));
    const isCompRepFromCourseHolding = UtilsHelper.areObjectIdsEquals(companyRepresentative.holding, course.holding);
    if (!(hasCompRepHoldingAdminRole && isCompRepFromCourseHolding)) throw Boom.forbidden();
  }

  return null;
};

exports.checkContact = (req, course, isRofOrAdmin) => {
  const isCompanyRepContactAndUpdated = !!get(req, 'payload.companyRepresentative') &&
    UtilsHelper.areObjectIdsEquals(course.companyRepresentative, get(course, 'contact._id'));
  if (!isRofOrAdmin && !isCompanyRepContactAndUpdated) throw Boom.forbidden();

  const payloadInterlocutors = pick(req.payload, ['operationsRepresentative', 'trainer', 'companyRepresentative']);
  const courseInterlocutors = pick(course, ['operationsRepresentative', 'trainers', 'companyRepresentative']);
  const interlocutors = { ...courseInterlocutors, ...payloadInterlocutors };
  const interlocutorIds = Object.values(interlocutors).flat();

  if (!UtilsHelper.doesArrayIncludeId(interlocutorIds, req.payload.contact)) throw Boom.forbidden();
};

exports.authorizeCourseCreation = async (req) => {
  await checkVendorUserExistsAndHasRightRole(req.payload.operationsRepresentative, true);

  const subProgram = await SubProgram
    .findOne({ _id: req.payload.subProgram })
    .populate({ path: 'steps', select: 'type' })
    .lean({ virtuals: true });

  if (!subProgram) throw Boom.notFound();
  if (subProgram.status !== PUBLISHED || subProgram.isStrictlyELearning) throw Boom.forbidden();

  if (get(req, 'payload.company')) {
    const { company } = req.payload;

    const companyExists = await Company.countDocuments({ _id: company });
    if (!companyExists) throw Boom.notFound();
  } else if (get(req, 'payload.holding')) {
    const { holding } = req.payload;

    const holdingExists = await Holding.countDocuments({ _id: holding });
    if (!holdingExists) throw Boom.notFound();
  }

  if (get(req, 'payload.salesRepresentative')) {
    await checkVendorUserExistsAndHasRightRole(req.payload.salesRepresentative, true);
  }

  if (get(req, 'payload.trainee')) {
    const isTraineeExists = await UserCompany.countDocuments({
      user: req.payload.trainee,
      $or: [{ endDate: { $gt: CompaniDate().toISO() } }, { endDate: { $exists: false } }],
    });
    if (!isTraineeExists) throw Boom.notFound();
  }

  return null;
};

exports.authorizeGetDocuments = async (req) => {
  const { credentials } = req.auth;

  const course = await Course
    .findOne({ _id: req.params._id }, { trainees: 1, companies: 1, trainers: 1, type: 1, holding: 1 })
    .lean();
  if (!course) throw Boom.notFound();

  const isTrainee = UtilsHelper.doesArrayIncludeId(course.trainees, get(credentials, '_id'));
  if (isTrainee && (get(req, 'query.origin') === MOBILE || get(req, 'query.format') === PDF)) return null;

  const courseTrainerId = get(course, 'trainers') || [];
  const holding = course.type === INTRA_HOLDING ? course.holding : null;
  this.checkAuthorization(credentials, courseTrainerId, course.companies, holding);

  return null;
};

exports.authorizeGetCompletionCertificates = async (req) => {
  const { auth, query: { format, type } } = req;

  const userVendorRole = get(auth, 'credentials.role.vendor.name');
  const isRofOrAdmin = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(userVendorRole);

  const userClientRole = get(auth, 'credentials.role.client.name');
  const isCoachOrAdmin = [COACH, CLIENT_ADMIN].includes(userClientRole);

  if (format === ALL_WORD && !isRofOrAdmin) throw Boom.forbidden();
  if (type === OFFICIAL && !isRofOrAdmin && !isCoachOrAdmin) throw Boom.forbidden();

  return null;
};

const checkCertification = async (payload, course, isRofOrAdmin) => {
  if (has(payload, 'hasCertifyingTest')) {
    if (!isRofOrAdmin) throw Boom.forbidden();
    const certifiedTraineesCount = get(payload, 'certifiedTrainees.length') ||
      get(course, 'certifiedTrainees.length');
    if (certifiedTraineesCount && !payload.hasCertifyingTest) throw Boom.conflict();
  }

  if (get(payload, 'certifiedTrainees')) {
    if (!isRofOrAdmin) throw Boom.forbidden();

    const doesCourseHaveCertification = course.hasCertifyingTest || payload.hasCertifyingTest;
    if (!doesCourseHaveCertification) throw Boom.conflict();

    const areEveryTraineeInCourse = payload.certifiedTrainees
      .every(trainee => UtilsHelper.doesArrayIncludeId(course.trainees, trainee));
    if (!areEveryTraineeInCourse) throw Boom.notFound();
  }
};

const checkInterlocutors = async (payload, course, isRofOrAdmin, req) => {
  if (get(payload, 'operationsRepresentative')) {
    await checkVendorUserExistsAndHasRightRole(payload.operationsRepresentative, isRofOrAdmin);
  }

  if (get(payload, 'companyRepresentative')) {
    await this.checkCompanyRepresentativeExists(req, course, isRofOrAdmin);
  }

  if (get(payload, 'contact')) this.checkContact(req, course, isRofOrAdmin);

  if (get(payload, 'salesRepresentative')) {
    await checkVendorUserExistsAndHasRightRole(payload.salesRepresentative, isRofOrAdmin);
  }
};

exports.authorizeCourseEdit = async (req) => {
  try {
    const { auth: { credentials }, payload, params } = req;
    const course = await Course
      .findOne({ _id: params._id })
      .populate({ path: 'slots', select: 'startDate endDate' })
      .populate({ path: 'slotsToPlan' })
      .populate({ path: 'contact' })
      .lean();
    if (!course) throw Boom.notFound();

    const userVendorRole = get(credentials, 'role.vendor.name');
    const isRofOrAdmin = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(userVendorRole);

    const unarchiveCourse = has(payload, 'archivedAt') && payload.archivedAt === '';
    if (course.archivedAt && !unarchiveCourse) throw Boom.forbidden();

    if (has(payload, 'interruptedAt')) {
      if (!isRofOrAdmin) throw Boom.forbidden();

      const interruptAnInterruptedCourse = course.interruptedAt && payload.interruptedAt;
      const restartACourseInProgress = !course.interruptedAt && payload.interruptedAt === '';
      if (interruptAnInterruptedCourse || restartACourseInProgress) throw Boom.conflict();
    }

    const courseTrainerIds = get(course, 'trainers', []);
    const companies = [INTRA, INTRA_HOLDING, SINGLE].includes(course.type) ? course.companies : [];
    const holding = course.type === INTRA_HOLDING ? course.holding : null;
    this.checkAuthorization(credentials, courseTrainerIds, companies, holding);

    await checkCertification(payload, course, isRofOrAdmin);

    await checkInterlocutors(payload, course, isRofOrAdmin, req);

    if (get(payload, 'maxTrainees')) {
      if (!isRofOrAdmin) throw Boom.forbidden();
      if (course.type === INTER_B2B) throw Boom.badRequest();
      if (payload.maxTrainees < course.trainees.length) {
        throw Boom.forbidden(translate[language].maxTraineesSmallerThanRegistered);
      }
    }

    if (has(payload, 'expectedBillsCount')) {
      if (!isRofOrAdmin) throw Boom.forbidden();
      if (![INTRA, SINGLE].includes(course.type)) throw Boom.badRequest();

      const courseBills = await CourseBill.find({ course: course._id }, { courseCreditNote: 1 })
        .populate({ path: 'courseCreditNote', options: { isVendorUser: true } })
        .setOptions({ isVendorUser: true })
        .lean();

      const courseBillsWithoutCreditNote = courseBills.filter(cb => !cb.courseCreditNote);
      if (courseBillsWithoutCreditNote.length > payload.expectedBillsCount) throw Boom.conflict();
    }

    if (has(payload, 'prices')) {
      const { global, company } = payload.prices;
      if (!isRofOrAdmin) throw Boom.forbidden();

      const courseBills = await CourseBill.countDocuments({ course: course._id, companies: company });

      if (courseBills && course.type !== SINGLE) throw Boom.forbidden();

      const globalPriceExist = global ||
        (course.prices && course.prices.find(p => UtilsHelper.areObjectIdsEquals(p.company, company)).global);
      if (has(payload, 'prices.trainerFees') && !globalPriceExist) throw Boom.forbidden();

      if (!UtilsHelper.doesArrayIncludeId(course.companies, company)) throw Boom.forbidden();
    }

    const archivedAt = get(req, 'payload.archivedAt');
    if (archivedAt || unarchiveCourse) {
      if (!isRofOrAdmin) return Boom.forbidden();

      if (course.format !== BLENDED) return Boom.forbidden();
      if (unarchiveCourse && !course.archivedAt) throw Boom.conflict();
    }

    if (get(req, 'payload.estimatedStartDate') && (course.slots.length || !isRofOrAdmin)) return Boom.forbidden();

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const authorizeGetListForOperations = (credentials, query) => {
  if (query.holding) {
    if (!get(credentials, 'holding._id') || !UtilsHelper.areObjectIdsEquals(credentials.holding._id, query.holding)) {
      throw Boom.forbidden();
    }
  } else {
    this.checkAuthorization(credentials, [query.trainer], [query.company]);
  }

  return null;
};

const authorizeGetListForPedagogy = async (credentials, query) => {
  const loggedUserCompany = get(credentials, 'company._id');
  const loggedUserVendorRole = get(credentials, 'role.vendor.name');
  const loggedUserClientRole = get(credentials, 'role.client.name');
  const loggedUserHolding = get(credentials, 'holding._id');

  if (!query.trainee) return null;

  const trainee = await User.findOne({ _id: query.trainee }).populate({ path: 'company' }).lean();
  if (!trainee) return Boom.notFound();

  const isRofOrAdmin = [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(loggedUserVendorRole);
  if (isRofOrAdmin) return null;

  const hasLoggedUserAccessToTrainee = UtilsHelper.hasUserAccessToCompany(credentials, trainee.company._id);
  const isAllowedToAccessQuery = query.company
    ? UtilsHelper.areObjectIdsEquals(loggedUserCompany, query.company)
    : UtilsHelper.areObjectIdsEquals(loggedUserHolding, query.holding);
  const isCoachOrAdmin = [COACH, CLIENT_ADMIN].includes(loggedUserClientRole);
  if (!(isCoachOrAdmin && isAllowedToAccessQuery && hasLoggedUserAccessToTrainee)) throw Boom.forbidden();

  return null;
};

exports.authorizeGetList = async (req) => {
  const { credentials } = req.auth;
  const { action, format } = req.query;

  if (has(req.query, 'isArchived') && format !== BLENDED) throw Boom.badRequest();

  if (action === OPERATIONS) return authorizeGetListForOperations(credentials, req.query);

  return authorizeGetListForPedagogy(credentials, req.query);
};

exports.authorizeTraineeAddition = async (req) => {
  try {
    const { payload } = req;
    const course = await Course
      .findOne(
        { _id: req.params._id },
        { trainees: 1, type: 1, companies: 1, maxTrainees: 1, trainers: 1, hasCertifyingTest: 1, tutors: 1 }
      )
      .lean();

    if (course.type === SINGLE) throw Boom.forbidden();

    if (course.trainees.length + 1 > course.maxTrainees) throw Boom.forbidden(translate[language].maxTraineesReached);

    const traineeIsTrainer = UtilsHelper.doesArrayIncludeId(course.trainers, payload.trainee);
    if (traineeIsTrainer) throw Boom.forbidden(translate[language].courseTraineeIsTrainer);

    const traineeIsTutor = UtilsHelper.doesArrayIncludeId(course.tutors, payload.trainee);
    if (traineeIsTutor) throw Boom.forbidden(translate[language].courseTraineeIsTutor);

    const traineeAlreadyRegistered = course.trainees.some(t => UtilsHelper.areObjectIdsEquals(t, payload.trainee));
    if (traineeAlreadyRegistered) throw Boom.conflict(translate[language].courseTraineeAlreadyExists);

    const trainee = await User.findOne({ _id: payload.trainee }, { _id: 1 })
      .populate({ path: 'userCompanyList' })
      .lean();
    if (!trainee) throw Boom.notFound();

    const isRofOrAdmin = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
      .includes(get(req, 'auth.credentials.role.vendor.name'));

    if (payload.isCertified && !(isRofOrAdmin && course.hasCertifyingTest)) throw Boom.forbidden();

    if (course.type === INTRA) {
      if (payload.company) throw Boom.badData();
      if (!UserCompaniesHelper.userIsOrWillBeInCompany(trainee.userCompanyList, course.companies[0])) {
        throw Boom.notFound();
      }
    } else {
      if (!payload.company) throw Boom.badData();
      const isTrainer = get(req, 'auth.credentials.role.vendor.name') === TRAINER;
      const clientRole = get(req, 'auth.credentials.role.client.name');
      const holdingRole = get(req, 'auth.credentials.role.holding.name');
      const hasNoClientOrHoldingRoleOnIntraHolding = course.type === INTRA_HOLDING &&
        !([COACH, CLIENT_ADMIN].includes(clientRole) || holdingRole === HOLDING_ADMIN);
      if ((course.type === INTER_B2B || hasNoClientOrHoldingRoleOnIntraHolding) && isTrainer) throw Boom.forbidden();

      const currentAndFuturCompanies = UserCompaniesHelper.getCurrentAndFutureCompanies(trainee.userCompanyList);
      if (!UtilsHelper.doesArrayIncludeId(currentAndFuturCompanies, payload.company)) throw Boom.notFound();
      if (!UtilsHelper.doesArrayIncludeId(course.companies, payload.company)) throw Boom.forbidden();

      if (course.type === INTRA_HOLDING) {
        const loggedUserCompany = get(req, 'auth.credentials.company._id');
        const isClientRoleWithoutVendorOrHoldingRole = [COACH, CLIENT_ADMIN].includes(clientRole) && !isRofOrAdmin &&
          !holdingRole;
        if (isClientRoleWithoutVendorOrHoldingRole &&
            !UtilsHelper.areObjectIdsEquals(payload.company, loggedUserCompany)) {
          throw Boom.forbidden();
        }
      }
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeTraineeDeletion = async (req) => {
  const vendorRole = get(req, 'auth.credentials.role.vendor.name');
  const course = await Course
    .findOne({ _id: req.params._id }, { type: 1, trainees: 1, certificateGenerationMode: 1 })
    .lean();

  if (course.type === SINGLE) throw Boom.forbidden();

  if (!UtilsHelper.doesArrayIncludeId(course.trainees, req.params.traineeId)) throw Boom.forbidden();

  const isRofOrAdmin = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(vendorRole);
  if (course.type === INTER_B2B && !isRofOrAdmin) throw Boom.forbidden();
  if (course.type === INTRA_HOLDING) {
    const isCoachOrAdmin = [COACH, CLIENT_ADMIN].includes(get(req, 'auth.credentials.role.client.name'));
    const hasHoldingRole = get(req, 'auth.credentials.role.holding.name') === HOLDING_ADMIN;
    if (vendorRole === TRAINER && !(isCoachOrAdmin || hasHoldingRole)) throw Boom.forbidden();

    const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper.getCompanyAtCourseRegistrationList(
      { key: COURSE, value: req.params._id }, { key: TRAINEE, value: [req.params.traineeId] }
    );
    const companiesAtRegistration = traineesCompanyAtCourseRegistration[0].company;
    const isTraineeFromCompany = UtilsHelper
      .areObjectIdsEquals(get(req, 'auth.credentials.company._id'), companiesAtRegistration);
    if (isCoachOrAdmin && !isTraineeFromCompany && !(isRofOrAdmin || hasHoldingRole)) throw Boom.notFound();
  }
  if (course.certificateGenerationMode === MONTHLY) {
    const completionCertificatesCount = await CompletionCertificate
      .countDocuments({ course: course._id, trainee: req.params.traineeId });
    if (completionCertificatesCount) throw Boom.forbidden(translate[language].traineeLinkedToCompletionCertificate);
  }

  return null;
};

exports.authorizeCourseDeletion = async (req) => {
  const course = await Course.findOne({ _id: req.params._id }, { trainees: 1 })
    .populate({ path: 'slots', select: '_id' })
    .populate({ path: 'slotsToPlan', select: '_id' })
    .lean();
  if (!course) return Boom.notFound();

  if (course.trainees.length) return Boom.forbidden(translate[language].courseDeletionForbidden.trainees);
  if (course.slots.length) {
    return Boom.forbidden(translate[language].courseDeletionForbidden.slots);
  }

  const attendanceSheets = await AttendanceSheet.countDocuments({ course: req.params._id }, { limit: 1 });
  if (attendanceSheets) return Boom.forbidden(translate[language].courseDeletionForbidden.attendanceSheets);

  const courseBills = await CourseBill.countDocuments(
    { course: req.params._id, billedAt: { $exists: true, $type: 'date' } },
    { limit: 1 }
  );
  if (courseBills) return Boom.forbidden(translate[language].courseDeletionForbidden.billed);

  return null;
};

exports.authorizeRegisterToELearning = async (req) => {
  const course = await Course.findById(req.params._id).lean();

  if (!course) throw Boom.notFound();
  if (course.format !== STRICTLY_E_LEARNING) throw Boom.forbidden();

  const credentials = get(req, 'auth.credentials');
  if (course.trainees.some(trainee =>
    UtilsHelper.areObjectIdsEquals(trainee, get(credentials, '_id')))) throw Boom.forbidden();

  const { accessRules } = course;
  const companyId = get(credentials, 'company._id');
  if (accessRules.length &&
    (!companyId || !accessRules.some(id => UtilsHelper.areObjectIdsEquals(id, companyId)))) throw Boom.forbidden();

  return null;
};

exports.authorizeGetCourse = async (req) => {
  try {
    const credentials = get(req, 'auth.credentials');

    const course = await Course
      .findOne(
        { _id: req.params._id },
        { trainers: 1, format: 1, trainees: 1, companies: 1, accessRules: 1, holding: 1, tutors: 1 }
      )
      .lean();
    if (!course) throw Boom.notFound();

    if (!credentials) {
      if ([PEDAGOGY, OPERATIONS].includes(req.query.action)) throw Boom.badRequest();
      return null;
    }

    const userCompany = get(credentials, 'company._id');
    const userVendorRole = get(credentials, 'role.vendor.name');
    const userClientRole = get(credentials, 'role.client.name');
    const isAdminVendor = userVendorRole === VENDOR_ADMIN;
    const isTOM = userVendorRole === TRAINING_ORGANISATION_MANAGER;
    if (isTOM || isAdminVendor) return null;

    const isTrainee = UtilsHelper.doesArrayIncludeId(course.trainees, credentials._id);
    const isTutor = UtilsHelper.doesArrayIncludeId(course.tutors, credentials._id);

    if (isTrainee || isTutor) return null;

    const isTrainerAndAuthorized = userVendorRole === TRAINER &&
      UtilsHelper.doesArrayIncludeId(course.trainers, credentials._id);
    if (isTrainerAndAuthorized) return null;

    if (!userClientRole || ![COACH, CLIENT_ADMIN].includes(userClientRole)) throw Boom.forbidden();

    const companyHasAccess = !course.accessRules.length ||
      UtilsHelper.doesArrayIncludeId(course.accessRules, userCompany);
    if (course.format === STRICTLY_E_LEARNING && !companyHasAccess) throw Boom.forbidden();

    if (course.format === BLENDED) {
      const clientUserHasAccessToCompanies = course.companies
        .some(company => UtilsHelper.hasUserAccessToCompany(credentials, company));

      const clientUserHasAccessToHolding = UtilsHelper
        .areObjectIdsEquals(course.holding, get(credentials, 'holding._id'));
      if (!clientUserHasAccessToCompanies && !clientUserHasAccessToHolding) throw Boom.forbidden();
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeAccessRuleAddition = async (req) => {
  const course = await Course.findById(req.params._id, 'accessRules').lean();
  if (!course) throw Boom.notFound();

  const accessRuleAlreadyExist = req.payload.companies
    .some(companyId => UtilsHelper.doesArrayIncludeId(course.accessRules, companyId));
  if (accessRuleAlreadyExist) throw Boom.conflict();

  const companiesExists = await Company.countDocuments({ _id: { $in: req.payload.companies } });
  if (companiesExists !== req.payload.companies.length) throw Boom.notFound();

  return null;
};

exports.authorizeAccessRuleDeletion = async (req) => {
  const course = await Course.countDocuments({ _id: req.params._id, accessRules: req.params.accessRuleId });

  if (!course) throw Boom.notFound();

  return null;
};

exports.authorizeGetFollowUp = async (req) => {
  const credentials = get(req, 'auth.credentials');
  const loggedUserVendorRole = get(credentials, 'role.vendor.name');
  const loggedUserClientRole = get(credentials, 'role.client.name');

  const isClientAndAuthorized = !!req.query.company && [CLIENT_ADMIN, COACH].includes(loggedUserClientRole) &&
    UtilsHelper.areObjectIdsEquals(get(credentials, 'company._id'), req.query.company);

  const isHoldingAndAuthorized = !!req.query.holding &&
    UtilsHelper.areObjectIdsEquals(get(credentials, 'holding._id'), req.query.holding);

  if (req.query.trainee) {
    const course = await Course.findOne({ _id: req.params._id }, { trainees: 1, tutors: 1 }).lean();
    if (!UtilsHelper.doesArrayIncludeId(course.trainees, req.query.trainee)) throw Boom.notFound();
    if (!UtilsHelper.doesArrayIncludeId(course.tutors, credentials._id)) throw Boom.forbidden();

    return null;
  }

  if (!loggedUserVendorRole && !isClientAndAuthorized && !isHoldingAndAuthorized) throw Boom.forbidden();

  return null;
};

exports.authorizeGetQuestionnaires = async (req) => {
  const credentials = get(req, 'auth.credentials');
  const countQuery = get(credentials, 'role.vendor.name') === TRAINER
    ? { _id: req.params._id, format: BLENDED, trainers: credentials._id }
    : { _id: req.params._id, format: BLENDED };
  const course = await Course.countDocuments(countQuery);
  if (!course) throw Boom.notFound();

  return null;
};

exports.authorizeGetAttendanceSheets = async (req) => {
  const { credentials } = req.auth;
  const userVendorRole = get(credentials, 'role.vendor.name');

  const course = await Course.findOne({ _id: req.params._id }, { type: 1, format: 1 }).lean();
  if (!course) throw Boom.notFound();
  if (course.format === STRICTLY_E_LEARNING || (course.type === INTER_B2B && !userVendorRole)) throw Boom.forbidden();

  return null;
};

const canAccessSms = (course, credentials) => {
  const userVendorRole = get(credentials, 'role.vendor.name');
  const userHoldingRole = get(credentials, 'role.holding.name');
  if (course.type === INTRA_HOLDING && !(userVendorRole || userHoldingRole)) throw Boom.forbidden();

  const courseTrainerIds = get(course, 'trainers') || [];
  const companies = [INTRA, INTRA_HOLDING, SINGLE].includes(course.type) ? course.companies : [];
  const holding = course.type === INTRA_HOLDING ? course.holding : null;
  this.checkAuthorization(credentials, courseTrainerIds, companies, holding);

  return null;
};

exports.authorizeSmsSending = async (req) => {
  const course = await Course
    .findById(req.params._id, { slots: 1, trainees: 1, type: 1, companies: 1, trainers: 1, holding: 1 })
    .populate({ path: 'slots', select: 'endDate' })
    .populate({ path: 'trainees', select: 'contact.phone' })
    .lean();
  if (!course) throw Boom.notFound();

  canAccessSms(course, req.auth.credentials);

  const isFinished = !course.slots || !course.slots.some(slot => CompaniDate().isBefore(slot.endDate));
  const isStarted = course.slots && course.slots.some(slot => CompaniDate().isAfter(slot.endDate));
  const noReceiver = !course.trainees || !course.trainees.some(trainee => get(trainee, 'contact.phone'));
  if ((isFinished && req.payload.type !== OTHER) || (isStarted && req.payload.type === CONVOCATION) || noReceiver) {
    throw Boom.forbidden();
  }

  return null;
};

exports.authorizeSmsGet = async (req) => {
  const course = await Course
    .findById(req.params._id, { type: 1, companies: 1, trainers: 1, holding: 1 })
    .lean();
  if (!course) throw Boom.notFound();

  return canAccessSms(course, req.auth.credentials);
};

exports.authorizeCourseCompanyAddition = async (req) => {
  const vendorRole = get(req, 'auth.credentials.role.vendor.name');
  const holdingRole = get(req, 'auth.credentials.role.holding.name');

  if (vendorRole === TRAINER && !holdingRole) throw Boom.forbidden();

  const company = await Company.countDocuments({ _id: req.payload.company });
  if (!company) throw Boom.notFound();

  const course = await Course.findOne({ _id: req.params._id }, { type: 1, companies: 1, holding: 1 }).lean();

  if ([INTRA, SINGLE].includes(course.type)) throw Boom.forbidden();

  const isAlreadyLinked = UtilsHelper.doesArrayIncludeId(course.companies, req.payload.company);
  if (isAlreadyLinked) throw Boom.conflict(translate[language].courseCompanyAlreadyExists);

  if (course.type === INTRA_HOLDING) {
    const isCompanyInCourseHolding = await CompanyHolding
      .countDocuments({ company: req.payload.company, holding: course.holding });

    if (!isCompanyInCourseHolding) throw Boom.notFound();

    if ([TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(vendorRole)) return null;

    const userHolding = get(req, 'auth.credentials.holding._id');
    if (!(holdingRole === HOLDING_ADMIN && UtilsHelper.areObjectIdsEquals(course.holding, userHolding))) {
      throw Boom.forbidden();
    }
  }

  return null;
};

exports.authorizeCourseCompanyDeletion = async (req) => {
  const { companyId } = req.params;
  const holdingRole = get(req, 'auth.credentials.role.holding.name');

  const course = await Course.findOne({ _id: req.params._id })
    .populate({ path: 'bills', select: 'companies', match: { companies: companyId } })
    .populate({
      path: 'slots',
      select: 'attendances',
      populate: {
        path: 'attendances',
        select: 'company',
        match: { company: companyId },
      },
    })
    .lean();

  if ([INTRA, SINGLE].includes(course.type) || !UtilsHelper.doesArrayIncludeId(course.companies, companyId)) {
    throw Boom.forbidden();
  }

  if (course.type === INTRA_HOLDING) {
    const isHoldingAdminFromCourse = holdingRole === HOLDING_ADMIN &&
      UtilsHelper.areObjectIdsEquals(course.holding, get(req, 'auth.credentials.holding._id'));
    const isRofOrAdmin = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
      .includes(get(req, 'auth.credentials.role.vendor.name'));

    if (!isRofOrAdmin && !isHoldingAdminFromCourse) throw Boom.forbidden();
  }

  const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper.getCompanyAtCourseRegistrationList(
    { key: COURSE, value: req.params._id }, { key: TRAINEE, value: course.trainees }
  );
  const companiesAtRegistration = traineesCompanyAtCourseRegistration.map(traineeCompany => traineeCompany.company);

  if (UtilsHelper.doesArrayIncludeId(companiesAtRegistration, companyId)) {
    throw Boom.forbidden(translate[language].companyTraineeRegisteredToCourse);
  }

  const hasAttendancesFromCompany = course.slots.some(slot =>
    slot.attendances.some(attendance => UtilsHelper.areObjectIdsEquals(companyId, attendance.company)));
  if (course.type !== INTRA_HOLDING && hasAttendancesFromCompany) {
    throw Boom.forbidden(translate[language].companyTraineeAttendedToCourse);
  }

  const attendanceSheets = await AttendanceSheet
    .find({ course: course._id, companies: companyId }, { companies: 1 })
    .lean();

  const hasAttendanceSheetsFromCompany = attendanceSheets
    .some(sheet => UtilsHelper.doesArrayIncludeId(sheet.companies, companyId));
  if (hasAttendanceSheetsFromCompany) throw Boom.forbidden(translate[language].companyHasAttendanceSheetForCourse);

  if (course.bills.some(bill => UtilsHelper.doesArrayIncludeId(bill.companies, companyId))) {
    throw Boom.forbidden(translate[language].companyHasCourseBill);
  }

  const isTrainer = get(req, 'auth.credentials.role.vendor.name') === TRAINER;
  if (isTrainer && !holdingRole) throw Boom.forbidden();

  return null;
};

exports.authorizeGetConvocationPdf = async (req) => {
  const course = await Course.countDocuments({ _id: req.params._id });
  if (!course) throw Boom.notFound();

  return null;
};

exports.authorizeGenerateTrainingContract = async (req) => {
  const course = await Course
    .findOne({ _id: req.params._id }, { _id: 1 })
    .populate([
      { path: 'companies', select: 'address' },
      {
        path: 'subProgram',
        select: 'steps',
        populate: [{ path: 'steps', select: 'theoreticalDuration type' }],
      },
    ])
    .lean();

  if (!course) throw Boom.notFound();

  const company = course.companies.find(c => UtilsHelper.areObjectIdsEquals(c._id, req.payload.company));
  if (!company) throw Boom.forbidden();
  if (!company.address) throw Boom.forbidden(translate[language].courseCompanyAddressMissing);

  return null;
};

exports.authorizeTrainerAddition = async (req) => {
  const { payload, params } = req;

  const course = await Course.findOne({ _id: params._id }, { trainers: 1, trainees: 1, archivedAt: 1 }).lean();
  if (!course) throw Boom.notFound();
  if (course.archivedAt) throw Boom.forbidden();

  await checkVendorUserExistsAndHasRightRole(payload.trainer, true, true);

  const trainerIsTrainee = UtilsHelper.doesArrayIncludeId(course.trainees, payload.trainer);
  if (trainerIsTrainee) throw Boom.forbidden(translate[language].courseTrainerIsTrainee);

  const trainerIsAlreadyCourseTrainer = UtilsHelper.doesArrayIncludeId(get(course, 'trainers', []), payload.trainer);
  if (trainerIsAlreadyCourseTrainer) throw Boom.conflict(translate[language].courseTrainerAlreadyAdded);

  return null;
};

exports.authorizeTrainerDeletion = async (req) => {
  const { params } = req;

  const course = await Course.findOne({ _id: params._id }, { trainers: 1, archivedAt: 1 }).lean();
  if (!course) throw Boom.notFound();
  if (course.archivedAt) throw Boom.forbidden();

  const trainerIsCourseTrainer = UtilsHelper.doesArrayIncludeId(course.trainers, params.trainerId);
  if (!trainerIsCourseTrainer) throw Boom.forbidden();

  return null;
};

exports.authorizeTutorAddition = async (req) => {
  const { params, payload } = req;

  const course = await Course
    .findOne({ _id: params._id }, { tutors: 1, trainees: 1, archivedAt: 1, companies: 1, type: 1 })
    .lean();
  if (!course) throw Boom.notFound();
  if (course.archivedAt) throw Boom.forbidden();

  if (course.type !== SINGLE) throw Boom.forbidden();

  const user = await User.findOne({ _id: payload.tutor }).populate({ path: 'company' }).lean();
  const userInCompany = UtilsHelper.doesArrayIncludeId(course.companies, user.company);
  if (!userInCompany) throw Boom.forbidden();

  const tutorIsTrainee = UtilsHelper.doesArrayIncludeId(course.trainees, payload.tutor);
  if (tutorIsTrainee) throw Boom.forbidden(translate[language].courseTutorIsTrainee);

  const tutorAlreadyInCourse = UtilsHelper.doesArrayIncludeId(get(course, 'tutors', []), payload.tutor);
  if (tutorAlreadyInCourse) throw Boom.conflict(translate[language].courseTutorAlreadyAdded);

  return null;
};

exports.authorizeTutorDeletion = async (req) => {
  const { params } = req;

  const course = await Course.findOne({ _id: params._id }, { tutors: 1, archivedAt: 1 }).lean();
  if (!course) throw Boom.notFound();
  if (course.archivedAt) throw Boom.forbidden();

  const tutorIsCourseTutor = UtilsHelper.doesArrayIncludeId(course.tutors, params.tutorId);
  if (!tutorIsCourseTutor) throw Boom.forbidden();

  return null;
};

exports.authorizeUploadTraineeCSV = async (req) => {
  const { params, payload } = req;

  const course = await Course
    .findOne({ _id: params._id }, { type: 1, tutors: 1, archivedAt: 1, companies: 1, trainees: 1, maxTrainees: 1 })
    .lean();
  if (!course) throw Boom.notFound();
  if (course.type === SINGLE) throw Boom.forbidden();

  const learnerList = await UtilsHelper.parseCsv(payload.file);

  const allowedKeys = ['firstname', 'lastname', 'email', 'phone', 'countryCode', 'company', 'suffix'].sort();
  if (!isEqual(Object.keys(learnerList[0]).sort(), allowedKeys)) {
    throw Boom.badRequest(translate[language].wrongColumnsInCsv);
  }

  if (course.maxTrainees && course.trainees.length + learnerList.length > course.maxTrainees) {
    throw Boom.forbidden(translate[language].maxTraineesReached);
  }
  const formattedLearnerList = [];
  const emailsList = compact(learnerList.map(l => l.email));
  if (emailsList.length !== [...new Set(emailsList)].length) {
    const error = Boom.badData();
    error.output.payload.errorsByTrainee = { Emails: [translate[language].emailDuplicates] };
    throw error;
  }

  const nameList = learnerList.map(l => `${l.firstname} ${l.lastname}`);
  if (nameList.length !== [...new Set(nameList)].length) {
    const error = Boom.badData();
    error.output.payload.errorsByTrainee = { Stagiaires: [translate[language].nameDuplicates] };
    throw error;
  }

  const errorsByTrainee = {};
  let i = 1;
  for (const learner of learnerList) {
    let learnerName = `Stagiaire ${i}`;
    if (!(learner.firstname && learner.lastname)) {
      errorsByTrainee[`Stagiaire ${i}`] = [translate[language].incorrectName];
    } else {
      const { firstname, lastname } = learner;
      learnerName = UtilsHelper.formatIdentity({ firstname, lastname }, 'FL');
    }

    let companyId = null;
    if (!learner.company) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].missingCompany);
      else errorsByTrainee[learnerName] = [translate[language].missingCompany];
    } else {
      const company = await Company
        .findOne({ name: { $regex: new RegExp(`^${UtilsHelper.escapeRegex(learner.company)}$`, 'i') } }, { _id: 1 })
        .lean();
      companyId = get(company, '_id');
      if (!company) {
        if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].unknownCompany);
        else errorsByTrainee[learnerName] = [translate[language].unknownCompany];
      } else if (!UtilsHelper.doesArrayIncludeId(course.companies, companyId)) {
        if (errorsByTrainee[learnerName]) {
          errorsByTrainee[learnerName].push(translate[language].companyNotRegisteredToCourse);
        } else errorsByTrainee[learnerName] = [translate[language].companyNotRegisteredToCourse];
      }
    }
    const identityUser = await User
      .findOne(
        {
          'identity.firstname': { $regex: new RegExp(`^${UtilsHelper.escapeRegex(learner.firstname)}$`, 'i') },
          'identity.lastname': { $regex: new RegExp(`^${UtilsHelper.escapeRegex(learner.lastname)}$`, 'i') },
        },
        { _id: 1, local: 1 }
      )
      .populate({ path: 'company' })
      .lean();
    let sameEmail = false;
    if (identityUser) {
      sameEmail = identityUser.local.email === learner.email.toLowerCase();
      if (identityUser.company) {
        if (sameEmail && !UtilsHelper.areObjectIdsEquals(companyId, identityUser.company)) {
          if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].wrongLearnerCompany);
          else errorsByTrainee[learnerName] = [translate[language].wrongLearnerCompany];
        } else if (!sameEmail && UtilsHelper.areObjectIdsEquals(companyId, identityUser.company)) {
          if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].wrongLearnerEmail);
          else errorsByTrainee[learnerName] = [translate[language].wrongLearnerEmail];
        }
      }
    }
    if (learner.email) {
      if (!learner.email.match(EMAIL_VALIDATION)) {
        if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].incorrectEmail);
        else errorsByTrainee[learnerName] = [translate[language].incorrectEmail];
      }
      const emailUser = await User.findOne({ 'local.email': learner.email.toLowerCase() }, { _id: 1 }).lean();
      if (emailUser && !UtilsHelper.areObjectIdsEquals(emailUser._id, get(identityUser, '_id'))) {
        if (errorsByTrainee[learnerName]) {
          errorsByTrainee[learnerName].push(translate[language].emailLinkedToOtherLearner);
        } else errorsByTrainee[learnerName] = [translate[language].emailLinkedToOtherLearner];
      }
    } else if (!learner.suffix || !learner.suffix.match(SUFFIX_EMAIL_VALIDATION)) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].missingOrIncorrectSuffix);
      else errorsByTrainee[learnerName] = [translate[language].missingOrIncorrectSuffix];
    }
    if (learner.countryCode && !learner.countryCode.match(COUNTRY_CODE_VALIDATION)) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].incorrectCountryCode);
      else errorsByTrainee[learnerName] = [translate[language].incorrectCountryCode];
    }

    const formattedPhone = learner.phone.replace(/[\s\-.]/g, '');
    if (learner.phone && !formattedPhone.match(PHONE_VALIDATION)) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].incorrectPhone);
      else errorsByTrainee[learnerName] = [translate[language].incorrectPhone];
    }

    if (!errorsByTrainee[learnerName]) {
      formattedLearnerList.push({
        ...identityUser && sameEmail && { _id: identityUser._id },
        'identity.firstname': learner.firstname,
        'identity.lastname': learner.lastname,
        'local.email': learner.email ||
        (
          `${UtilsHelper.removeDiacritics(learner.firstname).replace(/[^a-z]/gi, '')}`
          + `.${UtilsHelper.removeDiacritics(learner.lastname).replace(/[^a-z]/gi, '')}${learner.suffix}`
        ).toLowerCase(),
        ...learner.phone && { 'contact.phone': formattedPhone },
        ...learner.phone && { 'contact.countryCode': learner.countryCode || '+33' },
        company: companyId,
      });
    }
    i += 1;
  }
  if (Object.keys(errorsByTrainee).length) {
    const error = Boom.badData();
    error.output.payload.errorsByTrainee = errorsByTrainee;
    throw error;
  }

  return formattedLearnerList;
};

exports.authorizeUploadSingleCourseCSV = async (req) => {
  const { payload } = req;

  const learnerList = await UtilsHelper.parseCsv(payload.file);
  if (learnerList.length > process.env.MAX_CSV_COURSE_SIZE) throw Boom.forbidden(translate[language].fileIsToBig);

  const allowedKeys = [
    'firstname',
    'lastname',
    'email',
    'phone',
    'countryCode',
    'company',
    'suffix',
    'subProgram',
    'operationsRepresentative',
    'trainers',
    'estimatedStartDate',
  ].sort();
  if (!isEqual(Object.keys(learnerList[0]).sort(), allowedKeys)) {
    throw Boom.badRequest(translate[language].wrongColumnsInCsv);
  }

  const formattedLearnerList = [];
  const emailsList = compact(learnerList.map(l => l.email));
  if (emailsList.length !== [...new Set(emailsList)].length) {
    const error = Boom.badData();
    error.output.payload.errorsByTrainee = { Emails: [translate[language].emailDuplicates] };
    throw error;
  }

  const nameList = learnerList.map(l => `${l.firstname} ${l.lastname}`);
  if (nameList.length !== [...new Set(nameList)].length) {
    const error = Boom.badData();
    error.output.payload.errorsByTrainee = { Stagiaires: [translate[language].nameDuplicates] };
    throw error;
  }

  const trainingOrganisationManagerRole = await Role.findOne({ name: TRAINING_ORGANISATION_MANAGER }).lean();
  const trainerRole = await Role.findOne({ name: TRAINER }).lean();
  const errorsByTrainee = {};
  let i = 1;
  for (const learner of learnerList) {
    let learnerName = `Stagiaire ${i}`;
    if (!(learner.firstname && learner.lastname)) {
      errorsByTrainee[`Stagiaire ${i}`] = [translate[language].incorrectName];
    } else {
      const { firstname, lastname } = learner;
      learnerName = UtilsHelper.formatIdentity({ firstname, lastname }, 'FL');
    }

    let companyId = null;
    if (!learner.company) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].missingCompany);
      else errorsByTrainee[learnerName] = [translate[language].missingCompany];
    } else {
      const company = await Company
        .findOne({ name: { $regex: new RegExp(`^${UtilsHelper.escapeRegex(learner.company)}$`, 'i') } }, { _id: 1 })
        .lean();
      companyId = get(company, '_id');
    }
    const identityUser = await User
      .findOne(
        {
          'identity.firstname': { $regex: new RegExp(`^${UtilsHelper.escapeRegex(learner.firstname)}$`, 'i') },
          'identity.lastname': { $regex: new RegExp(`^${UtilsHelper.escapeRegex(learner.lastname)}$`, 'i') },
        },
        { _id: 1, local: 1 }
      )
      .populate({ path: 'company' })
      .lean();
    let sameEmail = false;
    if (identityUser) {
      sameEmail = identityUser.local.email === learner.email.toLowerCase();
      if (identityUser.company) {
        if (sameEmail && !UtilsHelper.areObjectIdsEquals(companyId, identityUser.company)) {
          if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].wrongLearnerCompany);
          else errorsByTrainee[learnerName] = [translate[language].wrongLearnerCompany];
        } else if (!sameEmail && UtilsHelper.areObjectIdsEquals(companyId, identityUser.company)) {
          if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].wrongLearnerEmail);
          else errorsByTrainee[learnerName] = [translate[language].wrongLearnerEmail];
        }
      }
    }
    if (learner.email) {
      if (!learner.email.match(EMAIL_VALIDATION)) {
        if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].incorrectEmail);
        else errorsByTrainee[learnerName] = [translate[language].incorrectEmail];
      }
      const emailUser = await User.findOne({ 'local.email': learner.email.toLowerCase() }, { _id: 1 }).lean();
      if (emailUser && !UtilsHelper.areObjectIdsEquals(emailUser._id, get(identityUser, '_id'))) {
        if (errorsByTrainee[learnerName]) {
          errorsByTrainee[learnerName].push(translate[language].emailLinkedToOtherLearner);
        } else errorsByTrainee[learnerName] = [translate[language].emailLinkedToOtherLearner];
      }
    } else if (!learner.suffix || !learner.suffix.match(SUFFIX_EMAIL_VALIDATION)) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].missingOrIncorrectSuffix);
      else errorsByTrainee[learnerName] = [translate[language].missingOrIncorrectSuffix];
    }
    if (learner.countryCode && !learner.countryCode.match(COUNTRY_CODE_VALIDATION)) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].incorrectCountryCode);
      else errorsByTrainee[learnerName] = [translate[language].incorrectCountryCode];
    }

    const formattedPhone = learner.phone.replace(/[\s\-.]/g, '');
    if (learner.phone && !formattedPhone.match(PHONE_VALIDATION)) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].incorrectPhone);
      else errorsByTrainee[learnerName] = [translate[language].incorrectPhone];
    }

    if (!learner.subProgram) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].missingSubProgram);
      else errorsByTrainee[learnerName] = [translate[language].missingSubProgram];
    } else if (!isObjectIdOrHexString(learner.subProgram)) {
      if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].unknownSubProgram);
      else errorsByTrainee[learnerName] = [translate[language].unknownSubProgram];
    } else {
      const subProgram = await SubProgram.findOne({ _id: learner.subProgram }, { _id: 1 }).lean();
      if (!subProgram) {
        if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].unknownSubProgram);
        else errorsByTrainee[learnerName] = [translate[language].unknownSubProgram];
      }
    }
    let operationsRepresentativeId = null;
    if (!learner.operationsRepresentative) {
      if (errorsByTrainee[learnerName]) {
        errorsByTrainee[learnerName].push(translate[language].missingOperationsRepresentative);
      } else errorsByTrainee[learnerName] = [translate[language].missingOperationsRepresentative];
    } else if (!learner.operationsRepresentative.match(EMAIL_VALIDATION)) {
      if (errorsByTrainee[learnerName]) {
        errorsByTrainee[learnerName].push(translate[language].incorrectEmailForOperationsRepresentative);
      } else errorsByTrainee[learnerName] = [translate[language].incorrectEmailForOperationsRepresentative];
    } else {
      const operationsRepresentative = await User
        .findOne(
          {
            'local.email': learner.operationsRepresentative.toLowerCase(),
            'role.vendor': trainingOrganisationManagerRole._id,
          },
          { _id: 1 })
        .lean();
      operationsRepresentativeId = get(operationsRepresentative, '_id');
      if (!operationsRepresentative) {
        if (errorsByTrainee[learnerName]) {
          errorsByTrainee[learnerName].push(translate[language].unknownOperationsRepresentative);
        } else errorsByTrainee[learnerName] = [translate[language].unknownOperationsRepresentative];
      }
    }
    const trainersIds = [];
    if (learner.trainers) {
      const trainersEmail = learner.trainers.split(',').map(email => email.trim()).filter(Boolean);
      if (!trainersEmail.every(email => email.match(EMAIL_VALIDATION))) {
        if (errorsByTrainee[learnerName]) {
          errorsByTrainee[learnerName].push(translate[language].incorrectEmailForTrainer);
        } else errorsByTrainee[learnerName] = [translate[language].incorrectEmailForTrainer];
      } else {
        for (const trainerEmail of trainersEmail) {
          const trainer = await User
            .findOne(
              {
                'local.email': trainerEmail.toLowerCase(),
                'role.vendor': { $in: [trainingOrganisationManagerRole._id, trainerRole._id] },
              },
              { _id: 1 })
            .lean();
          trainersIds.push(get(trainer, '_id'));
          if (!trainer) {
            if (errorsByTrainee[learnerName]) {
              errorsByTrainee[learnerName].push(translate[language].unknownTrainer);
            } else errorsByTrainee[learnerName] = [translate[language].unknownTrainer];
          }
        }
      }
    }

    let formattedDate = '';
    if (learner.estimatedStartDate) {
      const date = new Date(learner.estimatedStartDate);
      const isValid = !Number.isNaN(date.getTime());
      if (isValid) {
        formattedDate = CompaniDate(date).toISO();
      } else if (errorsByTrainee[learnerName]) errorsByTrainee[learnerName].push(translate[language].incorrectDate);
      else errorsByTrainee[learnerName] = [translate[language].incorrectDate];
    }

    if (!errorsByTrainee[learnerName]) {
      formattedLearnerList.push({
        ...identityUser && sameEmail && { _id: identityUser._id },
        'identity.firstname': learner.firstname,
        'identity.lastname': learner.lastname,
        'local.email': learner.email ||
        (
          `${UtilsHelper.removeDiacritics(learner.firstname).replace(/[^a-z]/gi, '')}`
          + `.${UtilsHelper.removeDiacritics(learner.lastname).replace(/[^a-z]/gi, '')}${learner.suffix}`
        ).toLowerCase(),
        ...learner.phone && { 'contact.phone': formattedPhone },
        ...learner.phone && { 'contact.countryCode': learner.countryCode || '+33' },
        company: companyId || learner.company,
        operationsRepresentative: operationsRepresentativeId,
        trainers: trainersIds,
        subProgram: learner.subProgram,
        ...formattedDate && { estimatedStartDate: formattedDate },
      });
    }
    i += 1;
  }
  if (Object.keys(errorsByTrainee).length) {
    const error = Boom.badData();
    error.output.payload.errorsByTrainee = errorsByTrainee;
    throw error;
  }

  return formattedLearnerList;
};
