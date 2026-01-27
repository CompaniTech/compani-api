const Boom = require('@hapi/boom');
const QuestionnaireHelper = require('../helpers/questionnaires');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const questionnaires = await QuestionnaireHelper.list(req.auth.credentials, req.query);

    return {
      message: questionnaires.length
        ? translate[language].questionnairesFound
        : translate[language].questionnairesNotFound,
      data: { questionnaires },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    await QuestionnaireHelper.create(req.payload);

    return { message: translate[language].questionnaireCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getById = async (req) => {
  try {
    const questionnaire = await QuestionnaireHelper.getQuestionnaire(req.params._id);

    return {
      message: translate[language].questionnaireFound,
      data: { questionnaire },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await QuestionnaireHelper.update(req.params._id, req.payload, req.pre.questionnaireToArchiveId);

    return { message: translate[language].questionnaireUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addCard = async (req) => {
  try {
    await QuestionnaireHelper.addCard(req.params._id, req.payload);

    return { message: translate[language].questionnaireUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeCard = async (req) => {
  try {
    await QuestionnaireHelper.removeCard(req.params.cardId);

    return { message: translate[language].cardDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getUserQuestionnaires = async (req) => {
  try {
    const questionnaires = await QuestionnaireHelper.getUserQuestionnaires(req.query.course, req.auth.credentials);

    return {
      message: questionnaires.length
        ? translate[language].questionnairesFound
        : translate[language].questionnairesNotFound,
      data: { questionnaires },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getFollowUp = async (req) => {
  try {
    const followUp = await QuestionnaireHelper.getFollowUp(req.params._id, req.query, req.auth.credentials);

    return { message: translate[language].questionnaireFound, data: { ...followUp } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getQRCode = async (req) => {
  try {
    const qrCode = await QuestionnaireHelper.generateQRCode(req.query);

    return { message: translate[language].questionnaireQRCodeGenerated, data: { qrCode } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { list, create, getById, update, addCard, removeCard, getUserQuestionnaires, getFollowUp, getQRCode };
