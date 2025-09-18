const Boom = require('@hapi/boom');
const AttendanceSheetHelper = require('../helpers/attendanceSheets');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const attendanceSheets = await AttendanceSheetHelper.list(req.query, req.auth.credentials);

    return {
      message: attendanceSheets.length
        ? translate[language].attendanceSheetsFound
        : translate[language].attendanceSheetsNotFound,
      data: { attendanceSheets },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    await AttendanceSheetHelper.create(req.payload, req.auth.credentials);

    return { message: translate[language].attendanceSheetCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const updateAttendanceSheet = async (req) => {
  try {
    if (req.payload.slots) await AttendanceSheetHelper.update(req.params._id, req.payload);
    else await AttendanceSheetHelper.generate(req.params._id);

    return { message: translate[language].attendanceSheetUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const signAttendanceSheet = async (req) => {
  try {
    await AttendanceSheetHelper.sign(req.params._id, req.payload, req.auth.credentials);

    return { message: translate[language].attendanceSheetUpdated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const deleteAttendanceSheet = async (req) => {
  try {
    await AttendanceSheetHelper.delete(req.params._id, req.query.shouldDeleteAttendances);

    return { message: translate[language].attendanceSheetDeleted };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { list, create, updateAttendanceSheet, deleteAttendanceSheet, signAttendanceSheet };
