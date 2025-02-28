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
const translate = require('../../../src/helpers/translate');
const User = require('../../../src/models/User');
const Course = require('../../../src/models/Course');

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
