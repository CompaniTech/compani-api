const Boom = require('@hapi/boom');
const get = require('lodash/get');
const has = require('lodash/has');
const Card = require('../../models/Card');
const {
  FILL_THE_GAPS,
  FLASHCARD,
  PUBLISHED,
  QUESTION_ANSWER_MAX_ANSWERS_COUNT,
  QUESTION_ANSWER_MIN_ANSWERS_COUNT,
  FLASHCARD_TEXT_MAX_LENGTH,
  MULTIPLE_CHOICE_QUESTION,
  QUESTION_ANSWER,
  SINGLE_CHOICE_QUESTION,
  CHOICE_QUESTION_MAX_ANSWERS_COUNT,
  CHOICE_QUESTION_MIN_ANSWERS_COUNT,
  ORDER_THE_SEQUENCE,
  FILL_THE_GAPS_MAX_ANSWERS_COUNT,
  FILL_THE_GAPS_MIN_ANSWERS_COUNT,
  QC_ANSWER_MAX_LENGTH,
  SURVEY,
  OPEN_QUESTION,
  GAP_ANSWER_MAX_LENGTH,
  FILL_THE_GAPS_MAX_GAPS_COUNT,
} = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const Activity = require('../../models/Activity');
const Questionnaire = require('../../models/Questionnaire');

const checkFlashCard = (payload) => {
  const { text } = payload;
  if (text && text.length > FLASHCARD_TEXT_MAX_LENGTH) return Boom.badRequest();

  return null;
};

const checkFillTheGap = async (dbCard, payload) => {
  const { gappedText } = payload;

  if (!gappedText) return null;

  const tagsCount = (gappedText.match(/<trou>/g) || []).length;
  const correctAnswers = dbCard.gapAnswers.filter(a => a.isCorrect);
  const isParentActvityPublished = await Activity.countDocuments({ cards: dbCard._id, status: PUBLISHED });
  const wrongTagsCount = !tagsCount || tagsCount > FILL_THE_GAPS_MAX_GAPS_COUNT;
  const notMatchingtagsCount = tagsCount !== correctAnswers.length && isParentActvityPublished;
  if (wrongTagsCount || notMatchingtagsCount) return Boom.badRequest();

  return null;
};

const checkSurvey = (labels) => {
  const someSubKeysAreMissing = labels && Object.values(labels).includes(null) &&
    !(['2', '3', '4'].every(key => Object.keys(labels).includes(key)));

  if (someSubKeysAreMissing) throw Boom.badRequest();

  return null;
};

exports.authorizeCardUpdate = async (req) => {
  const { payload, params } = req;
  const card = await Card.findOne({ _id: params._id }).lean();

  if (!card) throw Boom.notFound();

  if (card.template !== FILL_THE_GAPS && has(payload, 'canSwitchAnswers')) throw Boom.forbidden();

  if (![OPEN_QUESTION, SURVEY, QUESTION_ANSWER].includes(card.template) &&
    has(payload, 'isMandatory')) throw Boom.forbidden();

  if (card.template !== SURVEY && has(payload, 'labels')) throw Boom.forbidden();

  if (card.template !== ORDER_THE_SEQUENCE && has(payload, 'isChronological')) throw Boom.forbidden();

  switch (card.template) {
    case FILL_THE_GAPS:
      return checkFillTheGap(card, req.payload);
    case FLASHCARD:
      return checkFlashCard(req.payload);
    case SURVEY:
      return checkSurvey(get(req.payload, 'labels'));
    default:
      return null;
  }
};

exports.isParentPublished = async (req) => {
  const isParentActvityPublished = await Activity.countDocuments({ cards: req.params._id, status: PUBLISHED });
  const isParentQuestionnairePublished = await Questionnaire.countDocuments(
    { cards: req.params._id, status: PUBLISHED }
  );

  if (isParentActvityPublished || isParentQuestionnairePublished) throw Boom.forbidden();
};

exports.authorizeCardAnswerCreation = async (req) => {
  const card = await Card.findOne({
    _id: req.params._id,
    $or: [
      { 'qcAnswers._id': req.params.answerId },
      { 'orderedAnswers._id': req.params.answerId },
      { 'gapAnswer._id': req.params.answerId },
    ],
  }).lean();
  if (!card) throw Boom.notFound();

  switch (card.template) {
    case QUESTION_ANSWER:
      if (card.qcAnswers.length >= QUESTION_ANSWER_MAX_ANSWERS_COUNT) return Boom.forbidden();
      break;
    case MULTIPLE_CHOICE_QUESTION:
    case SINGLE_CHOICE_QUESTION:
      if (card.qcAnswers.length >= CHOICE_QUESTION_MAX_ANSWERS_COUNT) return Boom.forbidden();
      break;
    case ORDER_THE_SEQUENCE: return Boom.forbidden();
    case FILL_THE_GAPS:
      if (card.gapAnswers.length >= FILL_THE_GAPS_MAX_ANSWERS_COUNT) return Boom.forbidden();
      break;
  }

  await this.isParentPublished(req);

  return card;
};

exports.authorizeCardAnswerUpdate = async (req) => {
  const card = await Card.findOne({
    _id: req.params._id,
    $or: [
      { 'qcAnswers._id': req.params.answerId },
      { 'orderedAnswers._id': req.params.answerId },
      { 'gapAnswers._id': req.params.answerId },
    ],
  }).lean();
  if (!card) throw Boom.notFound();

  if (has(req.payload, 'isCorrect') && ![MULTIPLE_CHOICE_QUESTION, FILL_THE_GAPS].includes(card.template)) {
    throw Boom.badRequest();
  }
  if (card.template === FILL_THE_GAPS && req.payload.text && !isValidAnswer(req.payload.text)) throw Boom.badRequest();
  if ([SINGLE_CHOICE_QUESTION, MULTIPLE_CHOICE_QUESTION, QUESTION_ANSWER].includes(card.template) &&
    req.payload.text && req.payload.text.length > QC_ANSWER_MAX_LENGTH) throw Boom.badRequest();

  return card;
};

exports.authorizeCardAnswerDeletion = async (req) => {
  const card = await Card.findOne({
    _id: req.params._id,
    $or: [
      { 'qcAnswers._id': req.params.answerId },
      { 'orderedAnswers._id': req.params.answerId },
      { 'gapAnswers._id': req.params.answerId },
    ],
  }).lean();
  if (!card) throw Boom.notFound();

  switch (card.template) {
    case QUESTION_ANSWER:
      if (card.qcAnswers.length <= QUESTION_ANSWER_MIN_ANSWERS_COUNT) return Boom.forbidden();
      break;
    case MULTIPLE_CHOICE_QUESTION:
      if (card.qcAnswers.length <= CHOICE_QUESTION_MIN_ANSWERS_COUNT) return Boom.forbidden();
      break;
    case SINGLE_CHOICE_QUESTION:
      if (card.qcAnswers.length <= CHOICE_QUESTION_MIN_ANSWERS_COUNT) return Boom.forbidden();
      if (card.qcAnswers.find(a => UtilsHelper.areObjectIdsEquals(a._id, req.params.answerId)).isCorrect) {
        return Boom.forbidden();
      }
      break;
    case ORDER_THE_SEQUENCE: return Boom.forbidden();
    case FILL_THE_GAPS:
      if (card.gapAnswers.length <= FILL_THE_GAPS_MIN_ANSWERS_COUNT) return Boom.forbidden();
      break;
  }

  await this.isParentPublished(req);

  return card;
};

exports.getCardMediaPublicId = async (req) => {
  const card = await Card.findOne({ _id: req.params._id }).lean();
  if (!card) throw Boom.notFound();

  return get(card, 'media.publicId') || '';
};

const isValidAnswer = ans => /^[a-zA-Z0-9àâçéèêëîïôûùü\040'-]*$/.test(ans) &&
  (ans.length > 0 && ans.length <= GAP_ANSWER_MAX_LENGTH);
