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
        $unset: { loginCode: '' },
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

exports.sendToken = (user) => {
  const payload = pickBy({ _id: user._id, email: user.local.email });

  return { token: exports.encode(payload), user: payload };
};

exports.createPasswordToken = async email => exports.generatePasswordToken(email, 24 * 3600 * 1000); // 1 day

exports.forgotPassword = async (payload) => {
  const { email, origin, type } = payload;
  if (origin === MOBILE) {
    const code = String(Math.floor(Math.random() * 9000 + 1000));
    let verification = await IdentityVerification.findOneAndUpdate({ email }, { $set: { code } }, { new: true }).lean();
    if (!verification) verification = await IdentityVerification.create({ email, code });

    if (type === EMAIL) return EmailHelper.sendVerificationCodeEmail(email, verification.code);

    const user = await User.findOne({ 'local.email': email }, { contact: 1 }).lean();
    if (!get(user, 'contact.phone')) throw Boom.conflict();

    return SmsHelper.sendVerificationCodeSms(user.contact, verification.code);
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
