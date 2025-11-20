const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Boom = require('@hapi/boom');
const SinonMongoose = require('../sinonMongoose');
const EmailHelper = require('../../../src/helpers/email');
const EmailOptionsHelper = require('../../../src/helpers/emailOptions');
const AuthenticationHelper = require('../../../src/helpers/authentication');
const NodemailerHelper = require('../../../src/helpers/nodemailer');
const UtilsHelper = require('../../../src/helpers/utils');
const CourseBillHelper = require('../../../src/helpers/courseBills');
const translate = require('../../../src/helpers/translate');
const User = require('../../../src/models/User');
const Course = require('../../../src/models/Course');
const { VAEI, VENDOR_ADMIN } = require('../../../src/helpers/constants');

const { language } = translate;

describe('sendWelcome', () => {
  let trainerCustomContent;
  let coachCustomContent;
  let baseWelcomeContent;
  let createPasswordToken;
  let sendinBlueTransporter;
  let sendMail;
  let welcomeTraineeContent;

  const email = 't@t.com';
  const coachWelcomeCustomText = 'content for coach';
  const baseWelcomeText = 'base content';
  const passwordToken = 'passwordToken';
  const sentObj = { msg: 'Message sent !' };

  beforeEach(() => {
    trainerCustomContent = sinon.stub(EmailOptionsHelper, 'trainerCustomContent');
    coachCustomContent = sinon.stub(EmailOptionsHelper, 'coachCustomContent');
    baseWelcomeContent = sinon.stub(EmailOptionsHelper, 'baseWelcomeContent');
    createPasswordToken = sinon.stub(AuthenticationHelper, 'createPasswordToken');
    sendinBlueTransporter = sinon.stub(NodemailerHelper, 'sendinBlueTransporter');
    sendMail = sinon.stub();
    welcomeTraineeContent = sinon.stub(EmailOptionsHelper, 'welcomeTraineeContent');
  });
  afterEach(() => {
    trainerCustomContent.restore();
    coachCustomContent.restore();
    baseWelcomeContent.restore();
    createPasswordToken.restore();
    sendinBlueTransporter.restore();
    welcomeTraineeContent.restore();
  });

  it('should send email to trainer', async () => {
    const trainerWelcomeCustomText = 'content for trainer';

    createPasswordToken.returns(passwordToken);
    trainerCustomContent.returns(trainerWelcomeCustomText);
    baseWelcomeContent.returns(baseWelcomeText);
    sendinBlueTransporter.returns({ sendMail });
    sendMail.returns(sentObj);

    const result = await EmailHelper.sendWelcome('trainer', email);

    expect(result).toEqual(sentObj);
    sinon.assert.calledWithExactly(trainerCustomContent);
    sinon.assert.calledWithExactly(
      baseWelcomeContent,
      trainerWelcomeCustomText,
      { passwordToken, companyName: 'Compani' }
    );
    sinon.assert.calledWithExactly(sendinBlueTransporter);
    sinon.assert.calledOnceWithExactly(
      sendMail,
      {
        from: 'Compani <nepasrepondre@compani.fr>',
        to: email,
        subject: 'Bienvenue dans votre espace Compani',
        html: baseWelcomeText,
      }
    );
    sinon.assert.notCalled(coachCustomContent);
    sinon.assert.notCalled(welcomeTraineeContent);
  });

  it('should send email to coach', async () => {
    createPasswordToken.returns(passwordToken);
    coachCustomContent.returns(coachWelcomeCustomText);
    baseWelcomeContent.returns(baseWelcomeText);
    sendinBlueTransporter.returns({ sendMail });
    sendMail.returns(sentObj);

    const result = await EmailHelper.sendWelcome('coach', email);

    expect(result).toEqual(sentObj);
    sinon.assert.calledWithExactly(coachCustomContent);
    sinon.assert.calledWithExactly(
      baseWelcomeContent,
      coachWelcomeCustomText,
      { passwordToken, companyName: 'Compani' }
    );
    sinon.assert.calledWithExactly(sendinBlueTransporter);
    sinon.assert.calledOnceWithExactly(
      sendMail,
      {
        from: 'Compani <nepasrepondre@compani.fr>',
        to: email,
        subject: 'Bienvenue dans votre espace Compani',
        html: baseWelcomeText,
      }
    );
    sinon.assert.notCalled(trainerCustomContent);
    sinon.assert.notCalled(welcomeTraineeContent);
  });

  it('should send email to coach', async () => {
    createPasswordToken.returns(passwordToken);
    coachCustomContent.returns(coachWelcomeCustomText);
    baseWelcomeContent.returns(baseWelcomeText);
    sendinBlueTransporter.returns({ sendMail });
    sendMail.returns(sentObj);

    const result = await EmailHelper.sendWelcome('client_admin', email);

    expect(result).toEqual(sentObj);
    sinon.assert.calledWithExactly(coachCustomContent);
    sinon.assert.calledWithExactly(
      baseWelcomeContent,
      coachWelcomeCustomText,
      { passwordToken, companyName: 'Compani' }
    );
    sinon.assert.calledWithExactly(sendinBlueTransporter);
    sinon.assert.calledOnceWithExactly(
      sendMail,
      {
        from: 'Compani <nepasrepondre@compani.fr>',
        to: email,
        subject: 'Bienvenue dans votre espace Compani',
        html: baseWelcomeText,
      }
    );
    sinon.assert.notCalled(trainerCustomContent);
    sinon.assert.notCalled(welcomeTraineeContent);
  });

  it('should send email to trainee', async () => {
    welcomeTraineeContent.returns('Bonjour à tous et passez une bonne journée');
    sendinBlueTransporter.returns({ sendMail });
    sendMail.returns(sentObj);

    const result = await EmailHelper.sendWelcome('trainee', email);

    expect(result).toEqual(sentObj);
    sinon.assert.calledOnceWithExactly(welcomeTraineeContent);
    sinon.assert.calledWithExactly(sendinBlueTransporter);
    sinon.assert.calledOnceWithExactly(
      sendMail,
      {
        from: 'Compani <nepasrepondre@compani.fr>',
        to: email,
        subject: 'Bienvenue dans votre espace Compani',
        html: 'Bonjour à tous et passez une bonne journée',
      }
    );
    sinon.assert.notCalled(trainerCustomContent);
    sinon.assert.notCalled(coachCustomContent);
  });

  it('should send 424 if email sending fails', async () => {
    try {
      welcomeTraineeContent.returns('Bonjour à tous et passez une bonne journée');

      await EmailHelper.sendWelcome('trainee', email);
    } catch (e) {
      expect(e).toEqual(Boom.failedDependency(translate[language].emailNotSent));
    } finally {
      sinon.assert.calledOnceWithExactly(welcomeTraineeContent);
      sinon.assert.calledWithExactly(sendinBlueTransporter);
      sinon.assert.notCalled(sendMail);
      sinon.assert.notCalled(trainerCustomContent);
      sinon.assert.notCalled(coachCustomContent);
    }
  });
});

describe('addTutor', () => {
  let userFindOne;
  let courseFindOne;
  let formatIdentity;
  let sendinBlueTransporter;
  let sendMail;
  let addTutorContent;

  const sentObj = { msg: 'Message envoyé' };

  beforeEach(() => {
    userFindOne = sinon.stub(User, 'findOne');
    courseFindOne = sinon.stub(Course, 'findOne');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    sendinBlueTransporter = sinon.stub(NodemailerHelper, 'sendinBlueTransporter');
    sendMail = sinon.stub();
    addTutorContent = sinon.stub(EmailOptionsHelper, 'addTutorContent');
  });

  afterEach(() => {
    userFindOne.restore();
    courseFindOne.restore();
    formatIdentity.restore();
    sendinBlueTransporter.restore();
    addTutorContent.restore();
  });

  it('should send an email to new tutor (one trainee)', async () => {
    const tutor = {
      _id: new ObjectId(),
      local: { email: 'aude+test95@compani.fr' },
      identity: { firstname: 'Bat', lastname: 'MAN' },
    };
    const course = {
      _id: new ObjectId(),
      subProgram: { program: { name: 'Program 1' } },
      trainees: [{ _id: new ObjectId(), identity: { firstname: 'Robyn', lastname: 'FENTY' } }],
    };
    const addNewTutorContent = 'content for tutor';

    userFindOne.returns(SinonMongoose.stubChainedQueries(tutor, ['lean']));
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));
    formatIdentity.onCall(0).returns('Bat MAN');
    formatIdentity.onCall(1).returns('Robyn FENTY');
    sendMail.returns(sentObj);
    sendinBlueTransporter.returns({ sendMail });
    addTutorContent.returns(addNewTutorContent);

    const result = await EmailHelper.addTutor(course._id, tutor._id);

    expect(result).toEqual(sentObj);

    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [{ query: 'findOne', args: [{ _id: tutor._id }, { 'local.email': 1, identity: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: course._id }, { subProgram: 1, trainees: 1 }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } }],
        },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { firstname: 'Bat', lastname: 'MAN' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { firstname: 'Robyn', lastname: 'FENTY' }, 'FL');
    sinon.assert.calledWithExactly(sendinBlueTransporter);
    sinon.assert.calledOnceWithExactly(
      sendMail,
      {
        from: 'Compani <nepasrepondre@compani.fr>',
        to: tutor.local.email,
        subject: 'Vous avez été nommé tuteur d\'une formation',
        html: addNewTutorContent,
      }
    );
    sinon.assert.calledWithExactly(addTutorContent, 'Bat MAN', 'Robyn FENTY', 'Program 1');
  });

  it('should send an email to new tutor (several trainees)', async () => {
    const tutor = {
      _id: new ObjectId(),
      local: { email: 'aude+test95@compani.fr' },
      identity: { firstname: 'Bat', lastname: 'MAN' },
    };
    const course = {
      _id: new ObjectId(),
      subProgram: { program: { name: 'Program 1' } },
      trainees: [
        { _id: new ObjectId(), identity: { firstname: 'Robyn', lastname: 'FENTY' } },
        { _id: new ObjectId(), identity: { firstname: 'Robin', lastname: 'Hood' } },
      ],
    };
    const addNewTutorContent = 'content for tutor';

    userFindOne.returns(SinonMongoose.stubChainedQueries(tutor, ['lean']));
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));
    formatIdentity.returns('Bat MAN');
    sendMail.returns(sentObj);
    sendinBlueTransporter.returns({ sendMail });
    addTutorContent.returns(addNewTutorContent);

    const result = await EmailHelper.addTutor(course._id, tutor._id);

    expect(result).toEqual(sentObj);

    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [{ query: 'findOne', args: [{ _id: tutor._id }, { 'local.email': 1, identity: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: course._id }, { subProgram: 1, trainees: 1 }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } }],
        },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstname: 'Bat', lastname: 'MAN' }, 'FL');
    sinon.assert.calledWithExactly(sendinBlueTransporter);
    sinon.assert.calledOnceWithExactly(
      sendMail,
      {
        from: 'Compani <nepasrepondre@compani.fr>',
        to: tutor.local.email,
        subject: 'Vous avez été nommé tuteur d\'une formation',
        html: addNewTutorContent,
      }
    );
    sinon.assert.calledWithExactly(addTutorContent, 'Bat MAN', '', 'Program 1');
  });
});

describe('completionCertificateCreationEmail', async () => {
  let sendMail;
  let sendinBlueTransporter;
  let completionCertificateCreationContent;

  beforeEach(() => {
    sendinBlueTransporter = sinon.stub(NodemailerHelper, 'sendinBlueTransporter');
    sendMail = sinon.stub();
    completionCertificateCreationContent = sinon.stub(EmailOptionsHelper, 'completionCertificateCreationContent');
    process.env.TECH_EMAILS = 'tech@compani.fr';
  });

  afterEach(() => {
    sendinBlueTransporter.restore();
    completionCertificateCreationContent.restore();
    process.env.TECH_EMAILS = '';
  });

  it('should send an email to TECH_EMAILS after script has been executed', async () => {
    const certificateCreated = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
    const errors = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
    const month = '01-2025';
    const content = `<p>Script correctement exécuté. ${certificateCreated.length + errors.length}
      formations traitées.</p>
      <p>Certificat créé pour les formations suivantes : ${certificateCreated.join(', ')}</p>
      <p>Certificat à créer manuellement pour les formations suivantes : ${errors.join(', ')}</p>`;
    const sentObj = { msg: content };

    completionCertificateCreationContent.returns(content);
    sendMail.returns(sentObj);
    sendinBlueTransporter.returns({ sendMail });

    const result = await EmailHelper.completionCertificateCreationEmail(certificateCreated, errors, month);

    expect(result).toEqual(sentObj);
    sinon.assert.calledWithExactly(sendinBlueTransporter);
    sinon.assert.calledOnceWithExactly(
      sendMail,
      {
        from: 'Compani <nepasrepondre@compani.fr>',
        to: 'tech@compani.fr',
        subject: 'Script création des certificats de réalisation pour le mois de 01-2025',
        html: content,
      }
    );
    sinon.assert.calledWithExactly(completionCertificateCreationContent, certificateCreated, errors);
  });
});

describe('sendBillEmail', async () => {
  let generateBillPdf;
  let sendMail;
  let sendinBlueTransporter;
  let userFindOne;
  const userId = new ObjectId();

  beforeEach(() => {
    generateBillPdf = sinon.stub(CourseBillHelper, 'generateBillPdf');
    sendinBlueTransporter = sinon.stub(NodemailerHelper, 'sendinBlueTransporter');
    sendMail = sinon.stub();
    process.env.BILLING_COMPANI_EMAIL = 'tech@compani.fr';
    process.env.BILLING_USER_ID = userId.toHexString();
    userFindOne = sinon.stub(User, 'findOne');
  });

  afterEach(() => {
    sendinBlueTransporter.restore();
    process.env.BILLING_COMPANI_EMAIL = '';
    process.env.BILLING_USER_ID = '';
    userFindOne.restore();
  });

  it('should send bills by email', async () => {
    const credentials = { _id: new ObjectId(), role: { vendor: { name: VENDOR_ADMIN } } };
    const courseBillIds = [new ObjectId(), new ObjectId()];
    const payer = { _id: new ObjectId(), name: 'Structure' };
    const companies = [new ObjectId(), new ObjectId()];
    const courseBills = [
      {
        _id: courseBillIds[0]._id,
        companies: [{ _id: companies[0] }],
        number: 'FACT-00001',
        payer,
      },
      {
        _id: courseBillIds[1]._id,
        companies: [{ _id: companies[1] }],
        number: 'FACT-00002',
        payer,
      },
    ];
    const financialUser = {
      _id: userId,
      identity: { firstname: 'Malo', lastname: 'Poirier' },
      contact: { phone: '0987654321', countryCode: '+33' },
    };
    const htmlContent = `<p>Bonjour<br> Ceci est un test</p>
    <p><br>
    <p style="color: #005774; font-size: 14px;">
      Malo POIRIER<br>
      <span style="color: #1D7C8F;">Responsable administrative et financière</span><br>
      +33 9 87 65 43 21
    </p>
    <a href="https://www.compani.fr" target="_blank">
      <img src="https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png" alt="Logo"
        style="width: 200px; height: auto; border: 0;">
    </a>
    <a href="https://app.compani.fr/login">
      <p style="color: #1D7C8F;">Cliquer ici pour accéder à l'espace Compani</p>
    </a></p>`;

    const sentObj = { msg: htmlContent };
    sendMail.returns(sentObj);
    sendinBlueTransporter.returns({ sendMail });

    userFindOne.returns(SinonMongoose.stubChainedQueries(financialUser, ['lean']));
    generateBillPdf.onCall(0).returns({ pdf: 'pdf1' });
    generateBillPdf.onCall(1).returns({ pdf: 'pdf2' });

    const recipientEmails = ['test@compani.fr', 'testbis@compani.fr'];
    const result = await EmailHelper
      .sendBillEmail(courseBills, VAEI, 'Bonjour\r\n Ceci est un test', recipientEmails, credentials);

    expect(result).toEqual(sentObj);
    sinon.assert.calledWithExactly(
      generateBillPdf.getCall(0),
      courseBillIds[0],
      [companies[0], payer._id],
      credentials
    );
    sinon.assert.calledWithExactly(
      generateBillPdf.getCall(1),
      courseBillIds[1],
      [companies[1], payer._id],
      credentials
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [
        { query: 'findOne', args: [{ _id: userId }, { identity: 1, contact: 1 }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(sendinBlueTransporter);
    sinon.assert.calledOnceWithExactly(
      sendMail,
      {
        from: 'Compani <tech@compani.fr>',
        to: ['test@compani.fr', 'testbis@compani.fr'],
        subject: 'Compani : avis de facture en VAE Inversée [FACT-00001, FACT-00002]',
        bcc: 'tech@compani.fr',
        html: htmlContent,
        attachments: [
          { filename: 'Structure_FACT-00001.pdf', content: 'pdf1', contentType: 'application/pdf' },
          { filename: 'Structure_FACT-00002.pdf', content: 'pdf2', contentType: 'application/pdf' },
        ],
      }
    );
  });
});
