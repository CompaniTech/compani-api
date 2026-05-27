const Boom = require('@hapi/boom');
const { Client } = require('@notionhq/client');
const { ObjectId } = require('mongodb');
const Course = require('../models/Course');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { CompaniDuration } = require('../helpers/dates/companiDurations');
const { MINUTE } = require('../helpers/constants');

const getSubProgramIds = () => [
  ...process.env.VAEI_SUBPROGRAM_IDS.split(','),
  ...process.env.PRI_SUBPROGRAM_IDS.split(','),
  ...process.env.VAE_SUBPROGRAM_ID.split(','),
].map(id => new ObjectId(id.trim()));

const STEP_TO_NOTION_COLUMN = () => ({
  [process.env.VAEI_EVALUATION_STEP_ID]: 'Total h diag&eval',
  [process.env.VAEI_CODEV_STEP_ID]: 'Total h codev',
  [process.env.VAEI_TRIPARTITE_STEP_ID]: 'Total h tripartite',
});

const computeSlotDurationPerStep = (slots) => {
  const stepDurations = {};
  for (const slot of slots) {
    const stepId = slot.step.toHexString();
    const slotDuration = CompaniDuration(CompaniDate(slot.endDate).diff(slot.startDate, MINUTE));
    stepDurations[stepId] = stepDurations[stepId]
      ? stepDurations[stepId].add(slotDuration)
      : slotDuration;
  }
  return stepDurations;
};

const updateNotionPage = async (notion, traineeId, stepDurations, stepToColumn) => {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_TRAINEES_DATABASE,
    filter: { property: 'ID_VAEI_Apprenant', rich_text: { equals: traineeId.toHexString() } },
  });

  if (!response.results.length) return false;

  const properties = {};
  for (const [stepId, duration] of Object.entries(stepDurations)) {
    const column = stepToColumn[stepId];
    if (column) properties[column] = { number: duration.asHours() };
  }

  if (!Object.keys(properties).length) return false;

  await notion.pages.update({ page_id: response.results[0].id, properties });
  return true;
};

const notionCoursesUpdateJob = {
  async method(server) {
    try {
      const notion = new Client({ auth: process.env.NOTION_TOKEN });
      const stepToColumn = STEP_TO_NOTION_COLUMN();

      const courses = await Course
        .find({ subProgram: { $in: getSubProgramIds() }, archivedAt: { $exists: false } })
        .populate({ path: 'slots', select: 'startDate endDate step' })
        .lean({ virtuals: true });

      const updated = [];
      const notFound = [];
      const errors = [];

      for (const course of courses) {
        if (!course.trainees.length || !course.slots.length) continue;
        const traineeId = new ObjectId(course.trainees[0]);
        const stepDurations = computeSlotDurationPerStep(course.slots);

        try {
          const found = await updateNotionPage(notion, traineeId, stepDurations, stepToColumn);
          if (found) updated.push(traineeId);
          else notFound.push(traineeId);
        } catch (e) {
          errors.push({ traineeId, error: e.message });
        }
      }

      return { updated, notFound, errors };
    } catch (e) {
      server.log(['cron', 'method'], e);
      return Boom.isBoom(e) ? e : Boom.badImplementation(e);
    }
  },
  async onComplete(server, result) {
    try {
      server.log(['cron'], 'NotionCoursesUpdate OK');
      server.log(['cron', 'oncomplete'], result);
    } catch (e) {
      server.log(e);
      server.log(['cron', 'oncomplete'], 'NotionCoursesUpdate ERROR');
    }
  },
};

module.exports = { notionCoursesUpdateJob };
