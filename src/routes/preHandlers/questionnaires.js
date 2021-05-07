const Boom = require('@hapi/boom');
const get = require('lodash/get');
const {
  DRAFT,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  PUBLISHED,
  TRAINER,
  BLENDED,
  TEXT_MEDIA,
  TITLE_TEXT_MEDIA,
} = require('../../helpers/constants');
const translate = require('../../helpers/translate');
const Questionnaire = require('../../models/Questionnaire');
const Card = require('../../models/Card');
const Course = require('../../models/Course');
const { getCardMediaPublicId } = require('./utils');

const { language } = translate;

exports.authorizeQuestionnaireCreation = async (req) => {
  const { type } = req.payload;
  const draftQuestionnaires = await Questionnaire.countDocuments({ type, status: DRAFT });

  if (draftQuestionnaires) throw Boom.conflict(translate[language].draftQuestionnaireAlreadyExists);

  return null;
};

exports.authorizeQuestionnaireGet = async (req) => {
  const questionnaire = await Questionnaire.findOne({ _id: req.params._id }, { status: 1 }).lean();
  if (!questionnaire) throw Boom.notFound();

  const loggedUserVendorRole = get(req, 'auth.credentials.role.vendor.name');
  if (![TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(loggedUserVendorRole) &&
    questionnaire.status !== PUBLISHED) {
    throw Boom.forbidden();
  }

  return null;
};

exports.authorizeUserQuestionnairesGet = async (req) => {
  const course = await Course.countDocuments({ _id: req.query.course });
  if (!course) throw Boom.notFound();

  return course;
};

exports.authorizeQuestionnaireEdit = async (req) => {
  const questionnaire = await Questionnaire
    .findOne({ _id: req.params._id }, { status: 1, type: 1 })
    .populate({ path: 'cards', select: '-__v -createdAt -updatedAt' })
    .lean({ virtuals: true });

  if (!questionnaire) throw Boom.notFound();

  if (questionnaire.status === PUBLISHED && !req.payload.name) throw Boom.forbidden();

  const publishedQuestionnaireWithSameTypeExists = await Questionnaire.countDocuments(
    { type: questionnaire.type, status: PUBLISHED }
  );
  if (req.payload.status === PUBLISHED && publishedQuestionnaireWithSameTypeExists) {
    throw Boom.conflict(translate[language].publishedQuestionnaireWithSameTypeExists);
  }
  if (req.payload.status === PUBLISHED && !questionnaire.areCardsValid) throw Boom.forbidden();

  return null;
};

exports.authorizeCardDeletion = async (req) => {
  const { cardId } = req.params;
  const card = await Card.findOne({ _id: cardId }, { _id: 1, template: 1 }).lean();
  if (!card) throw Boom.notFound();

  const questionnaire = await Questionnaire.countDocuments({ cards: cardId, status: PUBLISHED });
  if (questionnaire) throw Boom.forbidden();

  if ([TEXT_MEDIA, TITLE_TEXT_MEDIA].includes(card.template)) return getCardMediaPublicId({ params: { _id: cardId } });

  return null;
};

exports.authorizeGetFollowUp = async (req) => {
  const credentials = get(req, 'auth.credentials');
  const countQuery = get(credentials, 'role.vendor.name') === TRAINER
    ? { _id: req.query.course, format: BLENDED, trainer: credentials._id }
    : { _id: req.query.course, format: BLENDED };
  const course = await Course.countDocuments(countQuery);
  const questionnaire = await Questionnaire.countDocuments({ _id: req.params._id });
  if (!course || !questionnaire) throw Boom.notFound();

  return null;
};
