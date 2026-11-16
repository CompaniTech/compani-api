const Boom = require('@hapi/boom');
const flat = require('flat');
const get = require('lodash/get');
const User = require('../../models/User');
const IdentityVerification = require('../../models/IdentityVerification');
const { MOBILE, PHONE, SECONDS_IN_AN_HOUR, MAX_VERIFICATION_ATTEMPTS } = require('../../helpers/constants');
const translate = require('../../helpers/translate');
const UserCompany = require('../../models/UserCompany');

const { language } = translate;

const formatLockMessage = (lockedUntil) => {
  if (!lockedUntil) return `${translate[language].tooManyAttempts} Réessayez plus tard.`;

  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));
  const delay = minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`;

  return `${translate[language].tooManyAttempts} Réessayez dans ${delay}.`;
};

exports.checkPasswordToken = async (req) => {
  const { query, params } = req;
  if (query.email) {
    const verification = await IdentityVerification
      .findOneAndUpdate(
        { email: query.email, attempts: { $not: { $gte: MAX_VERIFICATION_ATTEMPTS } } },
        { $inc: { attempts: 1 } },
        { new: true, timestamps: false }
      )
      .lean();
    if (!verification) {
      const exhausted = await IdentityVerification
        .findOne({ email: query.email, attempts: { $gte: MAX_VERIFICATION_ATTEMPTS } })
        .lean();
      const lockedUntil = exhausted && new Date(exhausted.updatedAt).getTime() + SECONDS_IN_AN_HOUR * 1000;
      if (lockedUntil > Date.now()) throw Boom.tooManyRequests(formatLockMessage(lockedUntil));

      throw Boom.notFound();
    }
    if (verification.code !== params.token) throw Boom.notFound();

    const timeElapsed = (Date.now() - verification.updatedAt) / 1000;
    if (timeElapsed > SECONDS_IN_AN_HOUR) throw Boom.unauthorized();

    const user = await User.findOne({ 'local.email': query.email }).select('local.email').lean();
    if (!user) throw Boom.notFound(translate[language].userNotFound);

    await IdentityVerification.deleteOne({ _id: verification._id });

    return user;
  }

  if (query.firstname) {
    const user = await User
      .findOne({ 'identity.firstname': query.firstname, 'identity.lastname': query.lastname, loginCode: params.token })
      .collation({ locale: 'fr', strength: 1, alternate: 'shifted' })
      .lean();

    const userCompany = await UserCompany.countDocuments({ user: get(user, '_id'), company: query.company });
    if (!user || !userCompany) throw Boom.notFound(translate[language].userNotFound);

    return user;
  }

  const filter = { passwordToken: { token: params.token, expiresIn: { $gt: Date.now() } } };
  const user = await User.findOne(flat(filter, { maxDepth: 2 })).select('local').lean();
  if (!user) throw Boom.notFound(translate[language].userNotFound);

  return user;
};

exports.authorizeForgotPassword = async (req) => {
  const { email, origin, type } = req.payload;
  if (origin !== MOBILE) return null;

  const user = await User.findOne({ 'local.email': email }, { contact: 1 }).lean();
  if (!user) throw Boom.notFound(translate[language].userNotFound);
  if (type === PHONE && !get(user, 'contact.phone')) throw Boom.conflict();

  const verification = await IdentityVerification.findOne({ email }).lean();
  if (verification && verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    const lockedUntil = new Date(verification.updatedAt).getTime() + SECONDS_IN_AN_HOUR * 1000;
    if (lockedUntil > Date.now()) throw Boom.tooManyRequests(formatLockMessage(lockedUntil));
  }

  return null;
};

exports.authorizeRefreshToken = async (req) => {
  const refreshToken = get(req, 'payload.refreshToken') || get(req, `state.${process.env.REFRESH_TOKEN}`);
  if (!refreshToken) return Boom.unauthorized();

  const user = await User.countDocuments({ refreshToken });
  if (!user) return Boom.unauthorized();

  return null;
};
