const Boom = require('@hapi/boom');
const get = require('lodash/get');
const flat = require('flat');
const User = require('../../models/User');
const Role = require('../../models/Role');
const Customer = require('../../models/Customer');
const Establishment = require('../../models/Establishment');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
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

  const payloadKeys = UtilsHelper.getKeysOfNestedObject(req.payload);
  const allowedKeys = ['company', 'identity.firstname', 'identity.lastname', 'contact.phone', 'local.email'];

  return payloadKeys.some(elem => !allowedKeys.includes(elem));
};

exports.authorizeUserUpdate = async (req) => {
  const { credentials } = req.auth;
  const userFromDB = req.pre.user;
  const userCompany = userFromDB.company || get(req, 'payload.company');
  const isLoggedUserVendor = !!get(credentials, 'role.vendor');
  const loggedUserClientRole = get(credentials, 'role.client.name');
  if (trainerUpdatesForbiddenKeys(req, userFromDB)) throw Boom.forbidden();

  checkCompany(credentials, userFromDB, req.payload, isLoggedUserVendor);
  if (get(req, 'payload.establishment')) await checkEstablishment(userCompany, req.payload);
  if (get(req, 'payload.role')) await checkRole(userFromDB, req.payload);
  if (get(req, 'payload.customer')) await checkCustomer(userCompany, req.payload);
  if (!isLoggedUserVendor && (!loggedUserClientRole || loggedUserClientRole === AUXILIARY_WITHOUT_COMPANY)) {
    checkUpdateAndCreateRestrictions(req.payload);
  }

  return null;
};

const checkCompany = (credentials, userFromDB, payload, isLoggedUserVendor) => {
  const isCompanyUpdated = payload.company && userFromDB.company &&
    !UtilsHelper.areObjectIdsEquals(payload.company, userFromDB.company);
  if (isCompanyUpdated) throw Boom.forbidden();

  const updatingOwnInfos = UtilsHelper.areObjectIdsEquals(credentials._id, userFromDB._id);
  if (isLoggedUserVendor || updatingOwnInfos) return;

  const loggedUserCompany = get(credentials, 'company._id') || '';
  const userCompany = userFromDB.company || payload.company;
  const sameCompany = userCompany && loggedUserCompany &&
    UtilsHelper.areObjectIdsEquals(userCompany, loggedUserCompany);
  if (!sameCompany) throw Boom.notFound();
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

const checkCustomer = async (userCompany, payload) => {
  const role = await Role.findOne({ name: HELPER }).lean();
  if (!UtilsHelper.areObjectIdsEquals(payload.role, role._id)) throw Boom.forbidden();

  const customerCount = await Customer.countDocuments({ _id: payload.customer, company: userCompany });
  if (!customerCount) throw Boom.forbidden();
};

const checkUpdateAndCreateRestrictions = (payload) => {
  const allowedUpdateKeys = [
    'identity.firstname',
    'identity.lastname',
    'contact.phone',
    'local.email',
    'local.password',
    'origin',
  ];
  const payloadKeys = Object.keys(flat(payload));

  if (payloadKeys.some(key => !allowedUpdateKeys.includes(key))) throw Boom.forbidden();
};

exports.authorizeUserGetById = async (req) => {
  const { credentials } = req.auth;
  const user = req.pre.user || req.payload;
  const loggedCompanyId = get(credentials, 'company._id', null);
  const isLoggedUserVendor = get(credentials, 'role.vendor', null);
  const establishmentId = get(req, 'payload.establishment');

  if (establishmentId) {
    const establishment = await Establishment.countDocuments({ _id: establishmentId, company: loggedCompanyId });
    if (!establishment) throw Boom.forbidden();
  }

  const isClientFromDifferentCompany = !isLoggedUserVendor && user.company &&
    !UtilsHelper.areObjectIdsEquals(user.company, loggedCompanyId);
  if (isClientFromDifferentCompany) throw Boom.notFound();

  return null;
};

exports.authorizeUserDeletion = async (req) => {
  const { credentials } = req.auth;
  const { user } = req.pre;
  const companyId = get(credentials, 'company._id') || null;

  const clientRoleId = get(user, 'role.client');
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

  if (req.payload.customer) {
    const { customer } = req.payload;
    const customerCount = await Customer.countDocuments({ _id: customer, company: get(credentials, 'company._id') });
    if (!customerCount) throw Boom.notFound();
  }

  const vendorRole = get(credentials, 'role.vendor.name');
  const loggedUserCompany = get(credentials, 'company._id');
  if (req.payload.company && !UtilsHelper.areObjectIdsEquals(req.payload.company, loggedUserCompany) && !vendorRole) {
    throw Boom.forbidden();
  }

  if (credentials && !req.payload.role && !get(req.payload, 'contact.phone')) throw Boom.forbidden();

  return null;
};

exports.authorizeUsersGet = async (req) => {
  const { auth, query } = req;
  const userCompanyId = get(auth, 'credentials.company._id', null);
  const queryCompanyId = query.company;
  const vendorRole = get(req, 'auth.credentials.role.vendor.name');
  const clientRole = get(req, 'auth.credentials.role.client.name');

  if (!vendorRole && !queryCompanyId) throw Boom.forbidden();
  if (!vendorRole && !UtilsHelper.areObjectIdsEquals(queryCompanyId, userCompanyId)) throw Boom.forbidden();
  if (!clientRole && ![TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(vendorRole)) throw Boom.forbidden();

  return null;
};

exports.authorizeLearnersGet = async (req) => {
  const { auth, query } = req;
  const vendorRole = get(auth, 'credentials.role.vendor.name');
  if (vendorRole) return null;

  const clientRole = get(auth, 'credentials.role.client.name');
  const isClientRoleAllowed = [CLIENT_ADMIN, COACH].includes(clientRole);
  const userCompanyId = get(auth, 'credentials.company._id', null);
  const isQueryCompanyValid = query.company && UtilsHelper.areObjectIdsEquals(query.company, userCompanyId);
  if (!isClientRoleAllowed || !isQueryCompanyValid) throw Boom.forbidden();

  if (query.hasCompany) throw Boom.forbidden();

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

exports.authorizeDriveFolderCreation = async (req) => {
  const { credentials } = req.auth;

  if (isOnlyTrainer(credentials.role)) throw Boom.forbidden();

  return null;
};
