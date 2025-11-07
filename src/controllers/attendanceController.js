const Boom = require('@hapi/boom');
const get = require('lodash/get');
const AttendanceHelper = require('../helpers/attendances');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const { courseSlotsIds } = req.pre.attendancesInfos;
    const attendances = await AttendanceHelper.list(courseSlotsIds, req.auth.credentials);

    return {
      message: attendances.length ? translate[language].attendancesFound : translate[language].attendancesNotFound,
      data: { attendances },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const listUnsubscribed = async (req) => {
  try {
    req.log('attendanceController - listUnsubscribed - query', req.query);
    req.log('attendanceController - listUnsubscribed - company', get(req, 'auth.credentials.company._id'));

    const unsubscribedAttendances = req.query.course
      ? await AttendanceHelper.listUnsubscribed(req.query, req.auth.credentials)
      : await AttendanceHelper.getTraineeUnsubscribedAttendances(req.query.trainee, req.auth.credentials);

    return {
      message: unsubscribedAttendances.length
        ? translate[language].attendancesFound
        : translate[language].attendancesNotFound,
      data: { unsubscribedAttendances },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    await AttendanceHelper.create(req.payload, req.auth.credentials);

    return { message: translate[language].attendanceCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    await AttendanceHelper.delete(req.query);

    return { message: translate[language].attendanceDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    await AttendanceHelper.update(req.query);

    return { message: translate[language].attendanceUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { list, listUnsubscribed, create, remove, update };
