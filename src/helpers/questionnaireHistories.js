const Boom = require('@hapi/boom');
const keyBy = require('lodash/keyBy');
const omit = require('lodash/omit');
const QuestionnaireHistory = require('../models/QuestionnaireHistory');
const Questionnaire = require('../models/Questionnaire');
const {
  COURSE,
  TRAINEE,
  SELF_POSITIONNING,
  START_COURSE,
  END_COURSE,
  BEFORE_MIDDLE_COURSE_END_DATE,
  ENDED,
  UNKNOWN,
  WEBAPP,
} = require('./constants');
const CourseHistoriesHelper = require('./courseHistories');
const QuestionnaireHelper = require('./questionnaires');
const translate = require('./translate');

const { language } = translate;

exports.addQuestionnaireHistory = async (payload) => {
  const { user: userId, questionnaire: questionnaireId, course: courseId } = payload;
  const traineesCompanyAtCourseRegistrationList = await CourseHistoriesHelper
    .getCompanyAtCourseRegistrationList({ key: COURSE, value: courseId }, { key: TRAINEE, value: [userId] });

  const questionnaire = await Questionnaire.findOne({ _id: questionnaireId }, { type: 1 }).lean();

  let timeline;
  if (questionnaire.type === SELF_POSITIONNING) {
    if (payload.origin === WEBAPP) {
      timeline = payload.timeline;
    } else {
      const { courseTimeline } = await QuestionnaireHelper.getCourseInfos(courseId);

      switch (courseTimeline) {
        case BEFORE_MIDDLE_COURSE_END_DATE:
          timeline = START_COURSE;
          break;
        case ENDED:
          timeline = END_COURSE;
          break;
        default:
          timeline = UNKNOWN;
      }
    }
  }

  const questionnaireHistoryExists = await QuestionnaireHistory
    .countDocuments({ course: courseId, user: userId, questionnaire: questionnaireId, ...(timeline && { timeline }) });
  if (questionnaireHistoryExists) throw Boom.conflict(translate[language].questionnaireHistoryConflict);

  return QuestionnaireHistory.create(
    {
      ...omit(payload, ['timeline']),
      company: traineesCompanyAtCourseRegistrationList[0].company,
      ...(timeline && { timeline }),
    }
  );
};

exports.updateQuestionnaireHistory = async (questionnaireHistoryId, payload) => {
  const { trainerComment, trainerAnswers } = payload;

  let setFields = { isValidated: true, ...(trainerComment && { trainerComment }) };
  if (trainerAnswers.some(a => a.answer)) {
    const trainerAnswersByCard = keyBy(trainerAnswers, 'card');
    const questionnaireHistory = await QuestionnaireHistory
      .findOne({ _id: questionnaireHistoryId }, { questionnaireAnswersList: 1 })
      .lean();

    const questionnaireAnswersList = [];
    for (const bddAnswer of questionnaireHistory.questionnaireAnswersList) {
      const trainerAnswer = trainerAnswersByCard[bddAnswer.card];

      if (!trainerAnswer.answer) {
        questionnaireAnswersList.push(bddAnswer);
        continue;
      }

      questionnaireAnswersList.push({ ...bddAnswer, trainerAnswerList: [trainerAnswer.answer] });
    }

    setFields = { ...setFields, questionnaireAnswersList };
  }

  return QuestionnaireHistory.updateOne({ _id: questionnaireHistoryId }, { $set: setFields });
};
