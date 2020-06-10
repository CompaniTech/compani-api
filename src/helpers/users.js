const Boom = require('@hapi/boom');
const moment = require('moment');
const bcrypt = require('bcrypt');
const pickBy = require('lodash/pickBy');
const get = require('lodash/get');
const has = require('lodash/has');
const pick = require('lodash/pick');
const cloneDeep = require('lodash/cloneDeep');
const omit = require('lodash/omit');
const flat = require('flat');
const uuid = require('uuid');
const Role = require('../models/Role');
const User = require('../models/User');
const Task = require('../models/Task');
const { TOKEN_EXPIRE_TIME } = require('../models/User');
const Contract = require('../models/Contract');
const translate = require('./translate');
const GdriveStorage = require('./gdriveStorage');
const AuthenticationHelper = require('./authentication');
const { AUXILIARY, PLANNING_REFERENT, TRAINER, VENDOR, AUXILIARY_ROLES } = require('./constants');
const SectorHistoriesHelper = require('./sectorHistories');
const EmailHelper = require('./email');

const { language } = translate;

exports.authenticate = async (payload) => {
  const user = await User.findOne({ 'local.email': payload.email.toLowerCase() }).lean({ autopopulate: true });
  const correctPassword = get(user, 'local.password') || '';
  const isCorrect = await bcrypt.compare(payload.password, correctPassword);
  if (!user || !user.refreshToken || !correctPassword || !isCorrect) throw Boom.unauthorized();

  const tokenPayload = { _id: user._id.toHexString() };
  const token = AuthenticationHelper.encode(tokenPayload, TOKEN_EXPIRE_TIME);

  return { token, refreshToken: user.refreshToken, expiresIn: TOKEN_EXPIRE_TIME, user: tokenPayload };
};

exports.refreshToken = async (payload) => {
  const user = await User.findOne({ refreshToken: payload.refreshToken }).lean({ autopopulate: true });
  if (!user) throw Boom.unauthorized();

  const tokenPayload = { _id: user._id.toHexString() };
  const token = AuthenticationHelper.encode(tokenPayload, TOKEN_EXPIRE_TIME);

  return { token, refreshToken: user.refreshToken, expiresIn: TOKEN_EXPIRE_TIME, user: tokenPayload };
};

exports.formatQueryForUsersList = async (query) => {
  const params = { ...pickBy(omit(query, ['role'])) };

  if (query.role) {
    const roleNames = Array.isArray(query.role) ? query.role : [query.role];
    const roles = await Role.find({ name: { $in: roleNames } }, { _id: 1, interface: 1 }).lean();
    if (!roles.length) throw Boom.notFound(translate[language].roleNotFound);

    params[`role.${roles[0].interface}`] = { $in: roles.map(role => role._id) };
  }

  return params;
};

exports.getUsersList = async (query, credentials) => {
  const params = await exports.formatQueryForUsersList(query);

  return User.find(params, {}, { autopopulate: false })
    .populate({ path: 'procedure.task', select: 'name' })
    .populate({ path: 'customers', select: 'identity driveFolder' })
    .populate({ path: 'role.client', select: '-rights -__v -createdAt -updatedAt' })
    .populate({
      path: 'sector',
      select: '_id sector',
      match: { company: get(credentials, 'company._id', null) },
      options: { isVendorUser: has(credentials, 'role.vendor') },
    })
    .populate('contracts')
    .setOptions({ isVendorUser: has(credentials, 'role.vendor') })
    .lean({ virtuals: true, autopopulate: true });
};

exports.getUsersListWithSectorHistories = async (query, credentials) => {
  const params = await exports.formatQueryForUsersList({ ...query, role: AUXILIARY_ROLES });

  return User.find(params, {}, { autopopulate: false })
    .populate({ path: 'role.client', select: '-rights -__v -createdAt -updatedAt' })
    .populate({
      path: 'sectorHistories',
      select: '_id sector startDate endDate',
      match: { company: get(credentials, 'company._id', null) },
      options: { isVendorUser: has(credentials, 'role.vendor') },
    })
    .populate('contracts')
    .setOptions({ isVendorUser: has(credentials, 'role.vendor') })
    .lean({ virtuals: true, autopopulate: true });
};

exports.getUser = async (userId, credentials) => {
  const user = await User.findOne({ _id: userId })
    .populate('customers')
    .populate('contracts')
    .populate({ path: 'procedure.task', select: 'name _id' })
    .populate({
      path: 'sector',
      select: '_id sector',
      match: { company: get(credentials, 'company._id', null) },
      options: { isVendorUser: has(credentials, 'role.vendor') },
    })
    .lean({ autopopulate: true, virtuals: true });

  if (!user) throw Boom.notFound(translate[language].userNotFound);

  return user;
};

exports.userExists = async (email, credentials) => {
  const targetUser = await User.findOne({ 'local.email': email }).lean();
  if (!targetUser) return { exists: false, user: {} };

  const loggedUserhasVendorRole = has(credentials, 'role.vendor');
  const loggedUserCompany = credentials.company ? credentials.company._id.toHexString() : null;
  const targetUserHasCompany = !!targetUser.company;
  const targetUserCompany = targetUserHasCompany ? targetUser.company.toHexString() : null;
  const sameCompany = targetUserHasCompany && loggedUserCompany === targetUserCompany;

  return loggedUserhasVendorRole || sameCompany || !targetUserHasCompany
    ? { exists: !!targetUser, user: pick(targetUser, ['role', '_id', 'company']) }
    : { exists: !!targetUser, user: {} };
};

exports.saveCertificateDriveId = async (userId, fileInfo) => {
  const payload = { 'administrative.certificates': fileInfo };

  await User.findOneAndUpdate(
    { _id: userId },
    { $push: payload },
    { new: true, autopopulate: false }
  );
};

exports.saveFile = async (userId, administrativeKey, fileInfo) => {
  const payload = { administrative: { [administrativeKey]: fileInfo } };

  await User.findOneAndUpdate({ _id: userId }, { $set: flat(payload) }, { new: true, autopopulate: false });
};

exports.createAndSaveFile = async (params, payload) => {
  const uploadedFile = await GdriveStorage.addFile({
    driveFolderId: params.driveId,
    name: payload.fileName || payload.type.hapi.filename,
    type: payload['Content-Type'],
    body: payload.file,
  });

  const file = { driveId: uploadedFile.id, link: uploadedFile.webViewLink };
  switch (payload.type) {
    case 'certificates':
      await exports.saveCertificateDriveId(params._id, file);
      break;
    default:
      await exports.saveFile(params._id, payload.type, file);
      break;
  }

  return uploadedFile;
};

exports.createUser = async (userPayload, credentials) => {
  const { sector, role: roleId, ...payload } = cloneDeep(userPayload);
  const companyId = payload.company || get(credentials, 'company._id', null);

  if (!roleId) return User.create({ ...payload, refreshToken: uuid.v4() });

  const role = await Role.findById(roleId, { name: 1, interface: 1 }).lean();
  if (!role) throw Boom.badRequest(translate[language].unknownRole);

  payload.role = { [role.interface]: role._id };

  if ([AUXILIARY, PLANNING_REFERENT].includes(role.name)) {
    const tasks = await Task.find({}, { _id: 1 }).lean();
    const taskIds = tasks.map(task => ({ task: task._id }));
    payload.procedure = taskIds;
  }
  if (role.name !== TRAINER) payload.company = companyId;

  const user = await User.create({ ...payload, refreshToken: uuid.v4() });

  if (sector) await SectorHistoriesHelper.createHistory({ _id: user._id, sector }, companyId);

  return User.findOne({ _id: user._id })
    .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
    .lean({ virtuals: true, autopopulate: true });
};

const formatUpdatePayload = async (updatedUser) => {
  const payload = omit(updatedUser, ['role']);

  if (updatedUser.role) {
    const role = await Role.findById(updatedUser.role, { name: 1, interface: 1 }).lean();
    if (!role) throw Boom.badRequest(translate[language].unknownRole);
    payload.role = { [role.interface]: role._id.toHexString() };
  }

  return payload;
};

exports.updateUser = async (userId, userPayload, credentials, userInDB, canEditWithoutCompany = false) => {
  const companyId = get(credentials, 'company._id', null);

  const query = { _id: userId };
  if (!canEditWithoutCompany) query.company = companyId;

  const payload = await formatUpdatePayload(userPayload);

  const alreadyHasClientRole = !!get(payload, 'role.client') && !!get(userInDB, 'role.client');
  const alreadyHasVendorRole = !!get(payload, 'role.vendor') && !!get(userInDB, 'role.vendor');
  if (alreadyHasClientRole || alreadyHasVendorRole) throw Boom.conflict(translate[language].userRoleConflict);

  if (payload.sector) {
    await SectorHistoriesHelper.updateHistoryOnSectorUpdate(userId, payload.sector, companyId);
  }
  await User.updateOne(query, { $set: flat(payload) });
};

exports.updatePassword = async (userId, userPayload) => User.findOneAndUpdate(
  { _id: userId },
  { $set: flat(userPayload), $unset: { passwordToken: '' } },
  { new: true }
).lean();

exports.updateUserCertificates = async (userId, userPayload, credentials) => {
  const companyId = get(credentials, 'company._id', null);

  await User.updateOne(
    { _id: userId, company: companyId },
    { $pull: { 'administrative.certificates': userPayload.certificates } }
  );
};

exports.updateUserInactivityDate = async (user, contractEndDate, credentials) => {
  const notEndedContractCount = await Contract.countDocuments({
    user,
    company: get(credentials, 'company._id', null),
    $or: [{ endDate: { $exists: false } }, { endDate: null }],
  });

  if (!notEndedContractCount) {
    await User.updateOne(
      { _id: user },
      { $set: { inactivityDate: moment(contractEndDate).add('1', 'month').startOf('M').toDate() } }
    );
  }
};

exports.checkResetPasswordToken = async (token) => {
  const filter = { passwordToken: { token, expiresIn: { $gt: Date.now() } } };
  const user = await User.findOne(flat(filter, { maxDepth: 2 })).lean();
  if (!user) throw Boom.notFound(translate[language].userNotFound);

  const payload = { _id: user._id, email: user.local.email };
  const userPayload = pickBy(payload);
  const expireTime = 86400;

  return { token: AuthenticationHelper.encode(userPayload, expireTime), user: userPayload };
};

exports.createPasswordToken = async email =>
  exports.generatePasswordToken(email, 24 * 3600 * 1000); // 1 day

exports.forgotPassword = async (email) => {
  const passwordToken = await exports.generatePasswordToken(email, 3600000);
  return EmailHelper.forgotPasswordEmail(email, passwordToken);
};

exports.generatePasswordToken = async (email, time) => {
  const payload = { passwordToken: { token: uuid.v4(), expiresIn: Date.now() + time } };
  const user = await User.findOneAndUpdate({ 'local.email': email }, { $set: payload }, { new: true }).lean();
  if (!user) throw Boom.notFound(translate[language].userNotFound);

  return payload.passwordToken;
};

exports.removeHelper = async (user) => {
  const role = await Role.findOne({ name: TRAINER }).lean();
  const payload = { $set: { customers: [] }, $unset: { 'role.client': '' } };

  const userRoleVendor = get(user, 'role.vendor');
  if (userRoleVendor && role._id.toHexString() === userRoleVendor.toHexString()) payload.$unset.company = '';

  await User.findOneAndUpdate({ _id: user._id }, payload);
};
