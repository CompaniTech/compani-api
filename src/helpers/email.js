const Boom = require('@hapi/boom');
const { ObjectId } = require('mongodb');
const get = require('lodash/get');
const NodemailerHelper = require('./nodemailer');
const EmailOptionsHelper = require('./emailOptions');
const AuthenticationHelper = require('./authentication');
const {
  SENDER_MAIL,
  TRAINER,
  COACH,
  CLIENT_ADMIN,
  TRAINEE,
  VAEI,
  COPPER_600,
  COPPER_500,
  RESEND,
  DAY,
} = require('./constants');
const translate = require('./translate');
const Course = require('../models/Course');
const User = require('../models/User');
const CourseBill = require('../models/CourseBill');
const UtilsHelper = require('./utils');
const CourseBillsHelper = require('./courseBills');
const { CompaniDate } = require('./dates/companiDates');
const PendingCourseBill = require('../models/PendingCourseBill');

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

const getSignature = billingUser => `<br>
    <p style="color: ${COPPER_600}; font-size: 14px;">
      ${UtilsHelper.formatIdentity(billingUser.identity, 'FL')}<br>
      <span>Responsable administrative et financière</span><br>
      ${get(billingUser, 'contact.phone') ? UtilsHelper.formatPhone(billingUser.contact) : ''}
    </p>
    <a href="https://www.compani.fr" target="_blank">
      <img src="https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png" alt="Logo"
        style="width: 200px; height: auto; border: 0;">
    </a>
    <a href="https://app.compani.fr/login">
      <p style="color: ${COPPER_500};">Cliquer ici pour accéder à l'espace Compani</p>
    </a>`;

exports.sendBillEmail = async (courseBills, type, content, recipientEmails, sendingDate, credentials) => {
  const billsPdf = [];
  const hasToSendBillsNow = CompaniDate().startOf(DAY).isSame(CompaniDate(sendingDate).startOf(DAY));
  if (hasToSendBillsNow) {
    for (const bill of courseBills) {
      const companies = [...new Set([...bill.companies.map(c => c._id), bill.payer._id])];
      const { pdf } = await CourseBillsHelper.generateBillPdf(bill._id, companies, credentials);

      billsPdf.push({
        filename: `${UtilsHelper.formatDownloadName(`${bill.payer.name} ${bill.number}`)}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      });
    }

    const billNumbers = courseBills.map(cb => cb.number).join(', ');
    const senderEmail = process.env.BILLING_COMPANI_EMAIL;
    const signatureBillingUserId = new ObjectId(process.env.BILLING_USER_ID);
    const billingUser = await User.findOne({ _id: signatureBillingUserId }, { identity: 1, contact: 1 }).lean();

    const getSubject = () => {
      switch (type) {
        case VAEI:
          return `Compani : avis de ${UtilsHelper.formatQuantity('facture', courseBills.length, 's', false)}`
          + ` en VAE Inversée [${billNumbers}]`;
        case RESEND:
          return 'Compani : relance pour '
          + `${UtilsHelper.formatQuantity('facture impayée', courseBills.length, 's', false)} [${billNumbers}]`;
        default:
          return `Compani : avis de ${UtilsHelper.formatQuantity('facture', courseBills.length, 's', false)}`
          + ` [${billNumbers}]`;
      }
    };

    const mailOptions = {
      from: `Compani <${senderEmail}>`,
      to: recipientEmails,
      subject: getSubject(),
      bcc: senderEmail,
      html: `<p>${content.replaceAll('\r\n', '<br>')}</p>
      <p>${getSignature(billingUser)}</p>`,
      attachments: billsPdf,
    };

    const courseBillIds = courseBills.map(cb => cb._id);
    await CourseBill.updateMany({ _id: { $in: courseBillIds } }, { $push: { sendingDates: CompaniDate().toISO() } });

    return NodemailerHelper.sendinBlueTransporter().sendMail(mailOptions);
  }

  return PendingCourseBill.create({
    courseBills: courseBills.map(c => new ObjectId(c._id)),
    sendingDate,
    recipientEmails,
    content,
    type,
  });
};
