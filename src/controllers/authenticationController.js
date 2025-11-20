const Boom = require('@hapi/boom');
const get = require('lodash/get');
const translate = require('../helpers/translate');
const AuthenticationHelper = require('../helpers/authentication');

const { language } = translate;

const authenticate = async (req, h) => {
  try {
    const authentication = await AuthenticationHelper.authenticate(req.payload);
    req.log('info', `${req.payload.email} connected`);

    return h.response({ message: translate[language].userAuthentified, data: { ...authentication } })
      .state(process.env.ALENVI_TOKEN, authentication.token)
      .state(process.env.REFRESH_TOKEN, authentication.refreshToken);
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

/**
 * From MOBILE, refreshToken is in the payload
 * From WEBAPP, refresh_token is in the state
 */
const refreshToken = async (req, h) => {
  try {
    const userRefreshToken = get(req, 'payload.refreshToken') || get(req, `state.${process.env.REFRESH_TOKEN}`);
    const token = await AuthenticationHelper.refreshToken(userRefreshToken);

    return h.response({ message: translate[language].userAuthentified, data: { ...token } })
      .state(process.env.ALENVI_TOKEN, token.token)
      .state(process.env.REFRESH_TOKEN, token.refreshToken);
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const logout = async (req, h) => {
  try {
    return h.response({ message: translate[language].userLogout })
      .unstate(process.env.ALENVI_TOKEN)
      .unstate(process.env.REFRESH_TOKEN);
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const forgotPassword = async (req) => {
  try {
    const mailInfo = await AuthenticationHelper.forgotPassword(req.payload);

    return { message: translate[language].emailSent, data: { mailInfo } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const sendToken = async (req, h) => {
  try {
    const token = await AuthenticationHelper.sendToken(req.pre.user);

    return h.response({ message: translate[language].resetPasswordTokenFound, data: { ...token } })
      .state(process.env.ALENVI_TOKEN, token.token);
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const updatePassword = async (req) => {
  try {
    const updatedUser = await AuthenticationHelper.updatePassword(req.params._id, req.payload);

    return { message: translate[language].userUpdated, data: { updatedUser } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  authenticate,
  logout,
  refreshToken,
  forgotPassword,
  sendToken,
  updatePassword,
};
