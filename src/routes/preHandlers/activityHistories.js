const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Activity = require('../../models/Activity');
const Course = require('../../models/Course');
const UtilsHelper = require('../../helpers/utils');
const { checkAnswersList } = require('./utils');

exports.authorizeAddActivityHistory = async (req) => {
  const { user: userId, activity: activityId, questionnaireAnswersList, quizzAnswersList } = req.payload;

  if (!UtilsHelper.areObjectIdsEquals(get(req, 'auth.credentials._id'), userId)) throw Boom.forbidden();

  const activity = await Activity.findOne({ _id: activityId })
    .populate({ path: 'steps', select: '_id -activities', populate: { path: 'subPrograms', select: '_id -steps' } })
    .lean();

  if (!activity) throw Boom.notFound();

  const activitySubPrograms = activity.steps
    .map(step => step.subPrograms)
    .flat()
    .map(s => s._id);

  const coursesWithActivityAndFollowedByUser = await Course
    .countDocuments({ subProgram: { $in: activitySubPrograms }, $or: [{ trainees: userId }, { tutors: userId }] });

  if (!coursesWithActivityAndFollowedByUser) throw Boom.notFound();
  const answersList = [...(questionnaireAnswersList || []), ...(quizzAnswersList || [])];

  if (answersList) await checkAnswersList(answersList, activityId, true);

  return null;
};

exports.authorizeHistoriesList = async (req) => {
  const company = get(req, 'auth.credentials.company._id');
  if (!company) return Boom.forbidden();

  return null;
};
