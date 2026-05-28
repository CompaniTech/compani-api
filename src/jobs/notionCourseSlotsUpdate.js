const Boom = require('@hapi/boom');
const notionSdk = require('@notionhq/client');
const { ObjectId } = require('mongodb');
const ActivityHistory = require('../models/ActivityHistory');
const Course = require('../models/Course');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { CompaniDuration } = require('../helpers/dates/companiDurations');
const UtilsHelper = require('../helpers/utils');
const { MINUTE } = require('../helpers/constants');

const getSubProgramIds = () => [
  ...process.env.VAEI_SUBPROGRAM_IDS.split(','),
  ...process.env.PRI_SUBPROGRAM_IDS.split(','),
  ...process.env.VAE_SUBPROGRAM_IDS.split(','),
].map(id => new ObjectId(id.trim()));

const computeSlotDurationPerStep = (slots) => {
  const evaluationStepIds = process.env.EVALUATION_STEP_IDS.split(',').map(id => new ObjectId(id));
  const codevStepIds = process.env.CODEV_STEP_IDS.split(',').map(id => new ObjectId(id));
  const tripartiteStepIds = process.env.TRIPARTITE_STEP_IDS.split(',').map(id => new ObjectId(id));
  const coachingStepIds = process.env.COACHING_STEP_IDS.split(',').map(id => new ObjectId(id));
  const stepIds = [...evaluationStepIds, ...codevStepIds, ...tripartiteStepIds, ...coachingStepIds];

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

const updateNotionPage = async (notion, traineeId, stepDurations, historiesDuration, stepToColumn) => {
  const response = await notion.dataSources.query({
    data_source_id: process.env.NOTION_TRAINEES_DATABASE,
    filter: { property: 'ID_VAEI_Apprenant', rich_text: { equals: traineeId.toHexString() } },
  });

  if (!response.results.length) return false;

  const properties = {};
  for (const [stepId, duration] of Object.entries(stepDurations)) {
    const column = Object.entries(stepToColumn).find(([, value]) => UtilsHelper.doesArrayIncludeId(value, stepId));
    if (column) properties[column[0]] = { number: duration.asHours() };
  }
  properties['Total h e-learning'] = { number: historiesDuration.asHours() };
  if (!Object.keys(properties).length) return false;

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

      const notion = new notionSdk.Client({ auth: process.env.NOTION_TOKEN });
      const stepToColumn = {
        'Total h diag&eval': evaluationStepIds,
        'Total h codev': codevStepIds,
        'Total h tripartite': tripartiteStepIds,
        'Total h coaching': coachingStepIds,
      };

      const courses = await Course
        .find({ subProgram: { $in: getSubProgramIds() }, archivedAt: { $exists: false } })
        .populate({ path: 'slots', select: 'startDate endDate step' })
        .populate({ path: 'subProgram', select: 'steps subProgram', populate: { path: 'steps', select: 'activities' } })
        .lean({ virtuals: true });

      const updatedTraineeIds = [];
      const notUpdatedTraineeIds = [];
      for (const course of courses) {
        if (!course.trainees.length) continue;
        const courseActivities = course.subProgram.steps.map(s => s.activities).flat();

        const traineesActivityHistories = await ActivityHistory.find({
          activity: { $in: courseActivities },
          user: course.trainees,
        }).lean();
        const historiesDuration = traineesActivityHistories.reduce(
          (acc, history) => acc.add(history.duration || 'PT0S'),
          CompaniDuration('PT0S')
        );
        const traineeId = new ObjectId(course.trainees[0]);
        const stepDurations = computeSlotDurationPerStep(course.slots);

        try {
          const found = await updateNotionPage(notion, traineeId, stepDurations, historiesDuration, stepToColumn);
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
  async onComplete(server, result) {
    try {
      server.log(['cron'], 'notionCourseSlotsUpdate OK');
      server.log(['cron', 'oncomplete'], result);
    } catch (e) {
      server.log(e);
      server.log(['cron', 'oncomplete'], 'notionCourseSlotsUpdate ERROR');
    }
  },
};

module.exports = { notionCourseSlotsUpdateJob };
