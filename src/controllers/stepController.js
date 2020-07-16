const Boom = require('@hapi/boom');
const StepHelper = require('../helpers/steps');
const ActivityHelper = require('../helpers/activities');
const translate = require('../helpers/translate');

const { language } = translate;

const update = async (req) => {
  try {
    await StepHelper.updateStep(req.params._id, req.payload);

    return {
      message: translate[language].stepUpdated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addActivity = async (req) => {
  try {
    await ActivityHelper.addActivity(req.params._id, req.payload);

    return {
      message: translate[language].stepUpdated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  update,
  addActivity,
};
