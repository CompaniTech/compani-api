const { expect } = require('expect');
const { ObjectId } = require('mongodb');
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
  courseBillsList,
  VAEI_SUBPROGRAM_ID,
} = require('./seed/emailSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const NodemailerHelper = require('../../src/helpers/nodemailer');
const { TRAINEE, START_COURSE, VAEI, END_COURSE, RESEND } = require('../../src/helpers/constants');
const { holdingAdminFromOtherCompany } = require('../seed/authUsersSeed');
const UtilsMock = require('../utilsMock');

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

describe('EMAIL ROUTES - POST emails/send-coursebill-list', () => {
  let authToken;
  let sendinBlueTransporter;
  beforeEach(async () => {
    await populateDB();
    sendinBlueTransporter = sinon.stub(NodemailerHelper, 'sendinBlueTransporter')
      .returns({ sendMail: sinon.stub().returns('emailSent') });
    process.env.BILLING_COMPANI_EMAIL = 'test@compani.fr';
    process.env.BILLING_USER_ID = emailUser._id;
    process.env.VAEI_SUBPROGRAM_IDS = VAEI_SUBPROGRAM_ID;
  });
  afterEach(() => {
    sendinBlueTransporter.restore();
    process.env.BILLING_COMPANI_EMAIL = '';
    process.env.BILLING_USER_ID = '';
    process.env.VAEI_SUBPROGRAM_IDS = '';
  });

  const payload = {
    bills: [courseBillsList[0]._id],
    content: 'Bonjour,\r\n Ceci est un test.',
    type: START_COURSE,
    recipientEmails: ['test@compani.fr', 'test2@compani.fr'],
  };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
      UtilsMock.mockCurrentDate('2021-04-08T13:45:25.437Z');
    });

    afterEach(() => UtilsMock.unmockCurrentDate());

    it('should send bill list by email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.result.data.mailInfo).toEqual('emailSent');
      sinon.assert.calledWithExactly(sendinBlueTransporter);

      expect(response.statusCode).toBe(200);
    });

    it('should resend bill list by email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, type: RESEND, bills: [courseBillsList[3]._id] },
      });

      expect(response.result.data.mailInfo).toEqual('emailSent');
      sinon.assert.calledWithExactly(sendinBlueTransporter);

      expect(response.statusCode).toBe(200);
    });

    it('should return a 404 if a bill does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, bills: [...payload.bills, new ObjectId()] },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if a bill is linked to VAEI course and another to a non VAEI course', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, bills: [courseBillsList[0]._id, courseBillsList[1]._id] },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message)
        .toEqual('Impossible: les factures doivent être associées à des formations du même type.');
      sinon.assert.notCalled(sendinBlueTransporter);
    });

    it('should return 403 if a bill is linked to a non VAEI course and payload type is VAEI', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, type: VAEI },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message)
        .toEqual('Impossible: au moins une facture n\'est pas associée à une formation VAEI.');
      sinon.assert.notCalled(sendinBlueTransporter);
    });

    it('should return 403 if a bill is linked to a VAEI course and payload type is not VAEI or RESEND', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, bills: [courseBillsList[1]._id] },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message)
        .toEqual('Impossible: au moins une facture est associée à une formation VAEI.');
      sinon.assert.notCalled(sendinBlueTransporter);
    });

    it('should return 403 if type is RESEND but at least one bill has never been sent', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, type: RESEND },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual('Impossible: au moins une facture n\'a jamais été envoyée.');
      sinon.assert.notCalled(sendinBlueTransporter);
    });

    it('should return 403 if type does\'nt correspond to course timeline', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, type: END_COURSE },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message)
        .toEqual('Impossible: le type sélectionné doit correspondre à l\'avancement des formations.');
      sinon.assert.notCalled(sendinBlueTransporter);
    });

    it('should return 403 if some bills have been sent but not all of them', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, bills: [courseBillsList[0]._id, courseBillsList[2]._id] },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message)
        .toEqual('Impossible: certaines factures ont été envoyées au moins une fois mais pas toutes.');
      sinon.assert.notCalled(sendinBlueTransporter);
    });

    ['bills', 'content', 'type', 'recipientEmails'].forEach((missingParam) => {
      it(`should return a 400 error if ${missingParam} param is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/email/send-coursebill-list',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: omit(payload, [missingParam]),
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return a 400 error if bills is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, bills: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 error if type is not valid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, type: 'wrong' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 error if recipientEmails is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, recipientEmails: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 error if an email is not an email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/email/send-coursebill-list',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { ...payload, recipientEmails: [...payload.recipientEmails, 'wrong'] },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/email/send-coursebill-list',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
