const Boom = require('@hapi/boom');
const QuestionnaireHistoryHelper = require('../helpers/questionnaireHistories');
const translate = require('../helpers/translate');

const { language } = translate;

const addQuestionnaireHistory = async (req) => {
  try {
    await QuestionnaireHistoryHelper.addQuestionnaireHistory(req.payload, req.auth.credentials);

    return { message: translate[language].questionnaireHistoryCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await QuestionnaireHistoryHelper.updateQuestionnaireHistory(req.params._id, req.payload);

    return { message: translate[language].questionnaireHistoryUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { addQuestionnaireHistory, update };
