const Boom = require('@hapi/boom');
const Joi = require('joi');
const get = require('lodash/get');
const Card = require('../../models/Card');
const Activity = require('../../models/Activity');
const Questionnaire = require('../../models/Questionnaire');
const User = require('../../models/User');
const {
  SURVEY,
  OPEN_QUESTION,
  QUESTION_ANSWER,
  VENDOR_ADMIN,
  TRAINING_ORGANISATION_MANAGER,
  TRAINER,
  MULTIPLE_CHOICE_QUESTION,
  SINGLE_CHOICE_QUESTION,
  ORDER_THE_SEQUENCE,
  FILL_THE_GAPS,
} = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');

exports.checkAnswersList = async (answersList, parentId, isActivityAnswers = false) => {
  const cards = await Card.find({ _id: { $in: answersList.map(qa => qa.card) } }).lean();
  for (const answer of answersList) {
    const card = cards.find(c => UtilsHelper.areObjectIdsEquals(c._id, answer.card));
    if (!card) throw Boom.notFound();

    const QUIZZ_TEMPLATES = isActivityAnswers
      ? [MULTIPLE_CHOICE_QUESTION, SINGLE_CHOICE_QUESTION, ORDER_THE_SEQUENCE, FILL_THE_GAPS]
      : [];
    const authorizedTemplates = [
      SURVEY,
      OPEN_QUESTION,
      QUESTION_ANSWER,
      ...QUIZZ_TEMPLATES,
    ];
    const isWrongTemplate = !authorizedTemplates.includes(card.template);
    const shouldHaveOneAnswer = [SURVEY, OPEN_QUESTION, SINGLE_CHOICE_QUESTION].includes(card.template) ||
      ([QUESTION_ANSWER].includes(card.template) && !card.isQuestionAnswerMultipleChoiced);
    const tooManyAnswers = answer.answerList.length !== 1 && shouldHaveOneAnswer;
    const answerIsNotObjectID = [...QUIZZ_TEMPLATES].includes(card.template) &&
      Joi.array().items(Joi.objectId()).validate(answer.answerList).error;

    if (isWrongTemplate || tooManyAnswers || answerIsNotObjectID) throw Boom.badData();

    const activityCount = await Activity.countDocuments({ _id: parentId, cards: card._id });
    const questionnaireCount = await Questionnaire.countDocuments({ _id: parentId, cards: card._id });
    if (!activityCount && !questionnaireCount) throw Boom.notFound();
  }
};

exports.checkVendorUserExistsAndHasRightRole = async (userId, isRofOrAdmin, checkHasTrainerRole = false) => {
  if (!isRofOrAdmin) throw Boom.forbidden();

  const user = await User.findOne({ _id: userId }, { role: 1 }).lean({ autopopulate: true });

  const rolesToCheck = [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER];
  if (checkHasTrainerRole) rolesToCheck.push(TRAINER);

  if (!user || !rolesToCheck.includes(get(user, 'role.vendor.name'))) {
    throw Boom.notFound();
  }

  return null;
};
