const Boom = require('@hapi/boom');
const NodemailerHelper = require('./nodemailer');
const EmailOptionsHelper = require('./emailOptions');
const AuthenticationHelper = require('./authentication');
const { SENDER_MAIL, TRAINER, COACH, CLIENT_ADMIN, TRAINEE, VAEI } = require('./constants');
const translate = require('./translate');
const Course = require('../models/Course');
const User = require('../models/User');
const UtilsHelper = require('./utils');
const CourseBillsHelper = require('./courseBills');

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

exports.completionCertificateCreationEmail = (certificateCreated, errors, month) => {
  const mailOptions = {
    from: `Compani <${SENDER_MAIL}>`,
    to: process.env.TECH_EMAILS,
    subject: `Script création des certificats de réalisation pour le mois de ${month}`,
    html: EmailOptionsHelper.completionCertificateCreationContent(certificateCreated, errors),
  };

  return NodemailerHelper.sendinBlueTransporter().sendMail(mailOptions);
};

exports.sendBillEmail = async (courseBills, type, content, recipientEmails, credentials) => {
  const billsPdf = [];
  for (const bill of courseBills) {
    const companies = [...new Set([...bill.companies.map(c => c._id.toHexString()), bill.payer._id.toHexString()])];
    const { pdf } = await CourseBillsHelper.generateBillPdf(bill._id, companies, credentials);

    billsPdf.push({
      filename: `${UtilsHelper.formatDownloadName(`${bill.payer.name} ${bill.number}`)}.pdf`,
      content: pdf,
      contentType: 'application/pdf',
    });
  }

  const billNumbers = courseBills.map(cb => cb.number).join(', ');
  const senderEmail = process.env.COMPANI_EMAIL;
  const mailOptions = {
    from: `Compani <${senderEmail}>`,
    to: recipientEmails,
    subject: type === VAEI
      ? `Compani : avis de facture en VAE Inversée [${billNumbers}]`
      : `Compani : avis de facture [${billNumbers}]`,
    bcc: senderEmail,
    html: content.replaceAll('\r\n', '<br>'),
    attachments: billsPdf,
  };

  return NodemailerHelper.sendinBlueTransporter().sendMail(mailOptions);
};
