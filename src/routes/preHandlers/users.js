const Boom = require('@hapi/boom');
const get = require('lodash/get');
const flat = require('flat');
const Company = require('../../models/Company');
const CompanyHolding = require('../../models/CompanyHolding');
const Holding = require('../../models/Holding');
const User = require('../../models/User');
const Role = require('../../models/Role');
const Establishment = require('../../models/Establishment');
const UserHolding = require('../../models/UserHolding');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
const UserCompaniesHelper = require('../../helpers/userCompanies');
const {
  CLIENT_ADMIN,
  COACH,
  AUXILIARY,
  PLANNING_REFERENT,
  HELPER,
  VENDOR_ADMIN,
  TRAINING_ORGANISATION_MANAGER,
  CLIENT,
  VENDOR,
  AUXILIARY_WITHOUT_COMPANY,
  TRAINER,
  HOLDING_ADMIN,
} = require('../../helpers/constants');

const { language } = translate;

exports.getUser = async (req) => {
  try {
    const userId = req.params._id;
    const user = await User.findOne({ _id: userId }).populate({ path: 'company' }).lean();
    if (!user) throw Boom.notFound(translate[language].userNotFound);

    return user;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const isOnlyTrainer = role => get(role, 'vendor.name') === TRAINER &&
  ![COACH, CLIENT_ADMIN].includes(get(role, 'client.name'));

const isTrainerAccessingOtherUser = req => isOnlyTrainer(get(req, 'auth.credentials.role')) &&
  !UtilsHelper.areObjectIdsEquals(get(req, 'auth.credentials._id'), req.params._id);

const trainerUpdatesForbiddenKeys = (req, user) => {
  if (!isTrainerAccessingOtherUser(req)) return false;

  if (get(req, 'payload.local.email') && req.payload.local.email !== user.local.email) return true;

  const payloadKeys = UtilsHelper.getKeysOf2DepthObject(req.payload);
  const allowedKeys = [
    'company',
    'identity.firstname',
    'identity.lastname',
    'contact.phone',
    'contact.countryCode',
    'local.email',
    'userCompanyStartDate',
  ];

  return payloadKeys.some(elem => !allowedKeys.includes(elem));
};

exports.authorizeUserUpdate = async (req) => {
  const { credentials } = req.auth;
  const userFromDB = await User
    .findOne({ _id: req.params._id })
    .populate({ path: 'company' })
    .populate({ path: 'userCompanyList' })
    .lean();
  if (!userFromDB) throw Boom.notFound(translate[language].userNotFound);

  if (trainerUpdatesForbiddenKeys(req, userFromDB)) throw Boom.forbidden();

  const loggedUserVendorRole = get(credentials, 'role.vendor.name');
  const loggedUserClientRole = get(credentials, 'role.client.name');
  const loggedUserCompany = get(credentials, 'company._id') || '';
  const updatingOwnInfos = UtilsHelper.areObjectIdsEquals(credentials._id, userFromDB._id);

  if (!loggedUserVendorRole && !updatingOwnInfos) {
    const companies = get(credentials, 'role.holding') ? credentials.holding.companies : [loggedUserCompany];
    const hasLoggedUserAccessToUserCompany = companies
      .some(company => UserCompaniesHelper.userIsOrWillBeInCompany(userFromDB.userCompanyList, company));
    if (!hasLoggedUserAccessToUserCompany) throw Boom.notFound();
  }

  // ERP checks : updated user is linked to client logged user company
  if (get(req, 'payload.establishment')) await checkEstablishment(loggedUserCompany, req.payload);

  if (get(req, 'payload.role')) await checkRole(userFromDB, req.payload);
  if (get(req, 'payload.holding')) {
    if (![TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(loggedUserVendorRole)) throw Boom.forbidden();
    const holding = await Holding.countDocuments({ _id: req.payload.holding });
    if (!holding) throw Boom.notFound();

    const companyHolding = await CompanyHolding
      .countDocuments({ holding: req.payload.holding, company: userFromDB.company });
    if (!companyHolding) throw Boom.forbidden(translate[language].userCompanyNotLinkedToHolding);

    const userHolding = await UserHolding.countDocuments({ user: userFromDB._id });
    if (userHolding) throw Boom.conflict(translate[language].userAlreadyLinkedToHolding);
  }
  if (!loggedUserVendorRole && (!loggedUserClientRole || loggedUserClientRole === AUXILIARY_WITHOUT_COMPANY)) {
    checkUpdateAndCreateRestrictions(req.payload);
  }

  if (get(req.payload, 'contact.phone') && !get(req.payload, 'contact.countryCode')) throw Boom.badData();

  return null;
};

const checkEstablishment = async (companyId, payload) => {
  const establishment = await Establishment.countDocuments({ _id: payload.establishment, company: companyId });
  if (!establishment) throw Boom.forbidden();
};

const checkRole = async (userFromDB, payload) => {
  const role = await Role.findOne({ _id: payload.role }, { name: 1, interface: 1 }).lean();
  const previousClientRole = get(userFromDB, 'role.client');

  const clientRoleSwitch = role.interface === CLIENT && previousClientRole &&
    !UtilsHelper.areObjectIdsEquals(previousClientRole, payload.role);

  if (clientRoleSwitch) {
    const formerClientRole = await Role.findById(previousClientRole, { name: 1 }).lean();
    const allowedRoleChanges = [
      { from: AUXILIARY, to: PLANNING_REFERENT },
      { from: PLANNING_REFERENT, to: AUXILIARY },
      { from: COACH, to: CLIENT_ADMIN },
      { from: CLIENT_ADMIN, to: COACH },
    ];

    const isRoleUpdateAllowed = allowedRoleChanges.some(({ from, to }) =>
      (from === formerClientRole.name && to === role.name));
    if (!isRoleUpdateAllowed) throw Boom.conflict(translate[language].userRoleConflict);
  }

  const vendorRoleChange = role.interface === VENDOR && !!get(userFromDB, 'role.vendor');
  if (vendorRoleChange) throw Boom.conflict(translate[language].userRoleConflict);
};

const checkUpdateAndCreateRestrictions = (payload) => {
  const allowedUpdateKeys = [
    'identity.firstname',
    'identity.lastname',
    'contact.phone',
    'contact.countryCode',
    'local.email',
    'local.password',
    'origin',
  ];
  const payloadKeys = Object.keys(flat(payload));

  if (payloadKeys.some(key => !allowedUpdateKeys.includes(key))) throw Boom.forbidden();
};

exports.authorizeUserGetById = async (req) => {
  const { credentials } = req.auth;
  const user = await User
    .findOne({ _id: req.params._id })
    .populate({ path: 'company' })
    .populate({ path: 'userCompanyList' })
    .lean();
  if (!user) throw Boom.notFound(translate[language].userNotFound);

  const isLoggedUserVendor = get(credentials, 'role.vendor');
  const hasCompany = UserCompaniesHelper.getCurrentAndFutureCompanies(user.userCompanyList).length;
  if (!isLoggedUserVendor && hasCompany) {
    const companies = get(credentials, 'role.holding')
      ? credentials.holding.companies
      : [get(credentials, 'company._id')];
    const hasUserAccessToCompany = companies
      .some(company => UserCompaniesHelper.userIsOrWillBeInCompany(user.userCompanyList, company));
    if (!hasUserAccessToCompany) throw Boom.notFound();
  }

  return null;
};

exports.authorizeUserDeletion = async (req) => {
  const { credentials } = req.auth;
  const { user } = req.pre;
  const companyId = get(credentials, 'company._id') || null;
  const clientRoleId = get(user, 'role.client');

  if (UtilsHelper.areObjectIdsEquals(user._id, credentials._id)) {
    if (user.company) throw Boom.forbidden(translate[language].userDeletionForbidden);

    return null;
  }

  if (!clientRoleId || isOnlyTrainer(credentials.role)) throw Boom.forbidden();

  const role = await Role.findById(clientRoleId).lean();
  if (role.name !== HELPER) throw Boom.forbidden();

  if (!UtilsHelper.areObjectIdsEquals(user.company, companyId)) throw Boom.notFound();

  return null;
};

exports.authorizeUserCreation = async (req) => {
  const { credentials } = req.auth;
  if (!credentials) checkUpdateAndCreateRestrictions(req.payload);

  if (credentials && req.payload.local.password) throw Boom.forbidden();

  const scope = get(credentials, 'scope');
  if (scope && !scope.includes('users:edit')) throw Boom.forbidden();
  if (isOnlyTrainer(get(credentials, 'role')) && (!get(req, 'payload.company') || get(req, 'payload.role'))) {
    throw Boom.forbidden();
  }

  const vendorRole = get(credentials, 'role.vendor.name');
  if (req.payload.company && !UtilsHelper.hasUserAccessToCompany(credentials, req.payload.company) && !vendorRole) {
    throw Boom.forbidden();
  }

  if (credentials && !req.payload.role && !get(req.payload, 'contact.phone')) throw Boom.forbidden();

  return null;
};

exports.authorizeUsersGet = async (req) => {
  const { auth, query } = req;
  const vendorRole = get(req, 'auth.credentials.role.vendor.name');
  const clientRole = get(req, 'auth.credentials.role.client.name');
  const isHoldingAdmin = get(req, 'auth.credentials.role.holding.name') === HOLDING_ADMIN;
  const loggedUserHolding = get(req, 'auth.credentials.holding._id');

  if (!vendorRole && !query.company && !query.holding) throw Boom.forbidden();
  if (!clientRole && ![TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(vendorRole)) throw Boom.forbidden();

  const hasUserAccessToCompany = UtilsHelper.hasUserAccessToCompany(auth.credentials, query.company);
  const hasUserAccessToHolding = isHoldingAdmin && UtilsHelper.areObjectIdsEquals(loggedUserHolding, query.holding);
  if (!vendorRole && !(hasUserAccessToCompany || hasUserAccessToHolding)) throw Boom.forbidden();

  if (query.company) {
    const company = await Company.countDocuments({ _id: query.company });
    if (!company) throw Boom.notFound();
  }

  if (query.holding) {
    const holding = await Holding.countDocuments({ _id: query.holding });
    if (!holding) throw Boom.notFound();
  }

  return null;
};

exports.authorizeLearnersGet = async (req) => {
  const { auth, query } = req;
  const vendorRole = get(auth, 'credentials.role.vendor.name');
  if (vendorRole) return null;

  const clientRole = get(auth, 'credentials.role.client.name');
  const companies = Array.isArray(query.companies) ? query.companies : [query.companies];
  const isClientAuthorized = [CLIENT_ADMIN, COACH].includes(clientRole) &&
    companies.every(company => UtilsHelper.hasUserAccessToCompany(auth.credentials, company));
  if (!isClientAuthorized) throw Boom.forbidden();

  return null;
};

exports.getPicturePublicId = async (req) => {
  const user = await User.findOne({ _id: req.params._id }, { picture: 1 }).lean();
  if (!user) throw Boom.notFound();

  return get(user, 'picture.publicId') || '';
};

exports.checkExpoToken = async (req) => {
  const { params, payload } = req;
  const expoTokenAlreadyExists = await User.countDocuments({
    _id: { $ne: params._id },
    formationExpoTokenList: payload.formationExpoToken,
  });
  if (expoTokenAlreadyExists) throw Boom.forbidden();

  return null;
};

exports.authorizeExpoTokenEdit = async (req) => {
  if (!UtilsHelper.areObjectIdsEquals(req.params._id, req.auth.credentials._id)) throw Boom.forbidden();

  return null;
};

exports.authorizeUploadEdition = async (req) => {
  if (isTrainerAccessingOtherUser(req)) throw Boom.forbidden();

  return null;
};
