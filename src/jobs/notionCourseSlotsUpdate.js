const Boom = require('@hapi/boom');
const notionSdk = require('@notionhq/client');
const get = require('lodash/get');
const { ObjectId } = require('mongodb');
const ActivityHistory = require('../models/ActivityHistory');
const Course = require('../models/Course');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { CompaniDuration } = require('../helpers/dates/companiDurations');
const EmailHelper = require('../helpers/email');
const UtilsHelper = require('../helpers/utils');
const NumbersHelper = require('../helpers/numbers');
const { MINUTE, MONTH, PRESENT, MISSING } = require('../helpers/constants');

const getSubProgramIds = () => [
  ...process.env.VAEI_SUBPROGRAM_IDS.split(','),
  ...process.env.PRI_SUBPROGRAM_IDS.split(','),
  ...process.env.VAE_SUBPROGRAM_IDS.split(','),
].map(id => new ObjectId(id.trim()));

const computeSlotDurationPerStep = (slots, stepIds) => {
  const stepDurations = stepIds.reduce((acc, stepId) => {
    acc[stepId] = CompaniDuration('PT0S');
    return acc;
  }, {});

  for (const slot of slots) {
    const stepId = slot.step.toHexString();
    const slotDuration = CompaniDuration(CompaniDate(slot.endDate).diff(slot.startDate, MINUTE));
    stepDurations[stepId] = stepDurations[stepId]
      ? stepDurations[stepId].add(slotDuration)
      : slotDuration;
  }
  return stepDurations;
};

const buildStepProperties = (stepDurations, stepToColumn) => {
  const properties = {};
  for (const [stepId, duration] of Object.entries(stepDurations)) {
    const column = Object.entries(stepToColumn).find(([, ids]) => UtilsHelper.doesArrayIncludeId(ids, stepId));
    if (column) {
      const current = get(properties[column[0]], 'number') || 0;
      properties[column[0]] = { number: NumbersHelper.toFixedToFloat(duration.asHours() + current) };
    }
  }

  return properties;
};

const updateNotionPage = async (notion, traineeId, properties) => {
  const response = await notion.dataSources.query({
    data_source_id: process.env.NOTION_TRAINEES_DATABASE,
    filter: { property: 'ID_VAEI_Apprenant', rich_text: { equals: traineeId.toHexString() } },
  });

  if (!response.results.length) return false;

  await notion.pages.update({ page_id: response.results[0].id, properties });
  return true;
};

const notionCourseSlotsUpdateJob = {
  async method(server) {
    try {
      const evaluationStepIds = process.env.EVALUATION_STEP_IDS.split(',').map(id => new ObjectId(id));
      const codevStepIds = process.env.CODEV_STEP_IDS.split(',').map(id => new ObjectId(id));
      const tripartiteStepIds = process.env.TRIPARTITE_STEP_IDS.split(',').map(id => new ObjectId(id));
      const coachingStepIds = process.env.COACHING_STEP_IDS.split(',').map(id => new ObjectId(id));
      const allStepIds = [...evaluationStepIds, ...codevStepIds, ...tripartiteStepIds, ...coachingStepIds];

      const notion = new notionSdk.Client({ auth: process.env.NOTION_TOKEN });
      const stepToColumn = {
        'Total h diag&eval': evaluationStepIds,
        'Tot Nb codev': codevStepIds,
        'Total h tripartite': tripartiteStepIds,
        'Total h coaching': coachingStepIds,
      };
      const stepToColumnPastMonth = {
        'Total h diag&eval du mois dernier': evaluationStepIds,
        'Nb codev du mois dernier': codevStepIds,
        'Total h tripartite du mois dernier': tripartiteStepIds,
        'Total h coaching du mois dernier': coachingStepIds,
      };

      const pastMonthStart = CompaniDate().startOf(MONTH).subtract('P1M');

      const courses = await Course
        .find({ subProgram: { $in: getSubProgramIds() }, archivedAt: { $exists: false } })
        .populate({
          path: 'slots',
          select: 'startDate endDate step attendances',
          populate: { path: 'attendances', options: { isVendorUser: true } },
        })
        .populate({ path: 'subProgram', select: 'steps subProgram', populate: { path: 'steps', select: 'activities' } })
        .lean({ virtuals: true });

      const updatedTraineeIds = [];
      const notUpdatedTraineeIds = [];
      for (const course of courses) {
        if (!course.trainees.length) continue;

        const traineeId = new ObjectId(course.trainees[0]);
        const presentSlots = course.slots
          .filter(s => s.attendances.length && s.attendances[0].status === PRESENT);
        const missingSlots = course.slots
          .filter(s => s.attendances.length && s.attendances[0].status === MISSING)
          .reduce((acc, slot) => acc.add(CompaniDuration(CompaniDate(slot.endDate).diff(slot.startDate, MINUTE))),
            CompaniDuration('PT0S')
          );
        const pastMonthPresentSlots = presentSlots
          .filter(s => CompaniDate(s.startDate).isSame(pastMonthStart, MONTH));

        const courseActivities = course.subProgram.steps.map(s => s.activities).flat();

        const traineesActivityHistories = await ActivityHistory.find({
          activity: { $in: courseActivities },
          user: course.trainees,
        }).lean();
        const allHistoriesDuration = traineesActivityHistories.reduce(
          (acc, history) => acc.add(history.duration || 'PT0S'),
          CompaniDuration('PT0S')
        );

        const pastMonthHistoriesDuration = traineesActivityHistories.reduce(
          (acc, history) => (CompaniDate(history.createdAt).isSame(pastMonthStart, MONTH)
            ? acc.add(history.duration || 'PT0S')
            : acc),
          CompaniDuration('PT0S')
        );

        const properties = {
          ...buildStepProperties(computeSlotDurationPerStep(presentSlots, allStepIds), stepToColumn),
          ...buildStepProperties(computeSlotDurationPerStep(pastMonthPresentSlots, allStepIds), stepToColumnPastMonth),
          'Total h e-learning': { number: NumbersHelper.toFixedToFloat(allHistoriesDuration.asHours()) },
          'Total h e-learning mois passé': {
            number: NumbersHelper.toFixedToFloat(pastMonthHistoriesDuration.asHours()),
          },
          'Total h absences parcours': { number: NumbersHelper.toFixedToFloat(missingSlots.asHours()) },
        };

        try {
          const found = await updateNotionPage(notion, traineeId, properties);
          if (found) updatedTraineeIds.push(traineeId);
          else notUpdatedTraineeIds.push(traineeId);
        } catch (_) {
          notUpdatedTraineeIds.push(traineeId);
        }
      }

      return { updatedTraineeIds, notUpdatedTraineeIds };
    } catch (e) {
      server.log(['cron', 'method'], e);
      return Boom.isBoom(e) ? e : Boom.badImplementation(e);
    }
  },
  async onComplete(server, { updatedTraineeIds, notUpdatedTraineeIds }) {
    try {
      server.log(['cron'], 'notionCourseSlotsUpdate OK');
      await EmailHelper.completionNotionCourseSlotsUpdate(updatedTraineeIds, notUpdatedTraineeIds);
      server.log(['cron', 'oncomplete'], 'NotionCourseSlotsUpdate : email envoyé.');
    } catch (e) {
      server.log(e);
      server.log(['cron', 'oncomplete'], 'notionCourseSlotsUpdate ERROR');
    }
  },
};

module.exports = { notionCourseSlotsUpdateJob };
