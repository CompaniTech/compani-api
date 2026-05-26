const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  TRANSITION,
  TITLE_TEXT_MEDIA,
  TITLE_TEXT,
  TEXT_MEDIA,
  FLASHCARD,
  FILL_THE_GAPS,
  MULTIPLE_CHOICE_QUESTION,
  SINGLE_CHOICE_QUESTION,
  ORDER_THE_SEQUENCE,
  OPEN_QUESTION,
  SURVEY,
  QUESTION_ANSWER,
  FILL_THE_GAPS_MAX_ANSWERS_COUNT,
  CHOICE_QUESTION_MIN_ANSWERS_COUNT,
  CHOICE_QUESTION_MAX_ANSWERS_COUNT,
  ORDER_THE_SEQUENCE_ANSWERS_COUNT,
  QUESTION_ANSWER_MIN_ANSWERS_COUNT,
  QUESTION_ANSWER_MAX_ANSWERS_COUNT,
  QC_ANSWER_MAX_LENGTH,
  QUESTION_MAX_LENGTH,
  GAP_ANSWER_MAX_LENGTH,
  FILL_THE_GAPS_MIN_ANSWERS_COUNT,
  FILL_THE_GAPS_MAX_GAPS_COUNT,
} = require('../../helpers/constants');

const labelsValidation = (labels) => {
  let validation;

  if (labels && Object.keys(labels).length === 2) {
    validation = Joi.object().keys({
      [Object.keys(labels)[0]]: Joi.string().required(),
      [Object.keys(labels)[1]]: Joi.string().required(),
    });
  } else {
    validation = Joi.object().keys({
      1: Joi.string().required(),
      2: Joi.string().required(),
      3: Joi.string().required(),
      4: Joi.string().required(),
      5: Joi.string().required(),
      6: Joi.string(),
      7: Joi.string(),
      8: Joi.string(),
      9: Joi.string(),
      10: Joi.string(),
    });
  }

  return validation;
};

exports.cardValidationByTemplate = (template, labels = {}) => {
  switch (template) {
    case TRANSITION:
      return Joi.object().keys({
        title: Joi.string().required(),
      });
    case TITLE_TEXT_MEDIA:
      return Joi.object().keys({
        title: Joi.string().required(),
        text: Joi.string().required(),
        media: Joi.object().keys({
          publicId: Joi.string().required(),
          link: Joi.string().required(),
        }).required(),
      });
    case TITLE_TEXT:
      return Joi.object().keys({
        title: Joi.string().required(),
        text: Joi.string().required(),
      });
    case TEXT_MEDIA:
      return Joi.object().keys({
        text: Joi.string().required(),
        media: Joi.object().keys({
          publicId: Joi.string().required(),
          link: Joi.string().required(),
        }).required(),
      });
    case FLASHCARD:
      return Joi.object().keys({
        text: Joi.string().required(),
        backText: Joi.string().required(),
      });
    case FILL_THE_GAPS:
      return Joi.object()
        .custom((value, helpers) => {
          const { gappedText, gapAnswers } = value;
          const tagsCount = (gappedText.match(/<trou>/g) || []).length;
          const correctAnswersCount = gapAnswers.filter(answer => answer.isCorrect).length;

          if (tagsCount !== correctAnswersCount) {
            return helpers.message('Gap count must be equal to correct answers count');
          }

          return value;
        })
        .keys({
          gappedText: Joi.string()
            .required()
            .custom((value, helpers) => {
              const tagsCount = (value.match(/<trou>/g) || []).length;
              if (!tagsCount || tagsCount > FILL_THE_GAPS_MAX_GAPS_COUNT) {
                return helpers.message('There must be one or two gaps');
              }

              return value;
            }),
          gapAnswers: Joi.array()
            .items(Joi.object({
              text: Joi.string().max(GAP_ANSWER_MAX_LENGTH).required(),
              isCorrect: Joi.boolean().required(),
            }))
            .min(FILL_THE_GAPS_MIN_ANSWERS_COUNT)
            .max(FILL_THE_GAPS_MAX_ANSWERS_COUNT)
            .custom((values, helpers) => {
              const correctAnswers = values.filter(answer => answer.isCorrect);
              if (!correctAnswers.length || correctAnswers.length > FILL_THE_GAPS_MAX_GAPS_COUNT) {
                return helpers.message('There must be one or two correct answers');
              }
              return values;
            }),
          explanation: Joi.string().required(),
        });
    case SINGLE_CHOICE_QUESTION:
      return Joi.object().keys({
        question: Joi.string().required().max(QUESTION_MAX_LENGTH),
        qcAnswers: Joi.array()
          .items(Joi.object({
            text: Joi.string().required().max(QC_ANSWER_MAX_LENGTH),
            isCorrect: Joi.boolean().required(),
          }))
          .min(CHOICE_QUESTION_MIN_ANSWERS_COUNT)
          .max(CHOICE_QUESTION_MAX_ANSWERS_COUNT)
          .custom((values, helpers) => {
            const correctAnswers = values.filter(answer => answer.isCorrect);
            if (correctAnswers.length !== 1) {
              return helpers.message('There must be exactly one correct answer');
            }
            return values;
          }),
        explanation: Joi.string().required(),
      });
    case ORDER_THE_SEQUENCE:
      return Joi.object().keys({
        question: Joi.string().required().max(QUESTION_MAX_LENGTH),
        orderedAnswers: Joi.array()
          .items(Joi.object({ text: Joi.string().required() }))
          .length(ORDER_THE_SEQUENCE_ANSWERS_COUNT),
        explanation: Joi.string().required(),
      });
    case MULTIPLE_CHOICE_QUESTION:
      return Joi.object().keys({
        question: Joi.string().required().max(QUESTION_MAX_LENGTH),
        qcAnswers: Joi.array()
          .items(Joi.object({
            text: Joi.string().required().max(QC_ANSWER_MAX_LENGTH),
            isCorrect: Joi.boolean().required(),
          }))
          .has(Joi.object({ isCorrect: true }))
          .min(CHOICE_QUESTION_MIN_ANSWERS_COUNT)
          .max(CHOICE_QUESTION_MAX_ANSWERS_COUNT),
        explanation: Joi.string().required(),
      });
    case SURVEY:
      return Joi.object().keys({
        question: Joi.string().required().max(QUESTION_MAX_LENGTH),
        labels: labelsValidation(labels),
      });
    case OPEN_QUESTION:
      return Joi.object().keys({
        question: Joi.string().required().max(QUESTION_MAX_LENGTH),
      });
    case QUESTION_ANSWER:
      return Joi.object().keys({
        question: Joi.string().required().max(QUESTION_MAX_LENGTH),
        qcAnswers: Joi.array().items(Joi.object({
          text: Joi.string().max(QC_ANSWER_MAX_LENGTH).required(),
        })).min(QUESTION_ANSWER_MIN_ANSWERS_COUNT).max(QUESTION_ANSWER_MAX_ANSWERS_COUNT),
      });
    default:
      return Joi.object().keys();
  }
};
