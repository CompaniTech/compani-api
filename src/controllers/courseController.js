const Boom = require('@hapi/boom');
const CoursesHelper = require('../helpers/courses');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const courses = await CoursesHelper.list(req.query);

    return {
      message: courses.length ? translate[language].coursesFound : translate[language].coursesNotFound,
      data: { courses },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const listUserCourses = async (req) => {
  try {
    const courses = await CoursesHelper.listUserCourses(req.pre.trainee);

    return {
      message: courses.length ? translate[language].coursesFound : translate[language].coursesNotFound,
      data: { courses },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    const course = await CoursesHelper.createCourse(req.payload);

    return {
      message: translate[language].courseCreated,
      data: { course },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getById = async (req) => {
  try {
    const course = await CoursesHelper.getCourse(req.pre.course, req.auth.credentials);

    return {
      message: translate[language].courseFound,
      data: { course },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getFollowUp = async (req) => {
  try {
    const followUp = await CoursesHelper.getCourseFollowUp(req.pre.course, req.query.company);

    return {
      message: translate[language].courseFound,
      data: { followUp },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getQuestionnaireAnswers = async (req) => {
  try {
    const questionnaireAnswers = await CoursesHelper.getQuestionnaireAnswers(req.params._id);

    return {
      message: translate[language].courseFound,
      data: { questionnaireAnswers },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getTraineeCourse = async (req) => {
  try {
    const course = await CoursesHelper.getTraineeCourse(req.params._id, req.auth.credentials);

    return {
      message: translate[language].courseFound,
      data: { course },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    const course = await CoursesHelper.updateCourse(req.params._id, req.payload);

    return {
      message: translate[language].courseUpdated,
      data: { course },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const deleteCourse = async (req) => {
  try {
    await CoursesHelper.deleteCourse(req.params._id);

    return { message: translate[language].courseDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const sendSMS = async (req) => {
  try {
    await CoursesHelper.sendSMS(req.params._id, req.payload, req.auth.credentials);

    return { message: translate[language].smsSent };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getSMSHistory = async (req) => {
  try {
    const sms = await CoursesHelper.getSMSHistory(req.params._id);

    return {
      message: translate[language].smsFound,
      data: { sms },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addTrainee = async (req) => {
  try {
    const course = await CoursesHelper
      .addCourseTrainee(req.params._id, req.payload, req.pre.trainee, req.auth.credentials);

    return {
      message: translate[language].courseTraineeAdded,
      data: { course },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const registerToELearningCourse = async (req) => {
  try {
    const course = await CoursesHelper.registerToELearningCourse(req.params._id, req.auth.credentials);

    return {
      message: translate[language].courseTraineeAdded,
      data: { course },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeTrainee = async (req) => {
  try {
    await CoursesHelper.removeCourseTrainee(req.params._id, req.params.traineeId, req.auth.credentials);

    return { message: translate[language].courseTraineeRemoved };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const downloadAttendanceSheets = async (req, h) => {
  try {
    const { pdf, fileName } = await CoursesHelper.generateAttendanceSheets(req.params._id);

    return h.response(pdf)
      .header('content-disposition', `inline; filename=${fileName}.pdf`)
      .type('application/pdf');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const downloadCompletionCertificates = async (req, h) => {
  try {
    const { zipPath, zipName } = await CoursesHelper.generateCompletionCertificates(req.params._id);

    return h.file(zipPath, { confine: false })
      .header('content-disposition', `attachment; filename=${zipName}`)
      .type('application/zip');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addAccessRule = async (req) => {
  try {
    await CoursesHelper.addAccessRule(req.params._id, req.payload);

    return { message: translate[language].courseAccessRuleAdded };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const deleteAccessRule = async (req) => {
  try {
    await CoursesHelper.deleteAccessRule(req.params._id, req.params.accessRuleId);

    return { message: translate[language].courseAccessRuleDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const generateConvocationPdf = async (req, h) => {
  try {
    const { pdf, courseName } = await CoursesHelper.generateConvocationPdf(req.pre.course._id);

    return h.response(pdf)
      .header('content-disposition', `inline; filename=${courseName}.pdf`)
      .type('application/pdf');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  list,
  listUserCourses,
  create,
  getById,
  getFollowUp,
  getQuestionnaireAnswers,
  getTraineeCourse,
  update,
  deleteCourse,
  addTrainee,
  registerToELearningCourse,
  removeTrainee,
  downloadAttendanceSheets,
  downloadCompletionCertificates,
  sendSMS,
  getSMSHistory,
  addAccessRule,
  generateConvocationPdf,
  deleteAccessRule,
};
