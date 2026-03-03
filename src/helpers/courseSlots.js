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
const { ON_SITE, REMOTE, DD_MM_YYYY, SINGLE, DAY, MINUTE, MISSING, PAID, NOT_PAID } = require('./constants');
const DatesUtilsHelper = require('./dates/utils');
const UtilsHelper = require('./utils');
const NumbersHelper = require('./numbers');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');

const getSlotsDuration = slots => slots.reduce(
  (acc, slot) => {
    if (slot.status === PAID) {
      acc.paidSlotsDuration = CompaniDuration(acc.paidSlotsDuration).add(slot.duration);
      if (slot.isAbsence) {
        acc.paidSlotsAbsenceDuration = CompaniDuration(acc.paidSlotsAbsenceDuration).add(slot.duration);
      }
    } else {
      acc.notPaidSlotsDuration = CompaniDuration(acc.notPaidSlotsDuration).add(slot.duration);
      if (slot.isAbsence) {
        acc.notPaidSlotsAbsenceDuration = CompaniDuration(acc.notPaidSlotsAbsenceDuration).add(slot.duration);
      }
    }
    return acc;
  },
  {
    paidSlotsDuration: 'PT0S',
    paidSlotsAbsenceDuration: 'PT0S',
    notPaidSlotsDuration: 'PT0S',
    notPaidSlotsAbsenceDuration: 'PT0S',
  }
);

const filterPriceVersion = date => version => CompaniDate(version.effectiveDate).isSameOrBefore(date);

const getHourlyAmount = (slot) => {
  const matchingSubProgamPriceVersion = UtilsHelper.getMatchingVersion(
    slot.startDate,
    { ...omit(slot.course.subProgram, 'priceVersions'), versions: slot.course.subProgram.priceVersions },
    'effectiveDate',
    filterPriceVersion
  );
  const price = matchingSubProgamPriceVersion.prices
    .find(p => UtilsHelper.areObjectIdsEquals(p.step, slot.step._id));

  return price ? price.hourlyAmount : 0;
};

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
        { path: 'subProgram', select: 'program priceVersions', populate: { path: 'program', select: 'name' } },
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
    let totalPaidSingleSlotsDuration = CompaniDuration('PT0S');
    let totalPaidSingleSlotsAbsenceDuration = CompaniDuration('PT0S');
    let totalNotPaidSingleSlotsDuration = CompaniDuration('PT0S');
    let totalNotPaidSingleSlotsAbsenceDuration = CompaniDuration('PT0S');

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
        const { step } = slots[0];

        let toPayDuration = CompaniDuration('PT0S');
        let paidDuration = CompaniDuration('PT0S');
        let toPayAmount = 0;
        let paidAmount = 0;
        const stepSlots = slots.map((slot) => {
          const hourlyAmount = getHourlyAmount(slot);
          const duration = CompaniDate(slot.endDate).diff(slot.startDate, MINUTE);
          const amount = NumbersHelper.multiply(hourlyAmount, CompaniDuration(duration).asHours());

          if (slot.status === NOT_PAID) {
            toPayDuration = toPayDuration.add(CompaniDuration(duration));
            toPayAmount = NumbersHelper.add(toPayAmount, amount);
          } else {
            paidDuration = paidDuration.add(CompaniDuration(duration));
            paidAmount = NumbersHelper.add(paidAmount, amount);
          }

          return {
            startDate: CompaniDate(slot.startDate).toISO(),
            endDate: CompaniDate(slot.endDate).toISO(),
            duration,
            isAbsence: slot.attendances[0].status === MISSING,
            status: slot.status,
            amount,
          };
        });

        formattedSingleTraineeSlots[step.name] = {
          slots: stepSlots,
          toPayDuration: toPayDuration.toISO(),
          paidDuration: paidDuration.toISO(),
          toPayAmount,
          paidAmount,
        };
      });

      const singleSlots = Object.values(formattedSingleTraineeSlots)
        .flatMap(val => val.slots.flatMap(s => (Array.isArray(s) ? s : s)));
      const {
        paidSlotsDuration: paidSingleSlotsDuration,
        paidSlotsAbsenceDuration: paidSingleSlotsAbsenceDuration,
        notPaidSlotsDuration: notPaidSingleSlotsDuration,
        notPaidSlotsAbsenceDuration: notPaidSingleSlotsAbsenceDuration,
      } = getSlotsDuration(singleSlots);

      trainerCourses.push({
        _id: course,
        name: CourseHelper.composeCourseName(currentCourseSlots[0].course),
        singleTraineeSlots: formattedSingleTraineeSlots,
        paidSingleSlotsDuration: CompaniDuration(paidSingleSlotsDuration).toISO(),
        paidSingleSlotsAbsenceDuration: CompaniDuration(paidSingleSlotsAbsenceDuration).toISO(),
        notPaidSingleSlotsDuration: CompaniDuration(notPaidSingleSlotsDuration).toISO(),
        notPaidSingleSlotsAbsenceDuration: CompaniDuration(notPaidSingleSlotsAbsenceDuration).toISO(),
      });

      totalPaidSingleSlotsDuration = totalPaidSingleSlotsDuration.add(paidSingleSlotsDuration);
      totalPaidSingleSlotsAbsenceDuration = totalPaidSingleSlotsAbsenceDuration.add(paidSingleSlotsAbsenceDuration);
      totalNotPaidSingleSlotsDuration = totalNotPaidSingleSlotsDuration.add(notPaidSingleSlotsDuration);
      totalNotPaidSingleSlotsAbsenceDuration = totalNotPaidSingleSlotsAbsenceDuration
        .add(notPaidSingleSlotsAbsenceDuration);
    }

    const collectiveSlotsGroupByDay = groupBy(
      collectiveSlots,
      slot => CompaniDate(slot.startDate).startOf(DAY).format(DD_MM_YYYY)
    );
    const formattedCollectiveSlots = {};
    Object.entries(collectiveSlotsGroupByDay).forEach(([day, slots]) => {
      formattedCollectiveSlots[day] = slots.map((slot) => {
        const traineeName = UtilsHelper.formatIdentity(slot.course.trainees[0].identity, 'FL');
        const duration = CompaniDate(slot.endDate).diff(slot.startDate, MINUTE);
        const hourlyAmount = getHourlyAmount(slot);
        const amount = NumbersHelper.multiply(hourlyAmount, CompaniDuration(duration).asHours());

        return {
          traineeName,
          startDate: CompaniDate(slot.startDate).toISO(),
          endDate: CompaniDate(slot.endDate).toISO(),
          duration,
          isAbsence: slot.attendances[0].status === MISSING,
          status: slot.status,
          amount,
        };
      });
    });

    const allCollectiveSlots = Object.values(formattedCollectiveSlots)
      .flat()
      .filter((slot, index, all) => index === all
        .findIndex(s => CompaniDate(s.startDate).isSame(slot.startDate) && CompaniDate(s.endDate).isSame(slot.endDate))
      );
    const {
      paidSlotsDuration: paidCollectiveSlotsDuration,
      paidSlotsAbsenceDuration: paidCollectiveSlotsAbsenceDuration,
      notPaidSlotsDuration: notPaidCollectiveSlotsDuration,
      notPaidSlotsAbsenceDuration: notPaidCollectiveSlotsAbsenceDuration,
    } = getSlotsDuration(allCollectiveSlots);

    formattedSlotsGroupByTrainer[trainer._id] = {
      identity: trainer.identity,
      courses: trainerCourses,
      collectiveSlots: {
        slots: formattedCollectiveSlots,
        globalInfos: {
          paidCollectiveSlotsDuration: CompaniDuration(paidCollectiveSlotsDuration).toISO(),
          paidCollectiveSlotsAbsenceDuration: CompaniDuration(paidCollectiveSlotsAbsenceDuration).toISO(),
          notPaidCollectiveSlotsDuration: CompaniDuration(notPaidCollectiveSlotsDuration).toISO(),
          notPaidCollectiveSlotsAbsenceDuration: CompaniDuration(notPaidCollectiveSlotsAbsenceDuration).toISO(),
        },
      },
      totalPaidSlotsDuration: totalPaidSingleSlotsDuration.add(paidCollectiveSlotsDuration).toISO(),
      totalPaidSlotsAbsenceDuration: totalPaidSingleSlotsAbsenceDuration
        .add(paidCollectiveSlotsAbsenceDuration)
        .toISO(),
      totalNotPaidSlotsDuration: totalNotPaidSingleSlotsDuration.add(notPaidCollectiveSlotsDuration).toISO(),
      totalNotPaidSlotsAbsenceDuration: totalNotPaidSingleSlotsAbsenceDuration
        .add(notPaidCollectiveSlotsAbsenceDuration)
        .toISO(),
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
        const slotData = pick({ ...courseSlot, ...payload }, ['course', 'step', 'address', 'meetingLink', 'trainees']);
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
