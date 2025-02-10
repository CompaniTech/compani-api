const Boom = require('@hapi/boom');
const NodemailerHelper = require('./nodemailer');
const EmailOptionsHelper = require('./emailOptions');
const AuthenticationHelper = require('./authentication');
const { SENDER_MAIL, TRAINER, COACH, CLIENT_ADMIN, TRAINEE } = require('./constants');
const translate = require('./translate');
const Course = require('../models/Course');
const User = require('../models/User');
const UtilsHelper = require('./utils');

const { language } = translate;

exports.sendWelcome = async (type, email) => {
  const passwordToken = await AuthenticationHelper.createPasswordToken(email);

  const subject = 'Bienvenue dans votre espace Compani';
  let customContent;
  const options = { passwordToken, companyName: 'Compani' };

  if (type === TRAINEE) {
    const mailOptions = {
      from: `Compani <${SENDER_MAIL}>`,
      to: email,
      subject,
      html: EmailOptionsHelper.welcomeTraineeContent(),
    };
    try {
      return NodemailerHelper.sendinBlueTransporter().sendMail(mailOptions);
    } catch (error) {
      console.error(error);
      throw Boom.failedDependency(translate[language].emailNotSent);
    }
  }

  switch (type) {
    case TRAINER:
      customContent = EmailOptionsHelper.trainerCustomContent();
      break;
    case COACH:
    case CLIENT_ADMIN:
      customContent = EmailOptionsHelper.coachCustomContent();
      break;
    default:
      customContent = '';
  }

  const mailOptions = {
    from: `Compani <${SENDER_MAIL}>`,
    to: email,
    subject,
    html: EmailOptionsHelper.baseWelcomeContent(customContent, options),
  };

  return NodemailerHelper.sendinBlueTransporter().sendMail(mailOptions);
};

exports.forgotPasswordEmail = async (receiver, passwordToken) => {
  const mailOptions = {
    from: `Compani <${SENDER_MAIL}>`,
    to: receiver,
    subject: 'Changement de mot de passe de votre compte Compani',
    html: EmailOptionsHelper.forgotPasswordEmail(passwordToken),
  };

  return NodemailerHelper.sendinBlueTransporter().sendMail(mailOptions);
};

exports.sendVerificationCodeEmail = async (receiver, verificationCode) => {
  const mailOptions = {
    from: `Compani <${SENDER_MAIL}>`,
    to: receiver,
    subject: 'Code de vérification de votre compte Compani',
    html: EmailOptionsHelper.verificationCodeEmail(verificationCode),
  };

  return NodemailerHelper.sendinBlueTransporter().sendMail(mailOptions);
};

exports.addTutor = async (courseId, tutorId) => {
  try {
    const tutor = await User.findOne({ _id: tutorId }, { 'local.email': 1, identity: 1 }).lean();

    const tutorIdentity = UtilsHelper.formatIdentity(tutor.identity, 'FL');

    const course = await Course.findOne({ _id: courseId }, { subProgram: 1, trainees: 1 })
      .populate({ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } })
      .populate({ path: 'trainees', select: 'identity' })
      .lean();

    const learnerIdentity = course.trainees.length === 1
      ? UtilsHelper.formatIdentity(course.trainees[0].identity, 'FL')
      : '';

    const courseName = course.subProgram.program.name;

    const mailOptions = {
      from: `Compani <${SENDER_MAIL}>`,
      to: tutor.local.email,
      subject: 'Vous avez été nommé tuteur d\'une formation',
      html: EmailOptionsHelper.addTutorContent(tutorIdentity, learnerIdentity, courseName),
    };
    return NodemailerHelper.sendinBlueTransporter().sendMail(mailOptions);
  } catch (error) {
    console.error(error);
    throw Boom.failedDependency(translate[language].emailNotSent);
  }
};
