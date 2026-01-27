const compact = require('lodash/compact');
const get = require('lodash/get');
const has = require('lodash/has');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const Course = require('../models/Course');
const CourseSlot = require('../models/CourseSlot');
const CourseHistoriesHelper = require('./courseHistories');
const { ON_SITE, REMOTE, DD_MM_YYYY } = require('./constants');
const DatesUtilsHelper = require('./dates/utils');
const { CompaniDate } = require('./dates/companiDates');

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
    const query = course.trainees.length === payload.trainees.length
      ? { $unset: { trainees: '' } }
      : { $set: { trainees: payload.trainees } };
    await CourseSlot.updateOne({ _id: courseSlotId }, query);
    await CourseHistoriesHelper.createHistoryOnSlotRestriction(
      { ...pick(courseSlot, ['course', 'startDate', 'endDate']) },
      user._id
    );
  } else {
    const shouldEmptyDates = !payload.endDate && !payload.startDate;
    if (shouldEmptyDates) {
      const historyPayload = pick(courseSlot, ['course', 'startDate', 'endDate', 'address', 'meetingLink']);
      await Promise.all([
        CourseHistoriesHelper.createHistoryOnSlotDeletion(historyPayload, user._id),
        CourseSlot.updateOne(
          { _id: courseSlot._id },
          { $unset: { startDate: '', endDate: '', meetingLink: '', address: '', trainees: '' } }
        ),
      ]);
    } else {
      const updatePayload = { $set: omit(payload, 'wholeDay') };
      const { step } = courseSlot;

      if (step.type === ON_SITE || !payload.meetingLink) updatePayload.$unset = { meetingLink: '' };
      if (step.type === REMOTE || !payload.address) updatePayload.$unset = { ...updatePayload.$unset, address: '' };
      const promises = [
        CourseHistoriesHelper.createHistoryOnSlotEdition(courseSlot, payload, user._id),
        CourseSlot.updateOne({ _id: courseSlot._id }, updatePayload),
      ];
      if (payload.wholeDay) {
        const afternonStartDate = CompaniDate(payload.startDate).set({ hour: 14, minute: 0 }).toISO();
        const afternoonEndDate = CompaniDate(payload.endDate).set({ hour: 17, minute: 30 }).toISO();
        const slotData = pick(courseSlot, ['course', 'step', 'address', 'meetingLink']);
        const slotToPlan = await CourseSlot
          .findOne({
            course: courseSlot.course,
            step: step._id,
            startDate: { $exists: false },
            endDate: { $exists: false },
            _id: { $ne: courseSlot._id },
          })
          .lean();
        if (slotToPlan) {
          promises.push(
            CourseSlot.updateOne(
              { _id: slotToPlan._id },
              { $set: { ...slotData, startDate: afternonStartDate, endDate: afternoonEndDate } }
            )
          );
        } else {
          promises.push(CourseSlot.create({
            ...slotData,
            startDate: afternonStartDate,
            endDate: afternoonEndDate,
          }
          ));
        }
        promises.push(
          CourseHistoriesHelper.createHistoryOnSlotCreation(
            { startDate: afternonStartDate, endDate: afternoonEndDate, ...slotData },
            user._id
          )
        );
      }

      await Promise.all(promises);
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
