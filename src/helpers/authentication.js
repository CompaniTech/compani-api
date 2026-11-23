const jwt = require('jsonwebtoken');
const Boom = require('@hapi/boom');
const bcrypt = require('bcryptjs');
const pickBy = require('lodash/pickBy');
const get = require('lodash/get');
const flat = require('flat');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { TOKEN_EXPIRE_DURATION } = require('../models/User');
const IdentityVerification = require('../models/IdentityVerification');
const translate = require('./translate');
const { MOBILE, EMAIL } = require('./constants');
const EmailHelper = require('./email');
const SmsHelper = require('./sms');
const UtilsHelper = require('./utils');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');

const { language } = translate;

exports.encode = payload => jwt
  .sign(payload, process.env.TOKEN_SECRET, { expiresIn: CompaniDuration(TOKEN_EXPIRE_DURATION).asSeconds() });

exports.authenticate = async (payload) => {
  const { email, origin, password } = payload;

  const user = await User.findOne({ 'local.email': email.toLowerCase() }).select('local refreshToken').lean();

  const correctPassword = get(user, 'local.password') || '';
  const isCorrect = await bcrypt.compare(password, correctPassword);
  if (!user || !user.refreshToken || !correctPassword || !isCorrect) throw Boom.unauthorized();

  const tokenPayload = { _id: user._id.toHexString() };
  const token = exports.encode(tokenPayload);

  if (origin === MOBILE && !user.firstMobileConnectionDate) {
    await User.updateOne(
      { _id: user._id, firstMobileConnectionDate: { $exists: false } },
      {
        $set: {
          firstMobileConnectionDate: CompaniDate().toISO(),
          firstMobileConnectionMode: payload.mobileConnectionMode,
        },
        $unset: { loginCode: '', loginCodeLock: '' },
      }
    );
  }

  return {
    token,
    tokenExpireDate: CompaniDate().add(TOKEN_EXPIRE_DURATION).toISO(),
    refreshToken: user.refreshToken,
    user: tokenPayload,
  };
};

exports.refreshToken = async (refreshToken) => {
  const user = await User.findOne({ refreshToken }, { _id: 1 }).lean();

  const tokenPayload = { _id: user._id.toHexString() };
  const token = exports.encode(tokenPayload);

  return {
    token,
    tokenExpireDate: CompaniDate().add(TOKEN_EXPIRE_DURATION).toISO(),
    refreshToken,
    user: tokenPayload,
  };
};

exports.updatePassword = async (userId, userPayload) => User.findOneAndUpdate(
  { _id: userId },
  { $set: flat(userPayload), $unset: { passwordToken: '' } },
  { new: true }
).lean();

exports.sendToken = async (user) => {
  const payload = pickBy({ _id: user._id, email: user.local.email });

  if (user.loginCodeLock) {
    await User.updateOne({ _id: user._id }, { $unset: { loginCodeLock: '' } }, { timestamps: false });
  }

  return { token: exports.encode(payload), user: payload };
};

exports.createPasswordToken = async email => exports.generatePasswordToken(email, 24 * 3600 * 1000); // 1 day

exports.forgotPassword = async (payload) => {
  const { email, origin, type } = payload;
  if (origin === MOBILE) {
    const code = UtilsHelper.generateVerificationCode();
    const verification = await IdentityVerification.findOne({ email }, { updatedAt: 1 }).lean();
    if (verification) {
      const isOlderThanOneHour = CompaniDate().isAfter(CompaniDate(verification.updatedAt).add('PT1H'));
      await IdentityVerification.updateOne(
        { _id: verification._id },
        { $set: { code, ...(isOlderThanOneHour && { attempts: 0 }) } }
      );
    } else await IdentityVerification.create({ email, code });

    if (type === EMAIL) return EmailHelper.sendVerificationCodeEmail(email, code);

    const user = await User.findOne({ 'local.email': email }, { contact: 1 }).lean();

    return SmsHelper.sendVerificationCodeSms(user.contact, code);
  }

  const passwordToken = await exports.generatePasswordToken(email, 3600000);

  return EmailHelper.forgotPasswordEmail(email, passwordToken);
};

exports.generatePasswordToken = async (email, time) => {
  const payload = { passwordToken: { token: uuidv4(), expiresIn: Date.now() + time } };
  const user = await User.findOneAndUpdate({ 'local.email': email }, { $set: payload }, { new: true }).lean();
  if (!user) throw Boom.notFound(translate[language].userNotFound);

  return payload.passwordToken;
};
