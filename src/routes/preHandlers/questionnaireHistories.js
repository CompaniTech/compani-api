const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Questionnaire = require('../../models/Questionnaire');
const User = require('../../models/User');
const Course = require('../../models/Course');
const QuestionnaireHistory = require('../../models/QuestionnaireHistory');
const { END_COURSE, SURVEY } = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const { checkAnswersList } = require('./utils');

exports.authorizeAddQuestionnaireHistory = async (req) => {
  const { user: userId, questionnaire: questionnaireId, course: courseId, questionnaireAnswersList } = req.payload;

  const questionnaire = await Questionnaire.countDocuments({ _id: questionnaireId });
  const user = await User.countDocuments({ _id: userId });
  const isCourseFollowedByUser = await Course.countDocuments({ _id: courseId, trainees: userId });

  if (!questionnaire || !user || !isCourseFollowedByUser) throw Boom.notFound();

  if (questionnaireAnswersList) await checkAnswersList(questionnaireAnswersList, questionnaireId);

  return null;
};

exports.authorizeQuestionnaireHistoryUpdate = async (req) => {
  const { _id: questionnaireHistoryId } = req.params;
  const { trainerAnswers } = req.payload;
  const credentials = get(req, 'auth.credentials');

  const questionnaireHistory = await QuestionnaireHistory
    .findOne(
      { _id: questionnaireHistoryId, timeline: END_COURSE },
      { questionnaire: 1, questionnaireAnswersList: 1, course: 1 }
    )
    .populate({ path: 'course', select: 'trainers' })
    .populate({ path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' })
    .lean();
  if (!questionnaireHistory) throw Boom.notFound();

  const courseTrainerIds = questionnaireHistory.course.trainers;
  const loggedUserIsCourseTrainer = UtilsHelper.doesArrayIncludeId(courseTrainerIds, credentials._id);
  if (!loggedUserIsCourseTrainer) throw Boom.forbidden();

  const cardIds = trainerAnswers.map(answer => answer.card);
  const questionnaire = await Questionnaire
    .countDocuments({ _id: questionnaireHistory.questionnaire, cards: { $in: cardIds } });
  if (!questionnaire) throw Boom.notFound();

  const surveyQAnswersList = questionnaireHistory.questionnaireAnswersList.filter(qa => qa.card.template === SURVEY);
  const answersHasGoodLength = trainerAnswers.length === surveyQAnswersList.length;
  if (!answersHasGoodLength) throw Boom.badRequest();

  const everyAnswerIsAuthorized = trainerAnswers.every(a => !a.answer || ['1', '2', '3', '4', '5'].includes(a.answer));
  if (!everyAnswerIsAuthorized) throw Boom.badRequest();

  return null;
};
