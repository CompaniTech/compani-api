const { ObjectId } = require('mongodb');
const Boom = require('@hapi/boom');
const get = require('lodash/get');
const EmailHelper = require('../helpers/email');
const CourseSlot = require('../models/CourseSlot');
const SmsHelper = require('../helpers/sms');
const UtilsHelper = require('../helpers/utils');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { DAY, DD_MM_YYYY, HH_MM } = require('../helpers/constants');

const getEvaluationSlotsIn2W = async () => {
  const evaluationSlotsIn2W = await CourseSlot
    .find({
      step: new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
      startDate: {
        $gte: CompaniDate().add('P14D').startOf(DAY).toDate(),
        $lte: CompaniDate().add('P14D').endOf(DAY).toDate(),
      },
    })
    .populate({
      path: 'course',
      select: 'trainees interruptedAt archivedAt',
      populate: { path: 'trainees', select: 'contact' },
    })
    .lean();

  const promises = [];
  const evaluationSlotsIn2WSentReminders = [];
  const evaluationSlotsIn2WNotSentReminders = [];
  for (const slot of evaluationSlotsIn2W) {
    if (slot.course.interruptedAt || slot.course.archivedAt) continue;
    const trainee = slot.course.trainees[0];
    const traineeContact = get(trainee, 'contact');
    if (get(traineeContact, 'phone')) {
      promises.push(
        SmsHelper.send({
          recipient: `${traineeContact.countryCode}${traineeContact.phone.substring(1)}`,
          sender: 'Compani',
          content: 'Formation VAEI :\n'
            + 'Prenez quelques minutes pour avancer sur vos e-learnings : préparez vous pour votre évaluation '
            + `du ${CompaniDate(slot.startDate).format(`${DD_MM_YYYY} à ${HH_MM}`)} !`,
          tag: 'Formation VAEI',
        })
      );
      evaluationSlotsIn2WSentReminders.push(trainee._id);
    } else evaluationSlotsIn2WNotSentReminders.push(trainee._id);
  }

  return { evaluationSlotsIn2WSentReminders, evaluationSlotsIn2WNotSentReminders, promises };
};

const getTraineeSlotsIn1D = async () => {
  const slotsIn1D = await CourseSlot
    .find({
      step: { $in: [new ObjectId(process.env.VAEI_EVALUATION_STEP_ID), new ObjectId(process.env.VAEI_CODEV_STEP_ID)] },
      startDate: {
        $gte: CompaniDate().add('P1D').startOf(DAY).toDate(),
        $lte: CompaniDate().add('P1D').endOf(DAY).toDate(),
      },
    })
    .populate({
      path: 'course',
      select: 'trainees trainers interruptedAt archivedAt',
      populate: { path: 'trainees', select: 'contact' },
    })
    .populate({ path: 'trainers', select: 'identity contact' })
    .lean();

  const promises = [];
  const evaluationSlotsIn1DSentReminders = [];
  const evaluationSlotsIn1DNotSentReminders = [];
  const codevSlotsIn1DSentReminders = [];
  const codevSlotsIn1DNotSentReminders = [];
  for (const slot of slotsIn1D) {
    if (slot.course.interruptedAt || slot.course.archivedAt) continue;
    const trainee = slot.course.trainees[0];
    const traineeContact = get(trainee, 'contact');
    if (get(traineeContact, 'phone')) {
      const trainer = slot.trainers[0];
      const trainerPhone = get(trainer, 'contact.phone')
        ? ` (${trainer.contact.countryCode}${trainer.contact.phone.substring(1)})`
        : '';
      let content = '';
      switch (slot.step.toHexString()) {
        case process.env.VAEI_EVALUATION_STEP_ID:
          evaluationSlotsIn1DSentReminders.push(trainee._id);
          content = 'Formation VAEI :\n'
            + 'N\'oubliez pas votre évaluation avec votre architecte de parcours '
            + `${UtilsHelper.formatIdentity(slot.trainers[0].identity, 'FL')}`
            + ` qui aura lieu demain à ${CompaniDate(slot.startDate).format(HH_MM)},`
            + ` en visio. Si besoin, contactez votre architecte de parcours${trainerPhone}.`;
          break;
        case process.env.VAEI_CODEV_STEP_ID:
          codevSlotsIn1DSentReminders.push(trainee._id);
          content = 'Formation VAEI :\n'
            + 'N\'oubliez pas votre rendez-vous d\'accompagnement collectif avec votre animateur.rice '
            + `${UtilsHelper.formatIdentity(slot.trainers[0].identity, 'FL')}`
            + ` qui aura lieu demain à ${CompaniDate(slot.startDate).format(HH_MM)}, en visio.`
            + ` Si besoin, contactez votre animateur.rice de CODEV${trainerPhone}.`;
          break;
      }
      promises.push(
        SmsHelper.send({
          recipient: `${traineeContact.countryCode}${traineeContact.phone.substring(1)}`,
          sender: 'Compani',
          content,
          tag: 'Formation VAEI',
        })
      );
    } else {
      switch (slot.step.toHexString()) {
        case process.env.VAEI_EVALUATION_STEP_ID:
          evaluationSlotsIn1DNotSentReminders.push(trainee._id);
          break;
        case process.env.VAEI_CODEV_STEP_ID:
          codevSlotsIn1DNotSentReminders.push(trainee._id);
      }
    }
  }

  return {
    evaluationSlotsIn1DSentReminders,
    evaluationSlotsIn1DNotSentReminders,
    codevSlotsIn1DSentReminders,
    codevSlotsIn1DNotSentReminders,
    promises,
  };
};

const sendingSmsRemindersJob = {
  async method(server) {
    try {
      const result = {};
      const promises = [];
      // 2 weeks before VAEI evaluation
      const {
        evaluationSlotsIn2WSentReminders,
        evaluationSlotsIn2WNotSentReminders,
        promises: evaluationSlotsIn2WPromises,
      } = await getEvaluationSlotsIn2W();
      result['Relance elearning avant évaluation'] = {
        ...evaluationSlotsIn2WSentReminders.length && { sentReminders: evaluationSlotsIn2WSentReminders },
        ...evaluationSlotsIn2WNotSentReminders.length && { notSentReminders: evaluationSlotsIn2WNotSentReminders },
      };
      if (evaluationSlotsIn2WPromises.length) promises.push(...evaluationSlotsIn2WPromises);

      // 1 day before VAEI slot
      const {
        evaluationSlotsIn1DSentReminders,
        evaluationSlotsIn1DNotSentReminders,
        codevSlotsIn1DSentReminders,
        codevSlotsIn1DNotSentReminders,
        promises: evaluationSlotsIn1DPromises,
      } = await getTraineeSlotsIn1D();
      result['Veille d\'évaluation'] = {
        ...evaluationSlotsIn1DSentReminders.length && { sentReminders: evaluationSlotsIn1DSentReminders },
        ...evaluationSlotsIn1DNotSentReminders.length && { notSentReminders: evaluationSlotsIn1DNotSentReminders },
      };
      result['Veille de CODEV'] = {
        ...codevSlotsIn1DSentReminders.length && { sentReminders: codevSlotsIn1DSentReminders },
        ...codevSlotsIn1DNotSentReminders.length && { notSentReminders: codevSlotsIn1DNotSentReminders },
      };
      if (evaluationSlotsIn1DPromises.length) promises.push(...evaluationSlotsIn1DPromises);

      await Promise.all(promises);
      return result;
    } catch (e) {
      server.log(['cron', 'method'], e);
      return Boom.isBoom(e) ? e : Boom.badImplementation(e);
    }
  },
  async onComplete(server, result) {
    try {
      server.log(['cron'], 'SendingRemindersEmail OK');

      await EmailHelper.completionSendingSmsRemindersEmail(result);
      server.log(['cron', 'oncomplete'], 'Reminders sending : email envoyé.');
    } catch (e) {
      server.log(e);
      server.log(['cron', 'oncomplete'], 'SendingRemindersEmail ERROR');
    }
  },

};

module.exports = { sendingSmsRemindersJob };
