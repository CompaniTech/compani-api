const { ObjectId } = require('mongodb');
const Boom = require('@hapi/boom');
const get = require('lodash/get');
const EmailHelper = require('../helpers/email');
const ActivityHistory = require('../models/ActivityHistory');
const Course = require('../models/Course');
const CourseSlot = require('../models/CourseSlot');
const SubProgram = require('../models/SubProgram');
const SmsHelper = require('../helpers/sms');
const UtilsHelper = require('../helpers/utils');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { DAY, DD_MM_YYYY, HH_MM, E_LEARNING } = require('../helpers/constants');

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

const getSlotsIn1D = async () => {
  const slotsIn1D = await CourseSlot
    .find({
      step: {
        $in: [
          new ObjectId(process.env.VAEI_EVALUATION_STEP_ID),
          new ObjectId(process.env.VAEI_CODEV_STEP_ID),
          new ObjectId(process.env.VAEI_TRIPARTITE_STEP_ID),
        ],
      },
      startDate: {
        $gte: CompaniDate().add('P1D').startOf(DAY).toDate(),
        $lte: CompaniDate().add('P1D').endOf(DAY).toDate(),
      },
    })
    .populate({
      path: 'course',
      select: 'trainees tutors trainers interruptedAt archivedAt',
      populate: [{ path: 'trainees', select: 'contact identity' }, { path: 'tutors', select: 'contact' }],
    })
    .populate({ path: 'trainers', select: 'identity contact' })
    .lean();

  const promises = [];
  const evaluationSlotsIn1DSentReminders = [];
  const evaluationSlotsIn1DNotSentReminders = [];
  const codevSlotsIn1DSentReminders = [];
  const codevSlotsIn1DNotSentReminders = [];
  const traineeTripartiteSlotsIn1DSentReminders = [];
  const traineeTripartiteSlotsIn1DNotSentReminders = [];
  const tutorTripartiteSlotsIn1DSentReminders = [];
  const tutorTripartiteSlotsIn1DNotSentReminders = [];
  for (const slot of slotsIn1D) {
    if (slot.course.interruptedAt || slot.course.archivedAt) continue;
    const trainee = slot.course.trainees[0];
    const traineeContact = get(trainee, 'contact');
    const trainer = slot.trainers[0];
    const trainerPhone = get(trainer, 'contact.phone')
      ? ` (${trainer.contact.countryCode}${trainer.contact.phone.substring(1)})`
      : '';
    if (get(traineeContact, 'phone')) {
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
        case process.env.VAEI_TRIPARTITE_STEP_ID:
          traineeTripartiteSlotsIn1DSentReminders.push(trainee._id);
          content = 'Formation VAEI :\n'
            + 'N\'oubliez pas votre rendez-vous tripartite qui aura lieu demain à '
            + `${CompaniDate(slot.startDate).format(HH_MM)}, dans votre structure.`
            + ` Si besoin, contactez votre coach${trainerPhone}.`;
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
          break;
        case process.env.VAEI_TRIPARTITE_STEP_ID:
          traineeTripartiteSlotsIn1DNotSentReminders.push(trainee._id);
          break;
      }
    }
    if (UtilsHelper.areObjectIdsEquals(slot.step, process.env.VAEI_TRIPARTITE_STEP_ID) && slot.course.tutors) {
      for (const tutor of slot.course.tutors) {
        const tutorContact = get(tutor, 'contact');
        if (get(tutorContact, 'phone')) {
          const content = 'Formation VAEI :\n'
            + 'N\'oubliez pas le rendez-vous tripartite qui aura lieu demain à '
            + `${CompaniDate(slot.startDate).format(HH_MM)}, avec votre apprenant.e `
            + `${UtilsHelper.formatIdentity(trainee.identity, 'FL')}. Si besoin, contactez le coach${trainerPhone}.`;
          tutorTripartiteSlotsIn1DSentReminders.push(tutor._id);
          promises.push(
            SmsHelper.send({
              recipient: `${tutorContact.countryCode}${tutorContact.phone.substring(1)}`,
              sender: 'Compani',
              content,
              tag: 'Formation VAEI',
            })
          );
        } else tutorTripartiteSlotsIn1DNotSentReminders.push(tutor._id);
      }
    }
  }

  return {
    evaluationSlotsIn1DSentReminders,
    evaluationSlotsIn1DNotSentReminders,
    codevSlotsIn1DSentReminders,
    codevSlotsIn1DNotSentReminders,
    traineeTripartiteSlotsIn1DSentReminders,
    traineeTripartiteSlotsIn1DNotSentReminders,
    tutorTripartiteSlotsIn1DSentReminders,
    tutorTripartiteSlotsIn1DNotSentReminders,
    promises,
  };
};

const getCodevSlotsIn1W = async () => {
  const codevSlotsIn1W = await CourseSlot
    .find({
      step: new ObjectId(process.env.VAEI_CODEV_STEP_ID),
      startDate: {
        $gte: CompaniDate().add('P7D').startOf(DAY).toDate(),
        $lte: CompaniDate().add('P7D').endOf(DAY).toDate(),
      },
    })
    .populate({
      path: 'course',
      select: 'trainees interruptedAt archivedAt',
      populate: [
        { path: 'trainees', select: 'contact' },
        {
          path: 'slots',
          select: 'startDate',
          match: { step: new ObjectId(process.env.VAEI_CODEV_STEP_ID), startDate: { $exists: true } },
          options: { sort: { startDate: 1 } },
        },
      ],
    })
    .populate({ path: 'trainers', select: 'identity contact' })
    .lean();
  const filteredSlots = codevSlotsIn1W.filter((s) => {
    const isCourseStopped = s.course.interruptedAt || s.course.archivedAt;
    return !isCourseStopped && CompaniDate(s.startDate).isSame(s.course.slots[0].startDate);
  });

  const promises = [];
  const codevSlotsIn1WSentReminders = [];
  const codevSlotsIn1WNotSentReminders = [];
  for (const slot of filteredSlots) {
    const trainee = slot.course.trainees[0];
    const traineeContact = get(trainee, 'contact');
    if (get(traineeContact, 'phone')) {
      promises.push(
        SmsHelper.send({
          recipient: `${traineeContact.countryCode}${traineeContact.phone.substring(1)}`,
          sender: 'Compani',
          content: 'Formation VAEI :\n'
            + 'Votre première session d\'accompagnement collectif aura lieu le '
            + `${CompaniDate(slot.startDate).format(`${DD_MM_YYYY} à ${HH_MM}`)}`
            + ` avec l'animateur.rice ${UtilsHelper.formatIdentity(slot.trainers[0].identity, 'FL')}. `
            + 'Veuillez vérifier vos mails pour vous connecter sur la visio. Si besoin, contactez votre coach.',
          tag: 'Formation VAEI',
        })
      );
      codevSlotsIn1WSentReminders.push(trainee._id);
    } else codevSlotsIn1WNotSentReminders.push(trainee._id);
  }

  return { codevSlotsIn1WSentReminders, codevSlotsIn1WNotSentReminders, promises };
};

const getPOEIFirstSingleSlot = async () => {
  const collectiveStepIds = process.env.COLLECTIVE_STEP_IDS.split(',').map(id => new ObjectId(id));
  const courses = await Course
    .find({
      subProgram: new ObjectId(process.env.POEI_SUBPROGRAM_ID),
      archivedAt: { $exists: false },
      interruptedAt: { $exists: false },
    })
    .populate({ path: 'trainees', select: 'contact' })
    .populate({
      path: 'slots',
      select: 'startDate step',
      match: { step: { $nin: collectiveStepIds }, startDate: { $exists: true } },
      options: { sort: { startDate: 1 } },
    })
    .lean();

  const promises = [];
  const POEISentReminders = [];
  const POEINotSentReminders = [];
  if (courses.length) {
    const subProgramWithElearningSteps = await SubProgram
      .findOne({ _id: new ObjectId(process.env.POEI_SUBPROGRAM_ID) }, { steps: 1 })
      .populate({ path: 'steps', select: 'type activities', match: { type: E_LEARNING } })
      .lean();
    const activitiesIds = subProgramWithElearningSteps.steps.flatMap(s => s.activities.map(a => new ObjectId(a)));

    const filteredCourses = courses.reduce((acc, c) => {
      if (!c.slots.length) return acc;
      const slot = CompaniDate(c.slots[0].startDate).startOf(DAY);
      for (let i = 0; i < 8; i++) {
        if (CompaniDate().subtract(`P${i}W`).startOf(DAY).isSame(slot)) {
          acc.push({ ...c, week: i });
          continue;
        }
      }
      return acc;
    }, []);

    const trainees = [];
    for (const course of filteredCourses) {
      const traineeAH = await ActivityHistory
        .find({ user: course.trainees[0]._id, activity: { $in: activitiesIds } })
        .lean();
      const ahWithoutDuplicates = [...new Set(traineeAH.map(ah => ah.activity.toHexString()))];
      if (ahWithoutDuplicates.length / activitiesIds.length < ((1 / 8) * (course.week + 1))) {
        trainees.push(course.trainees[0]);
      }
    }

    for (const trainee of trainees) {
      const traineeContact = get(trainee, 'contact');
      if (get(traineeContact, 'phone')) {
        promises.push(
          SmsHelper.send({
            recipient: `${traineeContact.countryCode}${traineeContact.phone.substring(1)}`,
            sender: 'Compani',
            content: 'Formation POEI :\n'
            + 'N\'oubliez pas de faire votre e-learning !',
            tag: 'Formation POEI',
          })
        );
        POEISentReminders.push(trainee._id);
      } else POEINotSentReminders.push(trainee._id);
    }
  }

  return { POEISentReminders, POEINotSentReminders, promises };
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
        traineeTripartiteSlotsIn1DSentReminders,
        traineeTripartiteSlotsIn1DNotSentReminders,
        tutorTripartiteSlotsIn1DSentReminders,
        tutorTripartiteSlotsIn1DNotSentReminders,
        promises: vaeiSlotsIn1DPromises,
      } = await getSlotsIn1D();
      result['Veille d\'évaluation'] = {
        ...evaluationSlotsIn1DSentReminders.length && { sentReminders: evaluationSlotsIn1DSentReminders },
        ...evaluationSlotsIn1DNotSentReminders.length && { notSentReminders: evaluationSlotsIn1DNotSentReminders },
      };
      result['Veille de CODEV'] = {
        ...codevSlotsIn1DSentReminders.length && { sentReminders: codevSlotsIn1DSentReminders },
        ...codevSlotsIn1DNotSentReminders.length && { notSentReminders: codevSlotsIn1DNotSentReminders },
      };
      result['Veille de tripartite (apprenant)'] = {
        ...traineeTripartiteSlotsIn1DSentReminders.length && { sentReminders: traineeTripartiteSlotsIn1DSentReminders },
        ...traineeTripartiteSlotsIn1DNotSentReminders.length && {
          notSentReminders: traineeTripartiteSlotsIn1DNotSentReminders,
        },
      };
      result['Veille de tripartite (tuteur)'] = {
        ...tutorTripartiteSlotsIn1DSentReminders.length && { sentReminders: tutorTripartiteSlotsIn1DSentReminders },
        ...tutorTripartiteSlotsIn1DNotSentReminders.length && {
          notSentReminders: tutorTripartiteSlotsIn1DNotSentReminders,
        },
      };
      if (vaeiSlotsIn1DPromises.length) promises.push(...vaeiSlotsIn1DPromises);

      // 1 week before 1st codev
      const {
        codevSlotsIn1WSentReminders,
        codevSlotsIn1WNotSentReminders,
        promises: codevSlotsIn1WPromises,
      } = await getCodevSlotsIn1W();
      result['1 semaine avant 1er codev'] = {
        ...codevSlotsIn1WSentReminders.length && { sentReminders: codevSlotsIn1WSentReminders },
        ...codevSlotsIn1WNotSentReminders.length && { notSentReminders: codevSlotsIn1WNotSentReminders },
      };
      if (codevSlotsIn1WPromises.length) promises.push(...codevSlotsIn1WPromises);

      // POEI first single slot
      const {
        POEISentReminders,
        POEINotSentReminders,
        promises: POEIPromises,
      } = await getPOEIFirstSingleSlot();
      result['Relance elearning POEI'] = {
        ...POEISentReminders.length && { sentReminders: POEISentReminders },
        ...POEINotSentReminders.length && { notSentReminders: POEINotSentReminders },
      };
      if (POEIPromises.length) promises.push(...POEIPromises);

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
