const Boom = require('@hapi/boom');
const flat = require('flat');
const get = require('lodash/get');
const User = require('../../models/User');
const IdentityVerification = require('../../models/IdentityVerification');
const {
  MOBILE,
  PHONE,
  MAX_VERIFICATION_ATTEMPTS,
  LOGIN_CODE_LOCK_DELAYS,
} = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');
const UserCompany = require('../../models/UserCompany');
const { CompaniDate } = require('../../helpers/dates/companiDates');

const { language } = translate;

// Lock the user after too many wrong attempts: the lock gets longer each time (5 min, 15 min, 1 h, then 24 h)
// and a new loginCode is generated, so that the code which was being guessed is not valid anymore
const lockLoginCode = async (user) => {
  const now = CompaniDate();

  // The previous lock count is kept only if the last lock ended less than 48 h ago, otherwise we start again at 5 min
  const lockEndDate = get(user, 'loginCodeLock.lockedUntil');
  const hasRecentLock = lockEndDate && now.isBefore(CompaniDate(lockEndDate).add('PT48H'));
  const previousLockCount = hasRecentLock ? user.loginCodeLock.count : 0;

  // The count is capped to the number of delays: after the last one, every lock lasts 24 h
  const lockCount = Math.min(previousLockCount + 1, LOGIN_CODE_LOCK_DELAYS.length);

  const lockedUntil = now.add(LOGIN_CODE_LOCK_DELAYS[lockCount - 1]).toDate();

  // loginCodeLock is replaced as a whole: attempts is dropped, so the user has 3 new attempts when the lock ends
  await User.updateOne(
    { _id: user._id },
    { $set: { loginCode: UtilsHelper.generateVerificationCode(), loginCodeLock: { count: lockCount, lockedUntil } } },
    { timestamps: false }
  );
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
      const hasExhaustedAttempts = await IdentityVerification
        .countDocuments({ email: query.email, attempts: { $gte: MAX_VERIFICATION_ATTEMPTS } });
      if (hasExhaustedAttempts) throw Boom.tooManyRequests(translate[language].tooManyAttempts);

      throw Boom.notFound();
    }
    if (verification.code !== params.token) throw Boom.notFound();

    const isExpired = CompaniDate().isAfter(CompaniDate(verification.updatedAt).add('PT1H'));
    if (isExpired) throw Boom.unauthorized();

    const user = await User.findOne({ 'local.email': query.email }).select('local.email').lean();
    if (!user) throw Boom.notFound(translate[language].userNotFound);

    await IdentityVerification.deleteOne({ _id: verification._id });

    return user;
  }

  if (query.firstname) {
    // Users are identified by name and company only: homonyms of a same company are possible
    const matchingUsers = await User
      .find(
        { 'identity.firstname': query.firstname, 'identity.lastname': query.lastname, loginCode: { $exists: true } },
        { _id: 1, loginCode: 1, loginCodeLock: 1 }
      )
      .collation({ locale: 'fr', strength: 1, alternate: 'shifted' })
      .lean();
    const userCompanies = await UserCompany
      .find({ user: { $in: matchingUsers.map(u => u._id) }, company: query.company }, { user: 1 })
      .lean();
    const companyUsers = matchingUsers
      .filter(u => userCompanies.some(uc => UtilsHelper.areObjectIdsEquals(uc.user, u._id)));

    // Right code: the user is returned only if he is not locked (checked in db, so it is safe with parallel requests).
    // No attempt is counted for a right code.
    const matchingCodeUser = companyUsers.find(u => u.loginCode === params.token);
    if (matchingCodeUser) {
      const user = await User
        .findOne(
          {
            _id: matchingCodeUser._id,
            loginCode: params.token,
            'loginCodeLock.attempts': { $not: { $gte: MAX_VERIFICATION_ATTEMPTS } },
            'loginCodeLock.lockedUntil': { $not: { $gt: CompaniDate().toDate() } },
          },
          { 'local.email': 1, loginCode: 1, loginCodeLock: 1 }
        )
        .lean();
      if (user) return user;
    }

    // Wrong code: count an attempt for every candidate, even homonyms, because we can't know who is targeted.
    // The filter excludes locked users, so attemptedUsers only contains users that were not locked.
    const usersWithUpdatedAttempts = (
      await Promise.all(
        companyUsers
          .map(u => User.findOneAndUpdate(
            {
              _id: u._id,
              'loginCodeLock.attempts': { $not: { $gte: MAX_VERIFICATION_ATTEMPTS } },
              'loginCodeLock.lockedUntil': { $not: { $gt: CompaniDate().toDate() } },
            },
            { $inc: { 'loginCodeLock.attempts': 1 } },
            { new: true, timestamps: false, projection: { 'local.email': 1, loginCode: 1, loginCodeLock: 1 } }
          )
            .lean()))
    ).filter(Boolean);

    // Users who just reached the max attempts are locked and get a new login code
    const usersToLock = usersWithUpdatedAttempts.filter(u => u.loginCodeLock.attempts >= MAX_VERIFICATION_ATTEMPTS);
    await Promise.all(usersToLock.map(lockLoginCode));
    // No attempt could be counted for any candidate: they are all locked, answer 429 and not 404,
    // so that the user knows that his code is not the problem
    const areAllUsersLocked = companyUsers.length && !usersWithUpdatedAttempts.length;
    if (usersToLock.length || areAllUsersLocked) {
      throw Boom.tooManyRequests(translate[language].tooManyAttempts);
    }

    throw Boom.notFound(translate[language].userNotFound);
  }

  const filter = { passwordToken: { token: params.token, expiresIn: { $gt: Date.now() } } };
  const user = await User.findOne(flat(filter, { maxDepth: 2 })).select('local').lean();
  if (!user) throw Boom.notFound(translate[language].userNotFound);

  return user;
};

// a new code can't be asked while the last one has been tried too many times in the last hour
exports.authorizeForgotPassword = async (req) => {
  const { email, origin, type } = req.payload;
  if (origin !== MOBILE) return null;

  const user = await User.findOne({ 'local.email': email }, { contact: 1 }).lean();
  if (!user) throw Boom.notFound(translate[language].userNotFound);
  if (type === PHONE && !get(user, 'contact.phone')) throw Boom.conflict();

  const verification = await IdentityVerification.findOne({ email }).lean();
  if (verification && verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    const isRecent = !CompaniDate().isAfter(CompaniDate(verification.updatedAt).add('PT1H'));
    if (isRecent) throw Boom.tooManyRequests(translate[language].tooManyAttempts);
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
