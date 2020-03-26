const Boom = require('@hapi/boom');
const CourseSlotsHelper = require('../helpers/courseSlots');
const translate = require('../helpers/translate');

const { language } = translate;

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
    const courseSlot = await CourseSlotsHelper.updateCourseSlot(req.params._id, req.payload);

    return {
      message: translate[language].courseSlotUpdated,
      data: { courseSlot },
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

module.exports = {
  create,
  update,
  remove,
};
