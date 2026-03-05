const Boom = require('@hapi/boom');
const CourseSlotsHelper = require('../helpers/courseSlots');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const courseSlots = await CourseSlotsHelper.list(req.query);

    return {
      message: translate[language].courseSlotsFound,
      data: { courseSlots },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    const courseSlot = await CourseSlotsHelper.createCourseSlot(req.payload);

    return {
      message: translate[language].courseSlotCreated,
      data: { courseSlot },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await CourseSlotsHelper.updateCourseSlot(req.params._id, req.payload, req.auth.credentials);

    return {
      message: translate[language].courseSlotUpdated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    await CourseSlotsHelper.removeCourseSlot(req.params._id);

    return {
      message: translate[language].courseSlotDeleted,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const updateSlotList = async (req) => {
  try {
    await CourseSlotsHelper.updateSlotList(req.payload);
    return { message: translate[language].courseSlotsUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { list, create, update, remove, updateSlotList };
