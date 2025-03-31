const Boom = require('@hapi/boom');
const get = require('lodash/get');
const ActivityHistory = require('../../models/ActivityHistory');
const Course = require('../../models/Course');
const CompletionCertificate = require('../../models/CompletionCertificate');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
const { CompaniDate } = require('../../helpers/dates/companiDates');
const { MM_YYYY, MONTH, E_LEARNING } = require('../../helpers/constants');

const { language } = translate;

exports.authorizeGetCompletionCertificates = async (req) => {
  const { course } = req.query;

  if (course) {
    const courseExists = await Course.countDocuments({ _id: course });
    if (!courseExists) throw Boom.notFound();
  }

  return null;
};

exports.authorizeCompletionCertificateEdit = async (req) => {
  const { _id: completionCertificateId } = req.params;

  const completionCertificate = await CompletionCertificate.findOne({ _id: completionCertificateId }).lean();
  if (!completionCertificate) throw Boom.notFound();

  if (get(completionCertificate, 'file.link')) {
    throw Boom.conflict(translate[language].completionCertificateAlreadyGenerated);
  }

  return null;
};

exports.authorizeCompletionCertificateCreation = async (req) => {
  const { trainee, course, month } = req.payload;

  if (!course) throw Boom.notFound();

  if (!course.trainees.some(t => UtilsHelper.areObjectIdsEquals(t, trainee))) throw Boom.forbidden();

  const startOfMonth = CompaniDate(month, MM_YYYY).startOf(MONTH).toISO();
  const endOfMonth = CompaniDate(month, MM_YYYY).endOf(MONTH).toISO();

  const courseSlots = course.slots
    .filter(slot => CompaniDate(slot.startDate).isSameOrBetween(startOfMonth, endOfMonth))
    .map(s => s._id);

  const courseSteps = course.subProgram.steps.filter(step => step.type === E_LEARNING);

  const activitiesIds = courseSteps.flatMap(s => s.activities);
  const activityHistories = await ActivityHistory.find({
    activity: { $in: activitiesIds },
    user: trainee._id,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  }).lean();

  if (!courseSlots.length || !activityHistories) throw Boom.forbidden();

  const completionCertificates = await CompletionCertificate.find({ trainee: 1, course: 1, month: 1 }).lean();

  if (get(completionCertificates, 'file.link')) {
    throw Boom.conflict(translate[language].completionCertificatesAlreadyExist);
  }

  return null;
};
