const pick = require('lodash/pick');
const sortedUniqBy = require('lodash/sortedUniqBy');
const { CompaniDate } = require('./dates/companiDates');
const CourseHistory = require('../models/CourseHistory');
const {
  SLOT_CREATION,
  SLOT_DELETION,
  SLOT_EDITION,
  TRAINEE_ADDITION,
  TRAINEE_DELETION,
  ESTIMATED_START_DATE_EDITION,
  MINUTE,
  HOUR,
  DAY,
  COMPANY_ADDITION,
  COMPANY_DELETION,
} = require('./constants');

exports.createHistory = async (course, createdBy, action, payload = {}) =>
  CourseHistory.create({ course, createdBy, action, ...payload });

exports.createHistoryOnSlotCreation = (payload, userId) => {
  const pickedFields = ['startDate', 'endDate'];
  if (payload.address && Object.values(payload.address).length) pickedFields.push('address');
  else if (payload.meetingLink) pickedFields.push('meetingLink');

  return exports.createHistory(
    payload.course,
    userId,
    SLOT_CREATION,
    { slot: pick(payload, pickedFields) }
  );
};

exports.createHistoryOnSlotDeletion = (payload, userId) => {
  const pickedFields = ['startDate', 'endDate'];
  if (payload.address && Object.values(payload.address).length) pickedFields.push('address');
  else if (payload.meetingLink) pickedFields.push('meetingLink');

  return exports.createHistory(
    payload.course,
    userId,
    SLOT_DELETION,
    { slot: pick(payload, pickedFields) }
  );
};

exports.createHistoryOnTraineeAddition = (payload, userId) => exports.createHistory(
  payload.course,
  userId,
  TRAINEE_ADDITION,
  { trainee: payload.traineeId, company: payload.company }
);

exports.createHistoryOnTraineeDeletion = (payload, userId) =>
  exports.createHistory(payload.course, userId, TRAINEE_DELETION, { trainee: payload.traineeId });

exports.createHistoryOnSlotEdition = async (slotFromDb, payload, userId) => {
  if (!slotFromDb.startDate && payload.startDate) {
    return exports.createHistoryOnSlotCreation({ ...slotFromDb, ...payload }, userId);
  }

  const isDateUpdated = !CompaniDate(slotFromDb.startDate).isSame(payload.startDate, DAY);
  const isHourUpdated = !CompaniDate(slotFromDb.startDate).hasSameUnits(payload.startDate, [HOUR, MINUTE]) ||
    !CompaniDate(slotFromDb.endDate).hasSameUnits(payload.endDate, [HOUR, MINUTE]);

  if (!isDateUpdated && !isHourUpdated) return null;

  const actionPayload = {
    update: {
      ...(isDateUpdated && { startDate: { from: slotFromDb.startDate, to: payload.startDate } }),
      ...(isHourUpdated && {
        startHour: { from: slotFromDb.startDate, to: payload.startDate },
        endHour: { from: slotFromDb.endDate, to: payload.endDate },
      }),
    },
  };

  return exports.createHistory(slotFromDb.course, userId, SLOT_EDITION, actionPayload);
};

exports.createHistoryOnEstimatedStartDateEdition = (
  courseId,
  userId,
  newEstimatedStartDate,
  formerEstimatedStartDate = null
) => exports.createHistory(
  courseId,
  userId,
  ESTIMATED_START_DATE_EDITION,
  {
    update: {
      estimatedStartDate: {
        ...(formerEstimatedStartDate && { from: formerEstimatedStartDate }),
        to: newEstimatedStartDate,
      },
    },
  }
);

exports.list = async (query) => {
  const findQuery = { course: query.course };
  if (query.createdAt) findQuery.createdAt = { $lt: query.createdAt };

  return CourseHistory.find(findQuery)
    .populate({ path: 'createdBy', select: '_id identity picture' })
    .populate({ path: 'trainee', select: '_id identity' })
    .populate({ path: 'company', select: '_id name' })
    .populate({ path: 'trainer', select: '_id identity' })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
};

exports.createHistoryOnCompanyAddition = (payload, userId) =>
  exports.createHistory(payload.course, userId, COMPANY_ADDITION, { company: payload.company });

exports.createHistoryOnCompanyDeletion = (payload, userId) =>
  exports.createHistory(payload.course, userId, COMPANY_DELETION, { company: payload.company });

exports.getCompanyAtCourseRegistrationList = async (singleton, list) => {
  const courseHistories = await CourseHistory
    .find(
      { [singleton.key]: singleton.value, action: TRAINEE_ADDITION, [list.key]: { $in: list.value } },
      { [list.key]: 1, company: 1, createdAt: 1, _id: 0 }
    )
    .sort({ createdAt: -1, [list.key]: 1 })
    .lean();

  const companyAtCourseRegistrationList = sortedUniqBy(courseHistories, ch => ch[list.key].toHexString())
    .map(courseHistory => pick(courseHistory, [list.key, 'company']));

  return companyAtCourseRegistrationList;
};

exports.createHistoryOnTrainerAdditionOrDeletion = (payload, userId) =>
  exports.createHistory(payload.course, userId, payload.action, { trainer: payload.trainerId });

exports.createHistoryOnCourseInterruptionOrRestart = (payload, userId) =>
  exports.createHistory(payload.courseId, userId, payload.action);
