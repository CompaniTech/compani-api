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
const { ON_SITE, REMOTE, DD_MM_YYYY, SINGLE, DAY, MINUTE, MISSING, NOT_PAID, PAID } = require('./constants');
const DatesUtilsHelper = require('./dates/utils');
const UtilsHelper = require('./utils');
const NumbersHelper = require('./numbers');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');

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

const formatSingleTraineeSlots = (singleTraineeSlots, trainerId) => {
  const singleTraineeSlotsGroupByStep = groupBy(singleTraineeSlots, slot => slot.step._id);

  const formattedSingleTraineeSlots = {};
  let paidDuration = CompaniDuration('PT0S');
  let paidAbsenceDuration = CompaniDuration('PT0S');
  let notPaidDuration = CompaniDuration('PT0S');
  let notPaidAbsenceDuration = CompaniDuration('PT0S');

  Object.values(singleTraineeSlotsGroupByStep).forEach((slots) => {
    const { step } = slots[0];

    let stepToPayDuration = CompaniDuration('PT0S');
    let stepPaidDuration = CompaniDuration('PT0S');
    let stepToPayAmount = 0;
    let stepPaidAmount = 0;

    const stepSlots = slots.map((slot) => {
      const duration = CompaniDate(slot.endDate).diff(slot.startDate, MINUTE);
      const durationObj = CompaniDuration(duration);
      const hourlyAmount = getHourlyAmount(slot);
      const amount = NumbersHelper.multiply(hourlyAmount, durationObj.asHours());
      const isAbsence = slot.attendances[0].status === MISSING;
      const trainerBill = (slot.trainerBills || [])
        .find(bill => UtilsHelper.areObjectIdsEquals(bill.trainer, trainerId));
      const slotStatus = trainerBill ? PAID : NOT_PAID;

      if (slotStatus === NOT_PAID) {
        stepToPayDuration = stepToPayDuration.add(durationObj);
        stepToPayAmount = NumbersHelper.add(stepToPayAmount, amount);
        notPaidDuration = notPaidDuration.add(durationObj);
        if (isAbsence) notPaidAbsenceDuration = notPaidAbsenceDuration.add(durationObj);
      } else {
        stepPaidDuration = stepPaidDuration.add(durationObj);
        stepPaidAmount = NumbersHelper.add(stepPaidAmount, amount);
        paidDuration = paidDuration.add(durationObj);
        if (isAbsence) paidAbsenceDuration = paidAbsenceDuration.add(durationObj);
      }

      return {
        _id: slot._id,
        startDate: CompaniDate(slot.startDate).toISO(),
        endDate: CompaniDate(slot.endDate).toISO(),
        duration,
        isAbsence,
        status: slotStatus,
        amount,
        ...(trainerBill && trainerBill.billNumber && { trainerBillNumber: trainerBill.billNumber }),
      };
    });

    formattedSingleTraineeSlots[step.name] = {
      slots: stepSlots,
      toPayDuration: stepToPayDuration.toISO(),
      paidDuration: stepPaidDuration.toISO(),
      toPayAmount: stepToPayAmount,
      paidAmount: stepPaidAmount,
    };
  });

  return {
    slots: formattedSingleTraineeSlots,
    totals: {
      paidSingleSlotsDuration: paidDuration,
      paidSingleSlotsAbsenceDuration: paidAbsenceDuration,
      notPaidSingleSlotsDuration: notPaidDuration,
      notPaidSingleSlotsAbsenceDuration: notPaidAbsenceDuration,
    },
  };
};

const formatCollectiveSlots = (collectiveSlots, trainerId) => {
  const slotsGroupByDay = groupBy(collectiveSlots, slot => CompaniDate(slot.startDate).startOf(DAY).format(DD_MM_YYYY));

  const formattedCollectiveSlots = {};

  let totalPaidDuration = CompaniDuration('PT0S');
  let totalPaidAbsenceDuration = CompaniDuration('PT0S');
  let totalNotPaidDuration = CompaniDuration('PT0S');
  let totalNotPaidAbsenceDuration = CompaniDuration('PT0S');

  Object.entries(slotsGroupByDay).forEach(([day, slots]) => {
    const daySlots = [];
    const slotsByDates = {};

    slots.forEach((slot) => {
      const duration = CompaniDate(slot.endDate).diff(slot.startDate, MINUTE);
      const durationObj = CompaniDuration(duration);
      const hourlyAmount = getHourlyAmount(slot);
      const amount = NumbersHelper.multiply(hourlyAmount, durationObj.asHours());
      const isAbsence = slot.attendances[0].status === MISSING;

      const startISO = CompaniDate(slot.startDate).toISO();
      const endISO = CompaniDate(slot.endDate).toISO();
      const dates = `${startISO}_${endISO}`;

      const trainerBill = (slot.trainerBills || [])
        .find(bill => UtilsHelper.areObjectIdsEquals(bill.trainer, trainerId));
      const slotStatus = trainerBill ? PAID : NOT_PAID;

      daySlots.push({
        _id: slot._id,
        courseId: slot.course._id,
        traineeName: UtilsHelper.formatIdentity(slot.course.trainees[0].identity, 'FL'),
        startDate: startISO,
        endDate: endISO,
        duration,
        isAbsence,
        status: slotStatus,
        amount,
        stepName: slot.step.name,
        ...(trainerBill && trainerBill.billNumber && { trainerBillNumber: trainerBill.billNumber }),
      });

      if (!slotsByDates[dates]) {
        slotsByDates[dates] = {
          durationObj,
          amount,
          status: slotStatus,
          allAbsent: isAbsence,
        };
      } else {
        slotsByDates[dates].allAbsent = slotsByDates[dates].allAbsent && isAbsence;
      }
    });

    let dayToPayDuration = CompaniDuration('PT0S');
    let dayPaidDuration = CompaniDuration('PT0S');
    let dayToPayAmount = 0;
    let dayPaidAmount = 0;

    Object.values(slotsByDates).forEach(({ durationObj, amount, status, allAbsent }) => {
      if (status === NOT_PAID) {
        dayToPayDuration = dayToPayDuration.add(durationObj);
        dayToPayAmount = NumbersHelper.add(dayToPayAmount, amount);
        totalNotPaidDuration = totalNotPaidDuration.add(durationObj);
        if (allAbsent) totalNotPaidAbsenceDuration = totalNotPaidAbsenceDuration.add(durationObj);
      } else {
        dayPaidDuration = dayPaidDuration.add(durationObj);
        dayPaidAmount = NumbersHelper.add(dayPaidAmount, amount);
        totalPaidDuration = totalPaidDuration.add(durationObj);
        if (allAbsent) totalPaidAbsenceDuration = totalPaidAbsenceDuration.add(durationObj);
      }
    });

    formattedCollectiveSlots[day] = {
      slots: daySlots,
      toPayDuration: dayToPayDuration.toISO(),
      paidDuration: dayPaidDuration.toISO(),
      toPayAmount: dayToPayAmount,
      paidAmount: dayPaidAmount,
    };
  });

  return {
    slots: formattedCollectiveSlots,
    totals: {
      paidCollectiveSlotsDuration: totalPaidDuration,
      paidCollectiveSlotsAbsenceDuration: totalPaidAbsenceDuration,
      notPaidCollectiveSlotsDuration: totalNotPaidDuration,
      notPaidCollectiveSlotsAbsenceDuration: totalNotPaidAbsenceDuration,
    },
  };
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
    for (const courseId of Object.keys(slotsByCourse)) {
      const currentCourseSlots = slotsByCourse[courseId];
      const singleTraineeSlots = [];
      currentCourseSlots.forEach((slot) => {
        if (UtilsHelper.doesArrayIncludeId(collectiveStepIds, slot.step._id)) collectiveSlots.push(slot);
        else singleTraineeSlots.push(slot);
      });
      if (!singleTraineeSlots.length) continue;

      const {
        slots: formattedSingleSlots,
        totals: courseTotals,
      } = formatSingleTraineeSlots(singleTraineeSlots, trainer._id);

      trainerCourses.push({
        _id: courseId,
        name: CourseHelper.composeCourseName(currentCourseSlots[0].course),
        singleTraineeSlots: formattedSingleSlots,
        paidSingleSlotsDuration: courseTotals.paidSingleSlotsDuration.toISO(),
        paidSingleSlotsAbsenceDuration: courseTotals.paidSingleSlotsAbsenceDuration.toISO(),
        notPaidSingleSlotsDuration: courseTotals.notPaidSingleSlotsDuration.toISO(),
        notPaidSingleSlotsAbsenceDuration: courseTotals.notPaidSingleSlotsAbsenceDuration.toISO(),
      });

      totalPaidSingleSlotsDuration = totalPaidSingleSlotsDuration.add(courseTotals.paidSingleSlotsDuration);
      totalPaidSingleSlotsAbsenceDuration = totalPaidSingleSlotsAbsenceDuration
        .add(courseTotals.paidSingleSlotsAbsenceDuration);
      totalNotPaidSingleSlotsDuration = totalNotPaidSingleSlotsDuration.add(courseTotals.notPaidSingleSlotsDuration);
      totalNotPaidSingleSlotsAbsenceDuration = totalNotPaidSingleSlotsAbsenceDuration
        .add(courseTotals.notPaidSingleSlotsAbsenceDuration);
    }

    const { slots: formattedCollectiveSlots, totals } = formatCollectiveSlots(collectiveSlots, trainer._id);
    const {
      paidCollectiveSlotsDuration,
      paidCollectiveSlotsAbsenceDuration,
      notPaidCollectiveSlotsDuration,
      notPaidCollectiveSlotsAbsenceDuration,
    } = totals;

    formattedSlotsGroupByTrainer[trainer._id] = {
      identity: trainer.identity,
      courses: trainerCourses,
      collectiveSlots: {
        slots: formattedCollectiveSlots,
        totals: {
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

exports.updateSlotList = async payload => CourseSlot.updateMany(
  { _id: { $in: payload._ids } },
  { $push: { trainerBills: { trainer: payload.trainer, billNumber: payload.billNumber } } }
);
