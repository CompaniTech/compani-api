const Boom = require('@hapi/boom');
const ProgramHelper = require('../helpers/programs');
const SubProgramHelper = require('../helpers/subPrograms');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const programs = await ProgramHelper.list();

    return {
      message: programs.length ? translate[language].programsFound : translate[language].programsNotFound,
      data: { programs },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const listELearning = async (req) => {
  try {
    const programs = await ProgramHelper.listELearning(req.auth.credentials, req.query);

    return {
      message: programs.length ? translate[language].programsFound : translate[language].programsNotFound,
      data: { programs },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    await ProgramHelper.createProgram(req.payload);

    return {
      message: translate[language].programCreated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getById = async (req) => {
  try {
    const program = await ProgramHelper.getProgram(req.params._id);

    return {
      message: translate[language].programFound,
      data: { program },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await ProgramHelper.updateProgram(req.params._id, req.payload);

    return { message: translate[language].programUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addSubProgram = async (req) => {
  try {
    await SubProgramHelper.addSubProgram(req.params._id, req.payload);

    return { message: translate[language].programUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const uploadImage = async (req) => {
  try {
    await ProgramHelper.uploadImage(req.params._id, req.payload);

    return { message: translate[language].fileCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const deleteImage = async (req) => {
  try {
    await ProgramHelper.deleteImage(req.params._id, req.pre.publicId);

    return { message: translate[language].programUpdated };
  } catch (e) {
    if (e.upload && e.code === 404) return { message: translate[language].programUpdated };

    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addCategory = async (req) => {
  try {
    await ProgramHelper.addCategory(req.params._id, req.payload);

    return { message: translate[language].categoryAdded };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeCategory = async (req) => {
  try {
    await ProgramHelper.removeCategory(req.params._id, req.params.categoryId);

    return { message: translate[language].categoryRemoved };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addTester = async (req) => {
  try {
    await ProgramHelper.addTester(req.params._id, req.payload);

    return { message: translate[language].testerAdded };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeTester = async (req) => {
  try {
    await ProgramHelper.removeTester(req.params._id, req.params.testerId);

    return { message: translate[language].testerRemoved };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addTradeName = async (req) => {
  try {
    await ProgramHelper.addTradeName(req.params._id, req.payload);

    return { message: translate[language].tradeNameAdded };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  list,
  listELearning,
  create,
  getById,
  update,
  addSubProgram,
  uploadImage,
  deleteImage,
  addCategory,
  removeCategory,
  addTester,
  removeTester,
  addTradeName,
};
