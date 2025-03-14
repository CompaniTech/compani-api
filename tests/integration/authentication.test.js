const { expect } = require('expect');
const sinon = require('sinon');
const app = require('../../server');
const User = require('../../src/models/User');
const { usersSeedList, populateDB } = require('./seed/usersSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { noRoleNoCompany } = require('../seed/authUsersSeed');
const EmailHelper = require('../../src/helpers/email');
const SmsHelper = require('../../src/helpers/sms');
const { MOBILE, EMAIL, PHONE, AUTHENTICATION } = require('../../src/helpers/constants');
const UtilsMock = require('../utilsMock');
const { authCompany, otherCompany } = require('../seed/authCompaniesSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('AUTHENTICATION ROUTES - POST /users/authenticate', () => {
  beforeEach(populateDB);

  it('should authenticate a user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users/authenticate',
      payload: { email: 'carolyn@alenvi.io', password: '123456!eR', origin: 'webapp' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data).toBeDefined();
  });

  it('should authenticate a user and set firstMobileConnection info', async () => {
    UtilsMock.mockCurrentDate('2020-12-08T13:45:25.437Z');
    const payload = {
      email: 'norole.nocompany@userseed.fr',
      password: 'fdsf5P56D',
      origin: 'mobile',
      mobileConnectionMode: AUTHENTICATION,
    };

    const response = await app.inject({
      method: 'POST',
      url: '/users/authenticate',
      payload,
    });

    expect(response.statusCode).toBe(200);
    const user = await User.findOne({ _id: response.result.data.user._id }).lean();
    expect(user.firstMobileConnectionDate).toEqual(new Date('2020-12-08T13:45:25.437Z'));
    expect(user.firstMobileConnectionMode).toEqual(AUTHENTICATION);
    UtilsMock.unmockCurrentDate();
  });

  it('should not authenticate a user if missing password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/authenticate',
      payload: { email: 'black@alenvi.io' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should not authenticate a user if origin is Mobile and firstMobileConnectionMode is missing', async () => {
    const payload = { email: 'norole.nocompany@userseed.fr', password: 'fdsf5P56D', origin: 'mobile' };

    const res = await app.inject({
      method: 'POST',
      url: '/users/authenticate',
      payload,
    });
    expect(res.statusCode).toBe(400);
  });

  it('should not authenticate a user if user does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/authenticate',
      payload: { email: 'test@alenvi.io', password: '123456!eR' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should not authenticate a user if wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/authenticate',
      payload: { email: 'black@alenvi.io', password: '7890' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should not authenticate a user if refreshToken is missing', async () => {
    await User.findOneAndUpdate({ 'local.email': 'white@alenvi.io' }, { $unset: { refreshToken: '' } });
    const res = await app.inject({
      method: 'POST',
      url: '/users/authenticate',
      payload: { email: 'white@alenvi.io', password: '123456!eR' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('AUTHENTICATION ROUTES - PUT /users/:id/password', () => {
  let authToken;
  const updatePayload = { local: { password: '123456!eR' } };

  describe('It\'s me', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
    });

    it('should update user password if it is me', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/users/${noRoleNoCompany._id}/password`,
        payload: updatePayload,
        headers: { 'x-access-token': authToken },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should return a 400 error if password too short', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/users/${noRoleNoCompany._id}/password`,
        payload: { local: { password: '12345' } },
        headers: { 'x-access-token': authToken },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'vendor_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'PUT',
          url: `/users/${usersSeedList[0]._id}/password`,
          payload: updatePayload,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('AUTHENTICATION ROUTES - POST /users/refreshToken', () => {
  beforeEach(populateDB);

  it('[WEBAPP] should return refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/refreshToken',
      headers: { Cookie: `refresh_token=${usersSeedList[1].refreshToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.result.data).toBeDefined();
  });

  it('[MOBILE] should return refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/refreshToken',
      payload: { refreshToken: usersSeedList[1].refreshToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.result.data).toBeDefined();
  });

  it('[WEBAPP] should return a 401 error when refresh token isn\'t good', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/refreshToken',
      headers: { Cookie: 'refresh_token=false-refresh-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('[MOBILE] should return a 401 error when refresh token isn\'t good', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/refreshToken',
      payload: { refreshToken: 'false-refresh-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('[WEBAPP] should return a 401 error when refresh is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/refreshToken',
      headers: { Cookie: 'refresh_token=' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('[MOBILE] should return a 401 error when refresh is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/refreshToken',
      payload: { refreshToken: null },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('AUTHENTICATION ROUTES - GET /users/passwordtoken/:token', () => {
  beforeEach(populateDB);
  let fakeDate;
  beforeEach(() => {
    fakeDate = sinon.stub(Date, 'now');
  });
  afterEach(() => {
    fakeDate.restore();
  });

  it('should return a new access token after checking reset password token', async () => {
    fakeDate.returns(new Date('2020-01-20'));

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${usersSeedList[3].passwordToken.token}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.token).toEqual(expect.any(String));
  });

  it('should return a new access token after checking verification code from mobile', async () => {
    const token = '3310';
    const { email } = usersSeedList[3].local;
    fakeDate.returns(new Date('2021-01-25T10:08:32.582Z'));

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?email=${email}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.token).toEqual(expect.any(String));
  });

  it('should return a 404 error if verification code is wrong', async () => {
    const token = '3311';
    const { email } = usersSeedList[3].local;
    fakeDate.returns(new Date('2021-01-26T10:08:32.582Z'));

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?email=${email}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return a 404 error if token is not valid', async () => {
    const token = '1234567890';
    const { email } = usersSeedList[3].local;
    fakeDate.returns(new Date('2021-01-25T10:08:32.582Z'));

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?email=${email}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 401 if code is too old', async () => {
    const token = '3310';
    const { email } = usersSeedList[3].local;
    fakeDate.returns(new Date('2021-01-26T10:08:32.582Z'));

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?email=${email}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 200 if user exists in bdd', async () => {
    // spaces and diacritics are important to test .collation({ locale: 'fr', strength: 1, alternate: 'shifted' });
    const firstname = 'Hélper1    ';
    const company = authCompany._id;
    const { loginCode: token, identity: { lastname } } = usersSeedList[3];

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?firstname=${firstname}&lastname=${lastname}&company=${company}`,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should return 400 if both email and firstname are in query', async () => {
    const company = authCompany._id;
    const { loginCode: token, local: { email }, identity: { firstname, lastname } } = usersSeedList[3];

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?email=${email}&firstname=${firstname}&lastname=${lastname}`
      + `&company=${company}`,
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 if lastname is missing in query', async () => {
    const company = authCompany._id;
    const { loginCode: token, identity: { firstname } } = usersSeedList[3];

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?firstname=${firstname}&company=${company}`,
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 if company is missing in query', async () => {
    const { loginCode: token, identity: { firstname, lastname } } = usersSeedList[3];

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?firstname=${firstname}&lastname=${lastname}`,
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 if token is not correct', async () => {
    const token = '1294';
    const company = authCompany._id;
    const { identity: { lastname, firstname } } = usersSeedList[3];

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?firstname=${firstname}&lastname=${lastname}&company=${company}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 404 if company is not correct', async () => {
    const company = otherCompany._id;
    const { loginCode: token, identity: { lastname, firstname } } = usersSeedList[3];

    const response = await app.inject({
      method: 'GET',
      url: `/users/passwordtoken/${token}?firstname=${firstname}&lastname=${lastname}&company=${company}`,
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('AUTHENTICATION ROUTES - POST /users/forgot-password', () => {
  let forgotPasswordEmail;
  let sendVerificationCodeEmail;
  let sendVerificationCodeSms;
  beforeEach(populateDB);
  beforeEach(() => {
    forgotPasswordEmail = sinon.stub(EmailHelper, 'forgotPasswordEmail');
    sendVerificationCodeEmail = sinon.stub(EmailHelper, 'sendVerificationCodeEmail');
    sendVerificationCodeSms = sinon.stub(SmsHelper, 'sendVerificationCodeSms');
  });
  afterEach(() => {
    forgotPasswordEmail.restore();
    sendVerificationCodeEmail.restore();
    sendVerificationCodeSms.restore();
  });

  it('should send an email to renew password', async () => {
    const userEmail = usersSeedList[0].local.email;
    const response = await app.inject({
      method: 'POST',
      url: '/users/forgot-password',
      payload: { email: userEmail },
    });

    expect(response.statusCode).toBe(200);
    sinon.assert.calledWith(
      forgotPasswordEmail,
      userEmail,
      sinon.match({ token: sinon.match.string, expiresIn: sinon.match.number })
    );
  });

  it('should send a code verification by email if origin mobile and type email', async () => {
    const userEmail = usersSeedList[0].local.email;
    const response = await app.inject({
      method: 'POST',
      url: '/users/forgot-password',
      payload: { email: userEmail, origin: MOBILE, type: EMAIL },
    });

    expect(response.statusCode).toBe(200);
    sinon.assert.calledWith(sendVerificationCodeEmail, userEmail, sinon.match(sinon.match.string));
  });

  it('should send a code verification by sms if origin mobile and type phone', async () => {
    const userEmail = usersSeedList[0].local.email;
    const response = await app.inject({
      method: 'POST',
      url: '/users/forgot-password',
      payload: { email: userEmail, origin: MOBILE, type: PHONE },
    });

    expect(response.statusCode).toBe(200);
    sinon.assert.calledWith(sendVerificationCodeSms, usersSeedList[0].contact, sinon.match(sinon.match.string));
  });

  it('should return 400 if origin mobile and wrong type', async () => {
    const userEmail = usersSeedList[0].local.email;
    const response = await app.inject({
      method: 'POST',
      url: '/users/forgot-password',
      payload: { email: userEmail, origin: MOBILE, type: 'SMS' },
    });

    expect(response.statusCode).toBe(400);
    sinon.assert.notCalled(sendVerificationCodeEmail);
  });

  it('should be compatible with old mobile app version', async () => {
    const userEmail = usersSeedList[0].local.email;
    const response = await app.inject({
      method: 'POST',
      url: '/users/forgot-password',
      payload: { email: userEmail },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data).toBeDefined();
    sinon.assert.calledWith(
      forgotPasswordEmail,
      userEmail,
      sinon.match({ token: sinon.match.string, expiresIn: sinon.match.number })
    );
  });

  it('should return a 404 error if user does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users/forgot-password',
      payload: { email: 't@t.com' },
    });

    expect(response.statusCode).toBe(404);
  });
});
