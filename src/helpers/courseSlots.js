const { ObjectId } = require('mongodb');
const compact = require('lodash/compact');
const get = require('lodash/get');
const groupBy = require('lodash/groupBy');
const has = require('lodash/has');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const uniqBy = require('lodash/uniqBy');
const Course = require('../models/Course');
const CourseSlot = require('../models/CourseSlot');
const CourseHelper = require('./courses');
const CourseHistoriesHelper = require('./courseHistories');
const { ON_SITE, REMOTE, DD_MM_YYYY, SINGLE, DAY, MINUTE, MISSING } = require('./constants');
const DatesUtilsHelper = require('./dates/utils');
const UtilsHelper = require('./utils');
const { CompaniDate } = require('./dates/companiDates');

exports.list = async (query) => {
  const singleCourses = await Course.find({ type: SINGLE }, { _id: 1 }).lean();
  const singleCourseIds = singleCourses.map(course => new ObjectId(course._id));

  const courseSlots = await CourseSlot
    .find({ course: { $in: singleCourseIds }, startDate: { $gte: query.startDate }, endDate: { $lte: query.endDate } })
    .populate({ path: 'step', select: '_id name' })
    .populate({ path: 'trainers', select: 'identity' })
    .populate({
      path: 'course',
      select: '_id misc subProgram trainees',
      populate: [
        { path: 'trainees', select: 'identity' },
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
      ],
    })
    .populate({ path: 'attendances', select: 'status', options: { isVendorUser: true } })
    .lean();
  const filteredCourseSlots = courseSlots.filter(slot => slot.attendances.length);

  const trainers = uniqBy(filteredCourseSlots.flatMap(slot => (slot.trainers || [])), t => t._id.toHexString());

  const collectiveStepIds = process.env.COLLECTIVE_STEP_IDS.split(',').map(id => new ObjectId(id));
  const slotsByTrainer = filteredCourseSlots.reduce((acc, slot) => {
    (slot.trainers || []).forEach((t) => {
      if (!acc[t._id]) acc[t._id] = [slot];
      else acc[t._id].push(slot);
    });
    return acc;
  }, {});

  const formattedSlotsGroupByTrainer = {};
  for (const trainer of trainers) {
    const trainerSlots = slotsByTrainer[trainer._id];
    const slotsByCourse = groupBy(trainerSlots, slot => slot.course._id.toHexString());

    const trainerCourses = [];
    const collectiveSlots = [];
    for (const course of Object.keys(slotsByCourse)) {
      const currentCourseSlots = slotsByCourse[course];
      const singleTraineeSlots = [];

      currentCourseSlots.forEach((slot) => {
        if (UtilsHelper.doesArrayIncludeId(collectiveStepIds, slot.step._id)) collectiveSlots.push(slot);
        else singleTraineeSlots.push(slot);
      });
      if (!singleTraineeSlots.length) continue;

      const singleTraineeSlotsGroupByStep = groupBy(singleTraineeSlots, slot => slot.step._id);

      const formattedSingleTraineeSlots = {};
      Object.values(singleTraineeSlotsGroupByStep).forEach((slots) => {
        const stepName = slots[0].step.name;
        formattedSingleTraineeSlots[stepName] = slots.map(slot => ({
          startDate: CompaniDate(slot.startDate).toISO(),
          endDate: CompaniDate(slot.endDate).toISO(),
          duration: CompaniDate(slot.endDate).diff(slot.startDate, MINUTE),
          isAbsence: slot.attendances[0].status === MISSING,
          status: slot.status,
        }));
      });

      trainerCourses.push({
        _id: course,
        name: CourseHelper.composeCourseName(currentCourseSlots[0].course),
        singleTraineeSlots: formattedSingleTraineeSlots,
      });
    }

    const collectiveSlotsGroupByDay = groupBy(
      collectiveSlots,
      slot => CompaniDate(slot.startDate).startOf(DAY).format(DD_MM_YYYY)
    );
    const formattedCollectiveSlots = {};
    Object.entries(collectiveSlotsGroupByDay).forEach(([day, slots]) => {
      formattedCollectiveSlots[day] = slots.map((slot) => {
        const traineeName = UtilsHelper.formatIdentity(slot.course.trainees[0].identity, 'FL');
        return {
          traineeName,
          startDate: CompaniDate(slot.startDate).toISO(),
          endDate: CompaniDate(slot.endDate).toISO(),
          duration: CompaniDate(slot.endDate).diff(slot.startDate, MINUTE),
          isAbsence: slot.attendances[0].status === MISSING,
          status: slot.status,
        };
      });
    });

    formattedSlotsGroupByTrainer[trainer._id] = {
      identity: trainer.identity,
      courses: trainerCourses,
      collectiveSlots: formattedCollectiveSlots,
    };
  }

  return formattedSlotsGroupByTrainer;
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
          { $unset: { startDate: '', endDate: '', meetingLink: '', address: '', trainees: '', trainers: '' } }
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
        const afternonStartDate = CompaniDate(payload.startDate).set({ hour: 13, minute: 30 }).toISO();
        const afternoonEndDate = CompaniDate(payload.endDate).set({ hour: 17, minute: 0 }).toISO();
        const slotData = pick(
          { ...courseSlot, ...payload },
          ['course', 'step', 'address', 'meetingLink', 'trainees', 'trainers']
        );
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
          promises.push(CourseSlot.create({ ...slotData, startDate: afternonStartDate, endDate: afternoonEndDate }));
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
