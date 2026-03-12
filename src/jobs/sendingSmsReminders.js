const { ObjectId } = require('mongodb');
const Boom = require('@hapi/boom');
const get = require('lodash/get');
const EmailHelper = require('../helpers/email');
const CourseSlot = require('../models/CourseSlot');
const SmsHelper = require('../helpers/sms');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { DAY, DD_MM_YYYY, HH_MM } = require('../helpers/constants');

const sendingSmsRemindersJob = {
  async method(server) {
    try {
      const result = {};
      // 2 weeks before VAEI evaluation
      const evaluationSlotsInTwoWeeks = await CourseSlot
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
      result['Relance elearning avant évaluation'] = {};
      for (const slot of evaluationSlotsInTwoWeeks) {
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
          if (result['Relance elearning avant évaluation'].sentReminders) {
            result['Relance elearning avant évaluation'].sentReminders.push(trainee._id);
          } else result['Relance elearning avant évaluation'].sentReminders = [trainee._id];
        } else if (result['Relance elearning avant évaluation'].notSentReminders) {
          result['Relance elearning avant évaluation'].notSentReminders.push(trainee._id);
        } else result['Relance elearning avant évaluation'].notSentReminders = [trainee._id];
      }

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
