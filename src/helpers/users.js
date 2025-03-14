const Boom = require('@hapi/boom');
const pickBy = require('lodash/pickBy');
const get = require('lodash/get');
const groupBy = require('lodash/groupBy');
const has = require('lodash/has');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const uniqBy = require('lodash/uniqBy');
const flat = require('flat');
const { v4: uuidv4 } = require('uuid');
const CompanyLinkRequest = require('../models/CompanyLinkRequest');
const CompanyHolding = require('../models/CompanyHolding');
const ActivityHistory = require('../models/ActivityHistory');
const Role = require('../models/Role');
const User = require('../models/User');
const Course = require('../models/Course');
const CourseHistory = require('../models/CourseHistory');
const UserCompany = require('../models/UserCompany');
const UserHolding = require('../models/UserHolding');
const translate = require('./translate');
const GCloudStorageHelper = require('./gCloudStorage');
const {
  TRAINER,
  HELPER,
  AUXILIARY_WITHOUT_COMPANY,
  CLIENT_ADMIN,
  COACH,
  TRAINEE_ADDITION,
  STRICTLY_E_LEARNING,
  DIRECTORY,
  HOLDING_ADMIN,
} = require('./constants');
const UtilsHelper = require('./utils');
const UserCompaniesHelper = require('./userCompanies');
const DatesUtilsHelper = require('./dates/utils');
const { CompaniDate } = require('./dates/companiDates');

const { language } = translate;

exports.formatQueryForUsersList = async (query) => {
  const formattedQuery = pickBy(omit(query, ['role', 'company', 'holding', 'includeHoldingAdmins']));

  if (query.role) {
    const roleNames = Array.isArray(query.role) ? query.role : [query.role];
    const roles = await Role.find({ name: { $in: roleNames } }, { _id: 1, interface: 1 }).lean();
    if (!roles.length) throw Boom.notFound(translate[language].roleNotFound);

    const rolesGroupByInterface = groupBy(roles, 'interface');
    if (Object.keys(rolesGroupByInterface).length > 1) {
      formattedQuery.$or = Object.keys(rolesGroupByInterface)
        .map(int => ({ [`role.${int}`]: { $in: rolesGroupByInterface[int].map(role => role._id) } }));
    } else {
      formattedQuery[`role.${roles[0].interface}`] = { $in: roles.map(role => role._id) };
    }
  }

  if (query.company) {
    const userIds = [];
    const userCompanies = await UserCompany
      .find(
        {
          company: query.company,
          $or: [{ endDate: { $gt: CompaniDate().toISO() } }, { endDate: { $exists: false } }],
        },
        { user: 1 }
      )
      .lean();

    userIds.push(...userCompanies.map(uc => uc.user));

    if (query.includeHoldingAdmins) {
      const companyHolding = await CompanyHolding.findOne({ company: query.company }, { holding: 1 }).lean();
      if (companyHolding) {
        const userHoldings = await UserHolding.find({ holding: companyHolding.holding }, { user: 1 }).lean();
        userIds.push(...userHoldings.map(uh => uh.user));
      }
    }

    formattedQuery._id = { $in: userIds };
  }

  if (query.holding) {
    const companies = await CompanyHolding.find({ holding: query.holding }, { company: 1 }).lean();
    const users = await UserCompany.find({ company: { $in: companies.map(c => c.company) } }, { user: 1 }).lean();

    formattedQuery._id = { $in: users.map(u => u.user) };
  }

  return formattedQuery;
};

exports.getUsersList = async (query, credentials) => {
  const params = await exports.formatQueryForUsersList(query);

  return User.find(params, {}, { autopopulate: false })
    .populate({ path: 'role.client', select: '-__v -createdAt -updatedAt' })
    .populate({ path: 'role.holding', select: '-__v -createdAt -updatedAt' })
    .populate({ path: 'company', populate: { path: 'company' }, select: '-__v -createdAt -updatedAt' })
    .setOptions({ isVendorUser: has(credentials, 'role.vendor') })
    .lean({ virtuals: true, autopopulate: true });
};

const formatQueryForLearnerList = async (query) => {
  let userCompanyQuery = { company: { $in: query.companies } };
  if (query.startDate && query.endDate) {
    userCompanyQuery = {
      ...userCompanyQuery,
      startDate: { $lt: CompaniDate(query.endDate).toISO() },
      $or: [{ endDate: { $gt: CompaniDate(query.startDate).toISO() } }, { endDate: { $exists: false } }],
    };
  } else if (query.startDate) {
    userCompanyQuery = {
      ...userCompanyQuery,
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: CompaniDate(query.startDate).toISO() } }],
    };
  } else {
    userCompanyQuery = {
      ...userCompanyQuery,
      startDate: { $lt: CompaniDate().toISO() },
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: CompaniDate().toISO() } }],
    };
  }
  const rolesToExclude = await Role.find({ name: { $in: [HELPER, AUXILIARY_WITHOUT_COMPANY] } }).lean();
  const usersCompany = await UserCompany.find(userCompanyQuery, { user: 1 }).lean();

  return {
    _id: { $in: usersCompany.map(uc => uc.user) },
    'role.client': { $not: { $in: rolesToExclude.map(r => r._id) } },
  };
};

const computeCoursesCountByTrainee = async (learnerList, company) => {
  const learnersIdList = learnerList.map(learner => learner._id);
  const [blendedCourseRegistrationHistoriesForTrainees, eLearningCoursesForTrainees] = await Promise.all([
    CourseHistory
      .find({ trainee: { $in: learnersIdList }, action: TRAINEE_ADDITION, ...(company && { company }) })
      .populate({ path: 'course', select: 'trainees' })
      .lean(),
    Course
      .find({
        trainees: { $in: learnersIdList },
        format: STRICTLY_E_LEARNING,
        ...(company && { $or: [{ accessRules: company }, { accessRules: [] }] }),
      })
      .lean(),
  ]);

  const eLearningRegistrationList = eLearningCoursesForTrainees
    .flatMap(course => course.trainees.map(trainee => ({ trainee, course })));
  const eLearningCoursesGroupedByTrainee = groupBy(eLearningRegistrationList, 'trainee');

  const traineesRegistrationList = blendedCourseRegistrationHistoriesForTrainees
    .filter(history => UtilsHelper.doesArrayIncludeId(history.course.trainees, history.trainee));
  const blendedCoursesGroupedByTrainee = groupBy(traineesRegistrationList, 'trainee');

  const blendedCoursesCountByTrainee = {};
  const eLearningCoursesCountByTrainee = {};
  for (const learner of learnerList) {
    if (blendedCoursesGroupedByTrainee[learner._id]) {
      const learnerRegistration = blendedCoursesGroupedByTrainee[learner._id]
        .sort(DatesUtilsHelper.descendingSortBy('createdAt'));
      blendedCoursesGroupedByTrainee[learner._id] = uniqBy(learnerRegistration, 'course._id');
    }
    blendedCoursesCountByTrainee[learner._id] = (blendedCoursesGroupedByTrainee[learner._id] || []).length;
    eLearningCoursesCountByTrainee[learner._id] = (eLearningCoursesGroupedByTrainee[learner._id] || []).length;
  }

  return { eLearningCoursesCountByTrainee, blendedCoursesCountByTrainee };
};

exports.getLearnerList = async (query, credentials) => {
  const userQuery = query.companies ? await formatQueryForLearnerList(query) : {};
  const isDirectory = query.action === DIRECTORY;

  const learnerList = await User
    .find(userQuery, 'identity.firstname identity.lastname picture local.email', { autopopulate: false })
    .populate({ path: 'company', populate: { path: 'company', select: 'name' } })
    .populate(isDirectory && { path: 'lastActivityHistory', select: 'updatedAt' })
    .populate({
      path: 'userCompanyList',
      populate: {
        path: 'company',
        select: 'name',
        populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
      },
    })
    .setOptions({ isVendorUser: !!get(credentials, 'role.vendor') })
    .lean();

  if (!isDirectory) return learnerList;

  const {
    eLearningCoursesCountByTrainee,
    blendedCoursesCountByTrainee,
  } = await computeCoursesCountByTrainee(learnerList, query.companies);

  return learnerList.map(learner => ({
    ...omit(learner, 'activityHistories'),
    lastActivityHistory: learner.lastActivityHistory,
    eLearningCoursesCount: eLearningCoursesCountByTrainee[learner._id],
    blendedCoursesCount: blendedCoursesCountByTrainee[learner._id],
  }));
};

exports.getUser = async (userId, credentials) => {
  const isVendorUser = has(credentials, 'role.vendor');
  const requestingOwnInfos = UtilsHelper.areObjectIdsEquals(userId, credentials._id);

  const user = await User.findOne({ _id: userId })
    .populate({
      path: 'company',
      populate: { path: 'company', populate: { path: 'billingRepresentative salesRepresentative' } },
      select: '-__v -createdAt -updatedAt',
    })
    .populate({
      path: 'holding',
      populate: { path: 'holding', populate: { path: 'companies' } },
      select: '-__v -createdAt -updatedAt',
    })
    .populate({ path: 'companyLinkRequest', populate: { path: 'company', select: '_id name' } })
    .populate({ path: 'userCompanyList' })
    .lean({ autopopulate: true, virtuals: true });

  if (!user) throw Boom.notFound(translate[language].userNotFound);

  return isVendorUser || requestingOwnInfos
    ? user
    : {
      ...user,
      userCompanyList: user.userCompanyList
        .filter(uc => UtilsHelper.hasUserAccessToCompany(credentials, get(uc, 'company'))),
    };
};

exports.userExists = async (email, credentials) => {
  const targetUser = await User
    .findOne(
      { 'local.email': email },
      { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, contact: 1 }
    )
    .populate({ path: 'company' })
    .populate({ path: 'userCompanyList', options: { sort: { startDate: 1 } } })
    .lean();

  if (!targetUser) return { exists: false, user: {} };
  if (!credentials) return { exists: true, user: {} };

  const companyId = get(credentials, 'company._id');
  const loggedUserHasVendorRole = has(credentials, 'role.vendor');

  const loggedUserHasCoachRights = [COACH, CLIENT_ADMIN].includes(get(credentials, 'role.client.name'));
  const companies = get(credentials, 'role.holding') ? credentials.holding.companies : [companyId];
  const sameCompany = companies
    .some(company => UserCompaniesHelper.userIsOrWillBeInCompany(targetUser.userCompanyList, company));
  const currentAndFuturCompanies = UserCompaniesHelper.getCurrentAndFutureCompanies(targetUser.userCompanyList);
  const coachCanReadAllUserInfo = loggedUserHasCoachRights && (sameCompany || !currentAndFuturCompanies.length);
  const doesEveryUserCompanyHasEndDate = targetUser.userCompanyList.every(uc => uc.endDate);
  const canReadInfo = loggedUserHasVendorRole || coachCanReadAllUserInfo ||
    (loggedUserHasCoachRights && doesEveryUserCompanyHasEndDate);

  if (canReadInfo) {
    let userCompanyList;
    if (loggedUserHasVendorRole) userCompanyList = targetUser.userCompanyList;
    else if (coachCanReadAllUserInfo) {
      userCompanyList = targetUser.userCompanyList.filter(uc => UtilsHelper.doesArrayIncludeId(companies, uc.company));
    } else {
      userCompanyList = [UtilsHelper.getLastVersion(targetUser.userCompanyList, 'startDate')];
    }

    const userFieldsToPick =
      ['_id', 'local.email', 'identity.firstname', 'identity.lastname', 'contact.phone', 'contact.countryCode', 'role'];
    return {
      exists: true,
      user: {
        ...pick(targetUser, [...userFieldsToPick, (loggedUserHasVendorRole || coachCanReadAllUserInfo) && 'company']),
        userCompanyList: userCompanyList.map(uc => pick(uc, ['company', 'startDate', 'endDate'])),
      },
    };
  }

  return { exists: true, user: {} };
};

/**
 * 1st case : No role / no company => handle payload as given
 *  - User creates his account
 *  - Vendor admin creates program tester
 * 2nd case : Client role creates user for his organization => set company with the one in credentials
 * + role (if needed)
 * 3rd case : Vendor role creates user for one organization => set company with the one in payload + role (if needed)
 * 4th case : Vendor role creates trainer => do no set company
 */
exports.createUser = async (userPayload, credentials) => {
  const payload = { ...omit(userPayload, ['role']), refreshToken: uuidv4() };

  const role = userPayload.role ? await Role.findById(userPayload.role, { name: 1, interface: 1 }).lean() : null;
  if (userPayload.role && !role) throw Boom.badRequest(translate[language].unknownRole);
  if (role) payload.role = { [role.interface]: role._id };

  const user = await User.create(payload);

  if (!credentials || (role && role.name === TRAINER)) return user;

  const companyId = payload.company || get(credentials, 'company._id');
  await UserCompaniesHelper.create({
    user: user._id,
    company: companyId,
    ...(payload.userCompanyStartDate && { startDate: payload.userCompanyStartDate }),
  });

  return User.findOne({ _id: user._id }).lean({ virtuals: true, autopopulate: true });
};

const formatUpdatePayload = async (updatedUser) => {
  const payload = omit(updatedUser, ['role', 'company', 'holding']);

  if (updatedUser.role) {
    const role = await Role.findById(updatedUser.role, { name: 1, interface: 1 }).lean();
    if (!role) throw Boom.badRequest(translate[language].unknownRole);

    payload.role = { [role.interface]: role._id.toHexString() };
  }

  if (updatedUser.holding) {
    const role = await Role.findOne({ name: HOLDING_ADMIN }).lean();

    payload.role = { holding: role._id };
  }

  return payload;
};

exports.updateUser = async (userId, userPayload) => {
  const payload = await formatUpdatePayload(userPayload);
  if (userPayload.company) {
    await UserCompaniesHelper.create({
      user: userId,
      company: userPayload.company,
      ...(userPayload.userCompanyStartDate && { startDate: userPayload.userCompanyStartDate }),
    });
  }

  if (userPayload.holding) await UserHolding.create({ user: userId, holding: userPayload.holding });

  await User.updateOne({ _id: userId }, { $set: UtilsHelper.flatQuery(payload) });
};

exports.removeUser = async (user, credentials) => {
  if (UtilsHelper.areObjectIdsEquals(user._id, credentials._id)) {
    await CompanyLinkRequest.deleteOne({ user: user._id });
    await Course.updateMany({ trainees: user._id }, { $pull: { trainees: user._id } });
    await ActivityHistory.deleteMany({ user: user._id });
    await User.deleteOne({ _id: user._id });
  }
};

exports.uploadPicture = async (userId, payload) => {
  const picture = await GCloudStorageHelper.uploadUserMedia(payload);

  await User.updateOne({ _id: userId }, { $set: flat({ picture }) });
};

exports.deletePicture = async (userId, publicId) => {
  if (!publicId) return;

  await User.updateOne({ _id: userId }, { $unset: { 'picture.publicId': '', 'picture.link': '' } });
  await GCloudStorageHelper.deleteUserMedia(publicId);
};

exports.addExpoToken = async (payload, credentials) => User.updateOne(
  { _id: credentials._id },
  { $addToSet: { formationExpoTokenList: payload.formationExpoToken } }
);

exports.removeExpoToken = async (expoToken, credentials) => User.updateOne(
  { _id: credentials._id },
  { $pull: { formationExpoTokenList: expoToken } }
);
