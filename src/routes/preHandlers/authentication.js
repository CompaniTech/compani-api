const Boom = require('@hapi/boom');
const flat = require('flat');
const get = require('lodash/get');
const User = require('../../models/User');
const IdentityVerification = require('../../models/IdentityVerification');
const { SECONDS_IN_AN_HOUR } = require('../../helpers/constants');
const translate = require('../../helpers/translate');
const UserCompany = require('../../models/UserCompany');

const { language } = translate;

exports.checkPasswordToken = async (req) => {
  const { query, params } = req;
  if (query.email) {
    const code = await IdentityVerification.findOne({ email: query.email, code: params.token }).lean();
    if (!code) throw Boom.notFound();

    const timeElapsed = (Date.now() - code.updatedAt) / 1000;
    if (timeElapsed > SECONDS_IN_AN_HOUR) throw Boom.unauthorized();

    const user = await User.findOne({ 'local.email': query.email }).select('local.email').lean();
    if (!user) throw Boom.notFound(translate[language].userNotFound);

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

exports.authorizeRefreshToken = async (req) => {
  const refreshToken = get(req, 'payload.refreshToken') || get(req, `state.${process.env.REFRESH_TOKEN}`);
  if (!refreshToken) return Boom.unauthorized();

  const user = await User.countDocuments({ refreshToken });
  if (!user) return Boom.unauthorized();

  return null;
};
