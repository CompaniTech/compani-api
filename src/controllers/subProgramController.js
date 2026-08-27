const Boom = require('@hapi/boom');
const SubProgramHelper = require('../helpers/subPrograms');
const StepsHelper = require('../helpers/steps');
const translate = require('../helpers/translate');

const { language } = translate;

const update = async (req) => {
  try {
    await SubProgramHelper.updateSubProgram(req.params._id, req.payload);

    return { message: translate[language].subProgramUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    await SubProgramHelper.deleteSubProgram(req.params._id);

    return { message: translate[language].subProgramDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addStep = async (req) => {
  try {
    await StepsHelper.addStep(req.params._id, req.payload);

    return { message: translate[language].subProgramUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const reuseStep = async (req) => {
  try {
    await SubProgramHelper.reuseStep(req.params._id, req.payload);

    return { message: translate[language].subProgramUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const detachStep = async (req) => {
  try {
    await StepsHelper.detachStep(req.params._id, req.params.stepId);

    return { message: translate[language].subProgramUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const listELearningDraft = async (req) => {
  try {
    const subPrograms = await SubProgramHelper.listELearningDraft(req.pre.testerRestrictedPrograms);

    return {
      message: subPrograms.length ? translate[language].subProgramsFound : translate[language].subProgramsNotFound,
      data: { subPrograms },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getById = async (req) => {
  try {
    const subProgram = await SubProgramHelper.getSubProgram(req.params._id);

    return {
      message: translate[language].subProgramFound,
      data: { subProgram },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  update,
  remove,
  addStep,
  detachStep,
  listELearningDraft,
  getById,
  reuseStep,
};
