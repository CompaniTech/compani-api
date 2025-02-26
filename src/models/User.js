const mongoose = require('mongoose');
const Boom = require('@hapi/boom');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const autopopulate = require('mongoose-autopopulate');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const moment = require('moment');
const get = require('lodash/get');
const { PHONE_VALIDATION } = require('./utils');
const addressSchemaDefinition = require('./schemaDefinitions/address');
const { identitySchemaDefinition } = require('./schemaDefinitions/identity');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');
const {
  AUXILIARY,
  PLANNING_REFERENT,
  AUXILIARY_WITHOUT_COMPANY,
  CLIENT_ADMIN,
  COACH,
  VENDOR_ADMIN,
  TRAINING_ORGANISATION_MANAGER,
  TRAINER,
  HELPER,
  PUBLIC_TRANSPORT,
  PRIVATE_TRANSPORT,
  COMPANY_TRANSPORT,
  ORIGIN_OPTIONS,
  NONE,
  HOLDING_ADMIN,
  MOBILE_CONNECTION_MODE,
} = require('../helpers/constants');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { CompaniDate } = require('../helpers/dates/companiDates');

const SALT_WORK_FACTOR = 10;
const TOKEN_EXPIRE_DURATION = 'P1D';

const roleSchemaDefinition = {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Role',
  autopopulate: { select: '-__v -createdAt -updatedAt', maxDepth: 3 },
};

const USER_ROLE_LIST = [
  PLANNING_REFERENT,
  AUXILIARY,
  AUXILIARY_WITHOUT_COMPANY,
  CLIENT_ADMIN,
  COACH,
  VENDOR_ADMIN,
  TRAINING_ORGANISATION_MANAGER,
  TRAINER,
  HELPER,
  HOLDING_ADMIN,
];

const TRANSPORT_TYPE = [PUBLIC_TRANSPORT, PRIVATE_TRANSPORT, COMPANY_TRANSPORT, NONE];

// User schema
const UserSchema = mongoose.Schema({
  refreshToken: { type: String, select: false },
  serialNumber: { type: String, immutable: true, required: true, unique: true },
  passwordToken: {
    type: mongoose.Schema({
      token: { type: String },
      expiresIn: { type: Date },
    }),
    select: false,
  },
  local: {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true,
      dropDups: true,
    },
    password: { type: String, minLength: 6, select: false },
  },
  role: {
    client: roleSchemaDefinition,
    vendor: roleSchemaDefinition,
    holding: roleSchemaDefinition,
  },
  youtube: {
    link: { type: String, trim: true },
    location: { type: [String], trim: true },
  },
  picture: {
    publicId: String,
    link: { type: String, trim: true },
  },
  identity: {
    type: mongoose.Schema({
      ...identitySchemaDefinition,
      nationality: { type: String },
      birthCountry: { type: String },
      birthState: { type: String },
      birthCity: { type: String },
      socialSecurityNumber: { type: Number },
    }, { _id: false, id: false }),
    required: true,
  },
  contact: {
    address: { type: mongoose.Schema(addressSchemaDefinition, { id: false, _id: false }) },
    phone: { type: String, validate: PHONE_VALIDATION },
  },
  mentor: { type: String },
  contracts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contract' }],
  administrative: {
    driveFolder: driveResourceSchemaDefinition,
    signup: {
      firstSmsDate: { type: Date },
      secondSmsDate: { type: Date },
      step: { type: String, default: 'first' },
      complete: { type: Boolean, default: false },
    },
    payment: {
      rib: {
        iban: { type: String },
        bic: { type: String },
      },
    },
    idCardRecto: driveResourceSchemaDefinition,
    idCardVerso: driveResourceSchemaDefinition,
    passport: driveResourceSchemaDefinition,
    residencePermitRecto: driveResourceSchemaDefinition,
    residencePermitVerso: driveResourceSchemaDefinition,
    healthAttest: driveResourceSchemaDefinition,
    vitalCard: driveResourceSchemaDefinition,
    identityDocs: { type: String },
    certificates: [driveResourceSchemaDefinition],
    phoneInvoice: driveResourceSchemaDefinition,
    navigoInvoice: driveResourceSchemaDefinition,
    transportInvoice: {
      ...driveResourceSchemaDefinition,
      transportType: { type: String, enum: TRANSPORT_TYPE },
    },
    mutualFund: {
      ...driveResourceSchemaDefinition,
      has: Boolean,
    },
    medicalCertificate: driveResourceSchemaDefinition,
    emergencyContact: {
      name: { type: String },
      phoneNumber: { type: String, validate: PHONE_VALIDATION },
    },
  },
  isConfirmed: { type: Boolean, default: false },
  establishment: { type: mongoose.Schema.Types.ObjectId, ref: 'Establishment' },
  inactivityDate: { type: Date, default: null },
  biography: { type: String },
  firstMobileConnectionDate: { type: Date },
  firstMobileConnectionMode: {
    type: String,
    enum: MOBILE_CONNECTION_MODE,
    required: () => !!this.firstMobileConnectionDate,
  },
  origin: { type: String, enum: ORIGIN_OPTIONS, required: true, immutable: true },
  formationExpoTokenList: [{ type: String }],
  loginCode: { type: String },
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
  id: false,
});

const validateEmail = (email) => {
  const emailSchema = Joi.object().keys({ email: Joi.string().email() });
  return emailSchema.validate({ email });
};

const setSerialNumber = (user) => {
  const createdAt = moment(user.createdAt).format('YYMMDD');
  const timestamp = moment(user.createdAt).valueOf().toString();
  const lastname = user.identity.lastname.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase();
  const firstname = user.identity.firstname
    ? user.identity.firstname.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase()
    : '';

  return `${lastname}${firstname}${createdAt}${timestamp.slice(-8)}`;
};

async function validate(next) {
  try {
    if (this.isNew) this.serialNumber = setSerialNumber(this);

    return next();
  } catch (e) {
    return next(e);
  }
}

async function save(next) {
  try {
    const user = this;

    if (user.isModified('local.email')) {
      const validation = validateEmail(user.local.email);
      if (validation.error) return next(Boom.badRequest(validation.error));
    }

    if (!get(user, 'local.password') || !user.isModified('local.password')) return next();

    const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
    const hash = await bcrypt.hash(user.local.password, salt);
    user.local.password = hash;

    return next();
  } catch (e) {
    return next(e);
  }
}

async function findOneAndUpdate(next) {
  try {
    const password = this.getUpdate().$set['local.password'];
    const email = this.getUpdate().$set['local.email'];
    if (!password && !email) return next();

    if (email) {
      const validation = validateEmail(email);
      if (validation.error) return next(Boom.badRequest(validation.error));
    }

    if (password) {
      const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
      const hash = await bcrypt.hash(password, salt);
      this.getUpdate().$set['local.password'] = hash;
    }

    return next();
  } catch (e) {
    return next(e);
  }
}

// eslint-disable-next-line consistent-return
function setContractCreationMissingInfo() {
  const clientRole = get(this, 'role.client.name');
  if (clientRole && [AUXILIARY, PLANNING_REFERENT, AUXILIARY_WITHOUT_COMPANY].includes(clientRole)) {
    const mandatoryInfo = [
      'identity.lastname',
      'identity.firstname',
      'identity.birthDate',
      'identity.birthCity',
      'identity.birthState',
      'identity.nationality',
      'identity.socialSecurityNumber',
      'contact.address.fullAddress',
      'establishment',
    ];

    const contractCreationMissingInfo = [];
    for (const info of mandatoryInfo) {
      if (!get(this, info)) contractCreationMissingInfo.push(info);
    }

    return contractCreationMissingInfo;
  }
}

function populateSector(doc, next) {
  // eslint-disable-next-line no-param-reassign
  if (get(doc, 'sector.sector._id')) doc.sector = doc.sector.sector._id;

  return next();
}

function populateSectors(docs, next) {
  for (const doc of docs) {
    if (doc && doc.sector) doc.sector = doc.sector.sector;
  }

  return next();
}

const getCurrentUserCompany = (userCompanies = []) => userCompanies
  .find(uc => CompaniDate().isAfter(uc.startDate) && (!uc.endDate || CompaniDate().isBefore(uc.endDate)));

function populateCompany(doc, next) {
  if (!doc) next();

  const currentUserCompany = getCurrentUserCompany(get(doc, 'company'));
  // eslint-disable-next-line no-param-reassign
  doc.company = currentUserCompany ? currentUserCompany.company : null;

  return next();
}

function populateCompanies(docs, next) {
  for (const doc of docs) {
    if (doc && doc.company) {
      const currentUserCompany = getCurrentUserCompany(doc.company);
      doc.company = currentUserCompany ? currentUserCompany.company : null;
    }
  }

  return next();
}

function populateHolding(doc, next) {
  if (!doc) next();

  // eslint-disable-next-line no-param-reassign
  doc.holding = get(doc, 'holding.length') ? doc.holding[0].holding : null;

  return next();
}

function populateHoldings(docs, next) {
  for (const doc of docs) {
    if (doc && get(doc, 'holding.length')) {
      doc.holding = doc.holding[0].holding;
    }
  }

  return next();
}

function populateCustomers(doc, next) {
  // eslint-disable-next-line no-param-reassign
  if (get(doc, 'customers.customer')) doc.customers = [doc.customers.customer];

  return next();
}

async function formatPayload(doc, next) {
  const payload = doc.toObject();

  if (get(doc, 'refreshToken')) delete payload.refreshToken;
  if (get(doc, 'passwordToken')) delete payload.passwordToken;
  if (get(doc, 'local.password')) delete payload.local.password;

  doc.overwrite(payload);

  return next();
}

UserSchema.virtual('customers', { ref: 'Helper', localField: '_id', foreignField: 'user', justOne: true });

UserSchema.virtual(
  'sector',
  {
    ref: 'SectorHistory',
    localField: '_id',
    foreignField: 'auxiliary',
    justOne: true,
    options: { sort: { startDate: -1 } },
  }
);

UserSchema.virtual(
  'sectorHistories',
  { ref: 'SectorHistory', localField: '_id', foreignField: 'auxiliary', options: { sort: { startDate: -1 } } }
);

UserSchema.virtual(
  'companyLinkRequest',
  { ref: 'CompanyLinkRequest', localField: '_id', foreignField: 'user', justOne: true }
);

UserSchema.virtual(
  'activityHistories',
  { ref: 'ActivityHistory', localField: '_id', foreignField: 'user', options: { sort: { updatedAt: -1 } } }
);

UserSchema.virtual('company', { ref: 'UserCompany', localField: '_id', foreignField: 'user' });

UserSchema.virtual(
  'userCompanyList',
  { ref: 'UserCompany', localField: '_id', foreignField: 'user', sort: { startDate: -1 } }
);

UserSchema.virtual('holding', { ref: 'UserHolding', localField: '_id', foreignField: 'user' });

UserSchema.virtual('contractCreationMissingInfo').get(setContractCreationMissingInfo);

UserSchema.pre('validate', validate);
UserSchema.pre('save', save);
UserSchema.pre('findOneAndUpdate', findOneAndUpdate);
UserSchema.pre('updateOne', findOneAndUpdate);
queryMiddlewareList.map(middleware => UserSchema.pre(middleware, formatQuery));

UserSchema.post('find', populateSectors);
UserSchema.post('find', populateCompanies);
UserSchema.post('find', populateHoldings);
UserSchema.post('findOne', populateSector);
UserSchema.post('findOne', populateCustomers);
UserSchema.post('findOne', populateCompany);
UserSchema.post('findOne', populateHolding);
UserSchema.post('findOneAndUpdate', populateCompany);
UserSchema.post('findOneAndUpdate', populateHolding);
UserSchema.post('findOneAndUpdate', populateSector);
UserSchema.post('findOneAndUpdate', populateCustomers);
UserSchema.post('save', formatPayload);

UserSchema.plugin(mongooseLeanVirtuals);
UserSchema.plugin(autopopulate);

module.exports = mongoose.model('User', UserSchema);
module.exports.TOKEN_EXPIRE_DURATION = TOKEN_EXPIRE_DURATION;
module.exports.ORIGIN_OPTIONS = ORIGIN_OPTIONS;
module.exports.USER_ROLE_LIST = USER_ROLE_LIST;
