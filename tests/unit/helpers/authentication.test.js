const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const sinon = require('sinon');
const Boom = require('@hapi/boom');
const bcrypt = require('bcryptjs');
const SinonMongoose = require('../sinonMongoose');
const AuthenticationHelper = require('../../../src/helpers/authentication');
const EmailHelper = require('../../../src/helpers/email');
const SmsHelper = require('../../../src/helpers/sms');
const translate = require('../../../src/helpers/translate');
const { MOBILE, EMAIL, PHONE, AUTHENTICATION, LOGIN_CODE } = require('../../../src/helpers/constants');
const CompaniDatesHelper = require('../../../src/helpers/dates/companiDates');
const User = require('../../../src/models/User');
const IdentityVerification = require('../../../src/models/IdentityVerification');
const UtilsMock = require('../../utilsMock');

const { language } = translate;

describe('authenticate', () => {
  let findOne;
  let updateOne;
  let compare;
  let encode;
  let formatMiscToCompaniDate;
  beforeEach(() => {
    findOne = sinon.stub(User, 'findOne');
    updateOne = sinon.stub(User, 'updateOne');
    compare = sinon.stub(bcrypt, 'compare');
    encode = sinon.stub(AuthenticationHelper, 'encode');
    formatMiscToCompaniDate = sinon.spy(CompaniDatesHelper, '_formatMiscToCompaniDate');
    UtilsMock.mockCurrentDate('2022-09-18T10:00:00.000Z');
  });
  afterEach(() => {
    findOne.restore();
    updateOne.restore();
    compare.restore();
    encode.restore();
    formatMiscToCompaniDate.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should authenticate user and set firstMobileConnection info', async () => {
    const payload = {
      email: 'toto@email.com',
      password: 'toto',
      origin: 'mobile',
      mobileConnectionMode: AUTHENTICATION,
    };
    const user = { _id: new ObjectId(), refreshToken: 'refreshToken', local: { password: 'toto' } };
    findOne.returns(SinonMongoose.stubChainedQueries(user, ['select', 'lean']));
    compare.returns(true);
    encode.returns('token');

    const result = await AuthenticationHelper.authenticate(payload);

    expect(result).toEqual({
      token: 'token',
      tokenExpireDate: '2022-09-19T10:00:00.000Z',
      refreshToken: 'refreshToken',
      user: { _id: user._id.toHexString() },
    });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ 'local.email': 'toto@email.com' }] },
        { query: 'select', args: ['local refreshToken'] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: user._id, firstMobileConnectionDate: { $exists: false } },
      {
        $set: { firstMobileConnectionDate: '2022-09-18T10:00:00.000Z', firstMobileConnectionMode: AUTHENTICATION },
        $unset: { loginCode: '' },
      }
    );
    sinon.assert.calledOnceWithExactly(compare, payload.password, 'toto');
    sinon.assert.calledOnceWithExactly(encode, { _id: user._id.toHexString() });
    sinon.assert.calledTwice(formatMiscToCompaniDate);
    sinon.assert.calledWithExactly(formatMiscToCompaniDate.getCall(0));
    sinon.assert.calledWithExactly(formatMiscToCompaniDate.getCall(1));
  });

  it('should authenticate user but not set firstMobileConnection info (authentication from webapp)', async () => {
    const payload = { email: 'toto@email.com', password: 'toto', origin: 'webapp' };
    const user = { _id: new ObjectId(), refreshToken: 'refreshToken', local: { password: 'toto' } };

    findOne.returns(SinonMongoose.stubChainedQueries(user, ['select', 'lean']));
    compare.returns(true);
    encode.returns('token');

    const result = await AuthenticationHelper.authenticate(payload);

    expect(result).toEqual({
      token: 'token',
      tokenExpireDate: '2022-09-19T10:00:00.000Z',
      refreshToken: 'refreshToken',
      user: { _id: user._id.toHexString() },
    });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ 'local.email': payload.email.toLowerCase() }] },
        { query: 'select', args: ['local refreshToken'] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(updateOne);
    sinon.assert.calledOnceWithExactly(compare, payload.password, 'toto');
    sinon.assert.calledOnceWithExactly(encode, { _id: user._id.toHexString() });
    sinon.assert.calledOnceWithExactly(formatMiscToCompaniDate);
  });

  it('should authenticate user but not set firstMobileConnection info (this info is already set)', async () => {
    const payload = {
      email: 'toto@email.com',
      password: 'toto',
      origin: 'mobile',
      mobileConnectionMode: AUTHENTICATION,
    };
    const user = {
      _id: new ObjectId(),
      refreshToken: 'refreshToken',
      local: { password: 'toto' },
      firstMobileConnectionDate: '2020-12-08T13:45:25.437Z',
      firstMobileConnectionMode: LOGIN_CODE,
    };

    findOne.returns(SinonMongoose.stubChainedQueries(user, ['select', 'lean']));
    compare.returns(true);
    encode.returns('token');

    const result = await AuthenticationHelper.authenticate(payload);

    expect(result).toEqual({
      token: 'token',
      tokenExpireDate: '2022-09-19T10:00:00.000Z',
      refreshToken: 'refreshToken',
      user: { _id: user._id.toHexString() },
    });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ 'local.email': payload.email.toLowerCase() }] },
        { query: 'select', args: ['local refreshToken'] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(updateOne);
    sinon.assert.calledOnceWithExactly(compare, payload.password, 'toto');
    sinon.assert.calledOnceWithExactly(encode, { _id: user._id.toHexString() });
    sinon.assert.calledOnceWithExactly(formatMiscToCompaniDate);
  });

  it('should throw an error if user does not exist', async () => {
    const payload = { email: 'toto@email.com', password: '123456!eR' };

    try {
      findOne.returns(SinonMongoose.stubChainedQueries(null, ['select', 'lean']));

      await AuthenticationHelper.authenticate(payload);
    } catch (e) {
      expect(e.output.statusCode).toEqual(401);
    } finally {
      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ 'local.email': payload.email.toLowerCase() }] },
          { query: 'select', args: ['local refreshToken'] },
          { query: 'lean' },
        ]
      );
      sinon.assert.notCalled(updateOne);
      sinon.assert.calledOnceWithExactly(compare, '123456!eR', '');
      sinon.assert.notCalled(encode);
      sinon.assert.notCalled(formatMiscToCompaniDate);
    }
  });

  it('should throw an error if refresh token does not exist', async () => {
    const payload = { email: 'toto@email.com', password: '123456!eR' };
    try {
      findOne.returns(SinonMongoose.stubChainedQueries({ _id: new ObjectId() }, ['select', 'lean']));

      await AuthenticationHelper.authenticate(payload);
    } catch (e) {
      expect(e.output.statusCode).toEqual(401);
    } finally {
      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ 'local.email': payload.email.toLowerCase() }] },
          { query: 'select', args: ['local refreshToken'] },
          { query: 'lean' },
        ]
      );
      sinon.assert.notCalled(updateOne);
      sinon.assert.calledOnceWithExactly(compare, '123456!eR', '');
      sinon.assert.notCalled(encode);
      sinon.assert.notCalled(formatMiscToCompaniDate);
    }
  });

  it('should throw an error if wrong password', async () => {
    try {
      const payload = { email: 'toto@email.com', password: '123456!eR' };

      findOne.returns(SinonMongoose.stubChainedQueries(
        { _id: new ObjectId(), refreshToken: 'refreshToken', local: { password: 'password_hash' } },
        ['select', 'lean']
      ));
      compare.returns(false);

      await AuthenticationHelper.authenticate(payload);
    } catch (e) {
      expect(e.output.statusCode).toEqual(401);
    } finally {
      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ 'local.email': 'toto@email.com' }] },
          { query: 'select', args: ['local refreshToken'] },
          { query: 'lean' },
        ]
      );
      sinon.assert.notCalled(updateOne);
      sinon.assert.calledOnceWithExactly(compare, '123456!eR', 'password_hash');
      sinon.assert.notCalled(encode);
      sinon.assert.notCalled(formatMiscToCompaniDate);
    }
  });
});

describe('refreshToken', () => {
  let findOne;
  let encode;
  let formatMiscToCompaniDate;
  beforeEach(() => {
    findOne = sinon.stub(User, 'findOne');
    encode = sinon.stub(AuthenticationHelper, 'encode');
    formatMiscToCompaniDate = sinon.spy(CompaniDatesHelper, '_formatMiscToCompaniDate');
    UtilsMock.mockCurrentDate('2022-09-18T10:00:00.000Z');
  });
  afterEach(() => {
    findOne.restore();
    encode.restore();
    formatMiscToCompaniDate.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should return refresh token', async () => {
    const user = { _id: new ObjectId(), refreshToken: 'refreshToken', local: { password: 'toto' } };

    findOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    encode.returns('token');

    const result = await AuthenticationHelper.refreshToken('refreshToken');

    expect(result).toEqual({
      token: 'token',
      tokenExpireDate: '2022-09-19T10:00:00.000Z',
      refreshToken: 'refreshToken',
      user: { _id: user._id.toHexString() },
    });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ refreshToken: 'refreshToken' }, { _id: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.calledWithExactly(encode, { _id: user._id.toHexString() });
    sinon.assert.calledOnceWithExactly(formatMiscToCompaniDate);
  });
});

describe('updatePassword', () => {
  let findOneAndUpdate;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(User, 'findOneAndUpdate');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
  });

  it('should update a user password', async () => {
    const userId = new ObjectId();
    const payload = { local: { password: '123456!eR' } };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(
      { _id: userId, local: { password: '123456!eR' } },
      ['lean']
    ));

    const result = await AuthenticationHelper.updatePassword(userId, payload);

    expect(result).toEqual({ _id: userId, local: { password: '123456!eR' } });
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { _id: userId },
            { $set: { 'local.password': '123456!eR' }, $unset: { passwordToken: '' } },
            { new: true },
          ],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('sendToken', () => {
  let encode;
  beforeEach(() => {
    encode = sinon.stub(AuthenticationHelper, 'encode');
  });
  afterEach(() => {
    encode.restore();
  });

  it('should return token with user', async () => {
    const email = 'carolyn@alenvi.io';
    const user = { _id: new ObjectId(), local: { email } };
    const userPayload = { _id: user._id, email };

    encode.returns('1234567890');

    const result = await AuthenticationHelper.sendToken(user);
    expect(result).toEqual({ token: '1234567890', user: userPayload });
    sinon.assert.calledWithExactly(encode, userPayload);
  });
});

describe('createPasswordToken', () => {
  let generatePasswordTokenStub;

  beforeEach(() => {
    generatePasswordTokenStub = sinon.stub(AuthenticationHelper, 'generatePasswordToken');
  });
  afterEach(() => {
    generatePasswordTokenStub.restore();
  });

  it('should return a new password token', async () => {
    const email = 'toto@toto.com';
    generatePasswordTokenStub.returns({ token: '123456789' });

    const passwordToken = await AuthenticationHelper.createPasswordToken(email);

    sinon.assert.calledOnceWithExactly(generatePasswordTokenStub, email, 24 * 3600 * 1000);
    expect(passwordToken).toEqual({ token: '123456789' });
  });
});

describe('forgotPassword', () => {
  let forgotPasswordEmail;
  let sendVerificationCodeEmail;
  let sendVerificationCodeSms;
  let generatePasswordTokenStub;
  let identityVerificationFindOneAndUpdate;
  let identityVerificationCreate;
  let codeVerification;
  let userFindOne;

  beforeEach(() => {
    forgotPasswordEmail = sinon.stub(EmailHelper, 'forgotPasswordEmail');
    sendVerificationCodeEmail = sinon.stub(EmailHelper, 'sendVerificationCodeEmail');
    sendVerificationCodeSms = sinon.stub(SmsHelper, 'sendVerificationCodeSms');
    generatePasswordTokenStub = sinon.stub(AuthenticationHelper, 'generatePasswordToken');
    identityVerificationFindOneAndUpdate = sinon.stub(IdentityVerification, 'findOneAndUpdate');
    identityVerificationCreate = sinon.stub(IdentityVerification, 'create');
    codeVerification = sinon.stub(Math, 'random');
    userFindOne = sinon.stub(User, 'findOne');
  });
  afterEach(() => {
    forgotPasswordEmail.restore();
    sendVerificationCodeEmail.restore();
    sendVerificationCodeSms.restore();
    generatePasswordTokenStub.restore();
    identityVerificationFindOneAndUpdate.restore();
    identityVerificationCreate.restore();
    codeVerification.restore();
    userFindOne.restore();
  });

  it('should return a new access token after checking reset password token', async () => {
    const email = 'toto@toto.com';
    generatePasswordTokenStub.returns({ token: '123456789' });
    forgotPasswordEmail.returns({ sent: true });

    const result = await AuthenticationHelper.forgotPassword({ email });

    expect(result).toEqual({ sent: true });
    sinon.assert.calledOnceWithExactly(generatePasswordTokenStub, email, 3600000);
    sinon.assert.calledWithExactly(forgotPasswordEmail, email, { token: '123456789' });
    sinon.assert.notCalled(sendVerificationCodeEmail);
    sinon.assert.notCalled(identityVerificationFindOneAndUpdate);
    sinon.assert.notCalled(identityVerificationCreate);
    sinon.assert.notCalled(codeVerification);
    sinon.assert.notCalled(userFindOne);
    sinon.assert.notCalled(sendVerificationCodeSms);
  });

  it('should create and send a verification code if origin mobile and type email', async () => {
    const email = 'toto@toto.com';
    codeVerification.returns(0.1111);
    identityVerificationFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries(null, ['lean']));
    identityVerificationCreate.returns({ email, code: '1999' });
    sendVerificationCodeEmail.returns({ sent: true });

    const result = await AuthenticationHelper.forgotPassword({ email, origin: MOBILE, type: EMAIL });

    expect(result).toEqual({ sent: true });
    sinon.assert.calledWithExactly(sendVerificationCodeEmail, email, '1999');
    sinon.assert.notCalled(forgotPasswordEmail);
    sinon.assert.notCalled(generatePasswordTokenStub);
    sinon.assert.notCalled(sendVerificationCodeSms);
    sinon.assert.calledOnceWithExactly(identityVerificationCreate, { email, code: '1999' });
    SinonMongoose.calledOnceWithExactly(
      identityVerificationFindOneAndUpdate,
      [{ query: 'findOneAndUpdate', args: [{ email }, { $set: { code: '1999' } }, { new: true }] }, { query: 'lean' }]
    );
  });

  it('should update and send new verification code if already exists one', async () => {
    const email = 'toto@toto.com';
    codeVerification.returns(0.1111);
    identityVerificationFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries({ email, code: '1999' }, ['lean']));
    identityVerificationCreate.returns(null);
    sendVerificationCodeEmail.returns({ sent: true });

    const result = await AuthenticationHelper.forgotPassword({ email, origin: MOBILE, type: EMAIL });

    expect(result).toEqual({ sent: true });
    sinon.assert.calledWithExactly(sendVerificationCodeEmail, email, '1999');
    sinon.assert.notCalled(forgotPasswordEmail);
    sinon.assert.notCalled(generatePasswordTokenStub);
    sinon.assert.notCalled(identityVerificationCreate);
    sinon.assert.notCalled(userFindOne);
    sinon.assert.notCalled(sendVerificationCodeSms);
    SinonMongoose.calledOnceWithExactly(
      identityVerificationFindOneAndUpdate,
      [{ query: 'findOneAndUpdate', args: [{ email }, { $set: { code: '1999' } }, { new: true }] }, { query: 'lean' }]
    );
  });

  it('should send a code verification if origin mobile and type phone', async () => {
    const email = 'toto@toto.com';
    const user = { local: { email: 'toto@toto.com' }, contact: { phone: '0687654321', countryCode: '+33' } };
    codeVerification.returns(0.1111);
    identityVerificationFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries({ email, code: '1999' }, ['lean']));
    identityVerificationCreate.returns(null);
    userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    sendVerificationCodeSms.returns({ phone: '0687654321', countryCode: '+33' });

    const result = await AuthenticationHelper.forgotPassword({ email, origin: MOBILE, type: PHONE });

    expect(result).toEqual({ phone: '0687654321', countryCode: '+33' });
    sinon.assert.notCalled(sendVerificationCodeEmail);
    sinon.assert.notCalled(forgotPasswordEmail);
    sinon.assert.notCalled(generatePasswordTokenStub);
    sinon.assert.notCalled(identityVerificationCreate);
    sinon.assert.calledOnceWithExactly(sendVerificationCodeSms, { phone: '0687654321', countryCode: '+33' }, '1999');
    SinonMongoose.calledOnceWithExactly(
      identityVerificationFindOneAndUpdate,
      [{ query: 'findOneAndUpdate', args: [{ email }, { $set: { code: '1999' } }, { new: true }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [{ query: 'findOne', args: [{ 'local.email': 'toto@toto.com' }, { contact: 1 }] }, { query: 'lean' }]
    );
  });

  it('should throw 409 if no phone in user', async () => {
    const email = 'toto@toto.com';
    try {
      const user = { local: { email: 'toto@toto.com' } };
      codeVerification.returns(0.1111);
      identityVerificationFindOneAndUpdate
        .returns(SinonMongoose.stubChainedQueries({ email, code: '1999' }, ['lean']));
      identityVerificationCreate.returns(null);
      userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));

      await AuthenticationHelper.forgotPassword({ email, origin: MOBILE, type: PHONE });
    } catch (e) {
      expect(e.output.statusCode).toEqual(409);
    } finally {
      SinonMongoose.calledOnceWithExactly(
        identityVerificationFindOneAndUpdate,
        [{ query: 'findOneAndUpdate', args: [{ email }, { $set: { code: '1999' } }, { new: true }] }, { query: 'lean' }]
      );
      SinonMongoose.calledOnceWithExactly(
        userFindOne,
        [{ query: 'findOne', args: [{ 'local.email': 'toto@toto.com' }, { contact: 1 }] }, { query: 'lean' }]
      );
      sinon.assert.notCalled(sendVerificationCodeSms);
    }
  });
});

describe('generatePasswordToken', () => {
  let findOneAndUpdate;
  let fakeDate;
  const date = new Date('2020-01-13');
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(User, 'findOneAndUpdate');
    fakeDate = sinon.useFakeTimers(date);
  });
  afterEach(() => {
    findOneAndUpdate.restore();
    fakeDate.restore();
  });

  it('should throw an error if user does not exist', async () => {
    try {
      findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(null, ['lean']));

      await AuthenticationHelper.generatePasswordToken('toto@toto.com', 3600000);
    } catch (e) {
      expect(e).toEqual(Boom.notFound(translate[language].userNotFound));
    } finally {
      SinonMongoose.calledOnceWithExactly(
        findOneAndUpdate,
        [
          {
            query: 'findOneAndUpdate',
            args: [
              { 'local.email': 'toto@toto.com' },
              { $set: { passwordToken: { token: sinon.match.string, expiresIn: date.getTime() + 3600000 } } },
              { new: true },
            ],
          },
          { query: 'lean' },
        ]
      );
    }
  });

  it('should return a new access token after checking reset password token', async () => {
    const user = {
      _id: new ObjectId(),
      local: { email: 'toto@toto.com' },
      passwordToken: { token: sinon.match.string, expiresIn: date.getTime() + 3600000 },
    };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(user, ['lean']));

    const result = await AuthenticationHelper.generatePasswordToken('toto@toto.com', 3600000);

    expect(result).toEqual({ token: expect.any(String), expiresIn: date.getTime() + 3600000 });
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { 'local.email': 'toto@toto.com' },
            { $set: { passwordToken: { token: sinon.match.string, expiresIn: date.getTime() + 3600000 } } },
            { new: true },
          ],
        },
        { query: 'lean' },
      ]
    );
  });
});
