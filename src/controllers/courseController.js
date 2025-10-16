const Boom = require('@hapi/boom');
const { get } = require('lodash');
const CoursesHelper = require('../helpers/courses');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    req.log('courseController - list - query', req.query);
    req.log('courseController - list - company', get(req, 'auth.credentials.company._id'));

    const courses = await CoursesHelper.list(req.query, req.auth.credentials);

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
    const course = await CoursesHelper.createCourse(req.payload, req.auth.credentials);

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
    const { query, params } = req;
    const credentials = get(req, 'auth.credentials', null);
    const course = await CoursesHelper.getCourse(query, params, credentials);

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
    req.log('courseController - getFollowUp - query', req.query);
    req.log('courseController - getFollowUp - course', req.params._id);

    const followUp = await CoursesHelper.getCourseFollowUp(req.params._id, req.query, req.auth.credentials);

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

    return { message: translate[language].courseQuestionnairesFound, data: { questionnaireAnswers } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    const course = await CoursesHelper.updateCourse(req.params._id, req.payload, req.auth.credentials);

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
    await CoursesHelper.addTrainee(req.params._id, req.payload, req.auth.credentials);

    return { message: translate[language].courseTraineeAdded };
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
    req.log('courseController - downloadAttendanceSheets - params', req.params);
    req.log('courseController - downloadAttendanceSheets - company', get(req, 'auth.credentials.company._id'));

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
    req.log('courseController - downloadCompletionCertificates - query', req.query);
    req.log('courseController - downloadCompletionCertificates - params', req.params);
    req.log('courseController - downloadCompletionCertificates - company', get(req, 'auth.credentials.company._id'));

    const data = await CoursesHelper.generateCompletionCertificates(req.params._id, req.auth.credentials, req.query);

    if (data.zipPath) {
      return h.file(data.zipPath, { confine: false })
        .header('content-disposition', `attachment; filename=${data.zipName}`)
        .type('application/zip');
    }

    return h.response(data.file)
      .header('content-disposition', `inline; filename=${data.name}.pdf`)
      .type('application/pdf');
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
    req.log('courseController - generateConvocationPdf - params._id', req.params._id);
    req.log('courseController - generateConvocationPdf - company', get(req, 'auth.credentials.company._id'));

    const { pdf, courseName } = await CoursesHelper.generateConvocationPdf(req.params._id);

    return h.response(pdf)
      .header('content-disposition', `inline; filename=${courseName}.pdf`)
      .type('application/pdf');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getQuestionnaires = async (req) => {
  try {
    const questionnaires = await CoursesHelper.getQuestionnaires(req.params._id, req.auth.credentials);

    return { message: translate[language].questionnairesFound, data: { questionnaires } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addCompany = async (req) => {
  try {
    await CoursesHelper.addCourseCompany(req.params._id, req.payload, req.auth.credentials);

    return { message: translate[language].courseCompanyAdded };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeCompany = async (req) => {
  try {
    await CoursesHelper.removeCourseCompany(req.params._id, req.params.companyId, req.auth.credentials);

    return { message: translate[language].courseCompanyRemoved };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const generateTrainingContract = async (req, h) => {
  try {
    const { pdf, fileName } = await CoursesHelper.generateTrainingContract(req.params._id, req.payload);
    return h.response(pdf)
      .header('content-disposition', `inline; filename=${fileName}.pdf`)
      .type('application/pdf');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addTrainer = async (req) => {
  try {
    await CoursesHelper.addTrainer(req.params._id, req.payload, req.auth.credentials);

    return { message: translate[language].courseTrainerAdded };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeTrainer = async (req) => {
  try {
    await CoursesHelper.removeTrainer(req.params._id, req.params.trainerId, req.auth.credentials);

    return { message: translate[language].courseTrainerRemoved };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const addTutor = async (req) => {
  try {
    await CoursesHelper.addTutor(req.params._id, req.payload);

    return { message: translate[language].courseTutorAdded };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const removeTutor = async (req) => {
  try {
    await CoursesHelper.removeTutor(req.params._id, req.params.tutorId);

    return { message: translate[language].courseTutorRemoved };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const uploadCSV = async (req) => {
  try {
    await CoursesHelper.uploadCSV(req.params._id, req.pre.learnerList, req.auth.credentials);

    return { message: translate[language].courseTraineeAdded };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  list,
  create,
  getById,
  getFollowUp,
  getQuestionnaireAnswers,
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
  getQuestionnaires,
  addCompany,
  removeCompany,
  generateTrainingContract,
  addTrainer,
  removeTrainer,
  addTutor,
  removeTutor,
  uploadCSV,
};
