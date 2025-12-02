const Boom = require('@hapi/boom');
const compact = require('lodash/compact');
const get = require('lodash/get');
const has = require('lodash/has');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const translate = require('./translate');
const Course = require('../models/Course');
const CourseSlot = require('../models/CourseSlot');
const CourseHistoriesHelper = require('./courseHistories');
const { ON_SITE, REMOTE, DD_MM_YYYY } = require('./constants');
const DatesUtilsHelper = require('./dates/utils');
const { CompaniDate } = require('./dates/companiDates');

const { language } = translate;

exports.hasConflicts = async (slot) => {
  const query = {
    course: slot.course,
    startDate: { $lt: slot.endDate },
    endDate: { $gt: slot.startDate },
  };
  if (slot._id) query._id = { $ne: slot._id };
  const slotsInConflict = await CourseSlot.countDocuments(query);

  return !!slotsInConflict;
};

exports.createCourseSlot = async (payload) => {
  const slots = new Array(payload.quantity).fill(omit(payload, ['quantity']));

  const result = await CourseSlot.insertMany(slots);
  return result;
};

exports.updateCourseSlot = async (courseSlotId, payload, user) => {
  const courseSlot = await CourseSlot
    .findOne({ _id: courseSlotId })
    .populate({ path: 'step', select: '_id type' })
    .lean();

  if (has(payload, 'trainees')) {
    const course = await Course.findOne({ _id: courseSlot.course }, { trainees: 1 }).lean();
    const query = {};
    const courseTraineesLength = [...new Set(course.trainees.map(t => t.toHexString()))].length;
    const payloadTraineesLength = [...new Set(payload.trainees)].length;
    if (courseTraineesLength === payloadTraineesLength) query.$unset = { trainees: '' };
    else query.$set = { trainees: payload.trainees };
    await CourseSlot.updateOne({ _id: courseSlotId }, query);
    await CourseHistoriesHelper.createHistoryOnSlotRestriction(
      { ...pick(courseSlot, ['course', 'startDate', 'endDate']) },
      user._id
    );
  } else {
    const hasConflicts = await exports.hasConflicts({ ...courseSlot, ...payload });
    if (hasConflicts) throw Boom.conflict(translate[language].courseSlotConflict);

    const shouldEmptyDates = !payload.endDate && !payload.startDate;
    if (shouldEmptyDates) {
      const historyPayload = pick(courseSlot, ['course', 'startDate', 'endDate', 'address', 'meetingLink']);
      await Promise.all([
        CourseHistoriesHelper.createHistoryOnSlotDeletion(historyPayload, user._id),
        CourseSlot.updateOne(
          { _id: courseSlot._id },
          { $unset: { startDate: '', endDate: '', meetingLink: '', address: '' } }
        ),
      ]);
    } else {
      const updatePayload = { $set: payload };
      const { step } = courseSlot;

      if (step.type === ON_SITE || !payload.meetingLink) updatePayload.$unset = { meetingLink: '' };
      if (step.type === REMOTE || !payload.address) updatePayload.$unset = { ...updatePayload.$unset, address: '' };

      await Promise.all([
        CourseHistoriesHelper.createHistoryOnSlotEdition(courseSlot, payload, user._id),
        CourseSlot.updateOne({ _id: courseSlot._id }, updatePayload),
      ]);
    }
  }
};

exports.removeCourseSlot = async courseSlotId => CourseSlot.deleteOne({ _id: courseSlotId });

exports.getAddressList = (slots, steps) => {
  const hasRemoteSteps = steps.some(step => step.type === REMOTE);

  const fullAddressList = compact(slots.map(slot => get(slot, 'address.fullAddress')));
  const uniqFullAddressList = [...new Set(fullAddressList)];
  if (uniqFullAddressList.length <= 2) {
    return hasRemoteSteps
      ? [...uniqFullAddressList, 'Cette formation contient des créneaux en distanciel']
      : uniqFullAddressList;
  }

  const cityList = compact(slots.map(slot => get(slot, 'address.city')));
  const uniqCityList = [...new Set(cityList)];

  return hasRemoteSteps
    ? [...uniqCityList, 'Cette formation contient des créneaux en distanciel']
    : uniqCityList;
};

exports.formatSlotDates = (slots) => {
  const slotDatesWithDuplicate = slots
    .sort(DatesUtilsHelper.ascendingSortBy('startDate'))
    .map(slot => CompaniDate(slot.startDate).format(DD_MM_YYYY));

  return [...new Set(slotDatesWithDuplicate)];
};
