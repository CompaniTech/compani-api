const { expect } = require('expect');
const sinon = require('sinon');
const omit = require('lodash/omit');
const app = require('../../server');
const {
  populateDB,
  emailUser,
  emailUserFromOtherCompany,
  trainerFromOtherCompany,
  coachFromOtherCompany,
  helperFromOtherCompany,
  futureTraineeFromAuthCompany,
  emailUserFromThirdCompany,
} = require('./seed/emailSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const NodemailerHelper = require('../../src/helpers/nodemailer');
const { TRAINEE } = require('../../src/helpers/constants');
const { holdingAdminFromOtherCompany } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('EMAIL ROUTES - POST emails/send-welcome', () => {
  const payload = { email: emailUser.local.email, type: 'helper' };
  beforeEach(populateDB);
  let sendinBlueTransporter;
  beforeEach(() => {
    sendinBlueTransporter = sinon.stub(NodemailerHelper, 'sendinBlueTransporter')
      .returns({ sendMail: sinon.stub().returns('emailSent') });
  });
  afterEach(() => {
    sendinBlueTransporter.restore();
  });

  describe('TRAINER', () => {
    let authToken;
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    const receivers = [
      { type: 'client_admin', email: emailUserFromOtherCompany.local.email },
      { type: 'coach', email: coachFromOtherCompany.local.email },
      { type: 'trainer', email: trainerFromOtherCompany.local.email },
      { type: 'trainee', email: emailUserFromOtherCompany.local.email },
    ];
    receivers.forEach((receiver) => {
      it(`should send a welcoming email to a ${receiver.type} from an other company`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/email/send-welcome',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: receiver,
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.mailInfo).toEqual('emailSent');
        sinon.assert.calledWithExactly(sendinBlueTransporter);
      });
    });

    it('should throw an error if sending to other company helper', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-welcome',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { email: helperFromOtherCompany.local.email, type: 'helper' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should throw an error if email does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-welcome',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, email: 'qwertyuiop@asdfghjkl.fr' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should throw an error if type is not trainer, helper, coach, client_admin or trainee', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-welcome',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, type: 'poiuyt' },
      });

      expect(response.statusCode).toBe(400);
    });

    ['type', 'email'].forEach((missingParam) => {
      it(`should return a 400 error if ${missingParam} param is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/email/send-welcome',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: omit(payload, [missingParam]),
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('other roles', () => {
    it('should send a welcoming email as user is coach and receiver is newly registered helper in auth company',
      async () => {
        const authToken = await getToken('coach');
        const response = await app.inject({
          method: 'POST',
          url: '/email/send-welcome',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.mailInfo).toEqual('emailSent');
        sinon.assert.calledWithExactly(sendinBlueTransporter);
      });

    it('should send a welcoming email as sender is coach and receiver is a future registered trainee in auth company',
      async () => {
        const authToken = await getToken('coach');
        const response = await app.inject({
          method: 'POST',
          url: '/email/send-welcome',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: { email: futureTraineeFromAuthCompany.local.email, type: TRAINEE },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.mailInfo).toEqual('emailSent');
        sinon.assert.calledWithExactly(sendinBlueTransporter);
      });

    it('should throw an error as sender has client role and receiver is from other company', async () => {
      const authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-welcome',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, email: emailUserFromOtherCompany.local.email },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should send a welcoming email as sender is holding admin and receiver is in holding company',
      async () => {
        const authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
        const response = await app.inject({
          method: 'POST',
          url: '/email/send-welcome',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: { email: emailUserFromThirdCompany.local.email, type: TRAINEE },
        });

        expect(response.statusCode).toBe(200);
      });

    it('should return 404 as sender has holding role but receiver is from company not in holding', async () => {
      const authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-welcome',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, email: futureTraineeFromAuthCompany.local.email },
      });

      expect(response.statusCode).toBe(404);
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        const authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/email/send-welcome',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
