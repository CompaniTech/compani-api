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
const {
  ON_SITE,
  REMOTE,
  DD_MM_YYYY,
  SINGLE,
  DAY,
  MINUTE,
  MISSING,
  NOT_INVOICED,
  INVOICED,
  PAID,
} = require('./constants');
const DatesUtilsHelper = require('./dates/utils');
const UtilsHelper = require('./utils');
const NumbersHelper = require('./numbers');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');

const filterPriceVersion = date => version => CompaniDate(version.effectiveDate).isSameOrBefore(date);

exports.getHourlyAmount = (slot) => {
  const matchingSubProgamPriceVersion = UtilsHelper.getMatchingVersion(
    slot.startDate,
    { ...omit(slot.course.subProgram, 'priceVersions'), versions: slot.course.subProgram.priceVersions || [] },
    'effectiveDate',
    filterPriceVersion
  );
  const price = matchingSubProgamPriceVersion?.prices
    .find(p => UtilsHelper.areObjectIdsEquals(p.step, slot.step._id));

  return price ? price.hourlyAmount : 0;
};

const SLOT_STATUS = [NOT_INVOICED, INVOICED, PAID];

const initStatusTotals = () => Object.fromEntries(
  SLOT_STATUS.map(status => [
    status,
    { duration: CompaniDuration('PT0S'), amount: 0, absenceDuration: CompaniDuration('PT0S') },
  ])
);

const addToStatusTotals = (totals, status, durationObj, amount, isAbsence) => ({
  ...totals,
  [status]: {
    duration: totals[status].duration.add(durationObj),
    amount: NumbersHelper.add(totals[status].amount, amount),
    absenceDuration: isAbsence ? totals[status].absenceDuration.add(durationObj) : totals[status].absenceDuration,
  },
});

exports.getSlotStatus = (slot, trainerId) => {
  const trainerBilling = (slot.trainerBillings || [])
    .find(billing => UtilsHelper.areObjectIdsEquals(billing.trainer, trainerId));
  if (!trainerBilling) return { status: NOT_INVOICED, trainerBilling: null };

  // A trainerBilling with no trainerBill is a slot paid before this billing system existed.
  return { status: trainerBilling.trainerBill ? trainerBilling.trainerBill.status : PAID, trainerBilling };
};

const formatSingleTraineeSlots = (singleTraineeSlots, trainerId) => {
  const singleTraineeSlotsGroupByStep = groupBy(singleTraineeSlots, slot => slot.step._id);

  const formattedSingleTraineeSlots = {};
  let courseTotals = initStatusTotals();

  Object.values(singleTraineeSlotsGroupByStep).forEach((slots) => {
    const { step } = slots[0];
    let stepTotals = initStatusTotals();

    const stepSlots = slots.map((slot) => {
      const duration = CompaniDate(slot.endDate).diff(slot.startDate, MINUTE);
      const durationObj = CompaniDuration(duration);
      const isAbsence = slot.attendances[0].status === MISSING;
      const amount = NumbersHelper.multiply(slot.hourlyAmount, durationObj.asHours());
      const { status: slotStatus, trainerBilling } = exports.getSlotStatus(slot, trainerId);

      stepTotals = addToStatusTotals(stepTotals, slotStatus, durationObj, amount, isAbsence);
      courseTotals = addToStatusTotals(courseTotals, slotStatus, durationObj, amount, isAbsence);

      return {
        _id: slot._id,
        startDate: CompaniDate(slot.startDate).toISO(),
        endDate: CompaniDate(slot.endDate).toISO(),
        duration,
        isAbsence,
        status: slotStatus,
        amount,
        tradeName: slot.course.tradeName,
        ...(trainerBilling && trainerBilling.trainerBill && {
          trainerBill: trainerBilling.trainerBill._id,
          trainerBillNumber: trainerBilling.trainerBill.number,
        }),
      };
    });

    formattedSingleTraineeSlots[step.name] = {
      slots: stepSlots,
      notInvoicedDuration: stepTotals[NOT_INVOICED].duration.toISO(),
      notInvoicedAmount: stepTotals[NOT_INVOICED].amount,
      invoicedDuration: stepTotals[INVOICED].duration.toISO(),
      invoicedAmount: stepTotals[INVOICED].amount,
      paidDuration: stepTotals[PAID].duration.toISO(),
      paidAmount: stepTotals[PAID].amount,
    };
  });

  return { slots: formattedSingleTraineeSlots, totals: courseTotals };
};

const formatCollectiveSlots = (collectiveSlots, trainerId) => {
  const slotsGroupByDay = groupBy(collectiveSlots, slot => CompaniDate(slot.startDate).startOf(DAY).format(DD_MM_YYYY));

  const formattedCollectiveSlots = {};
  let totals = initStatusTotals();

  Object.entries(slotsGroupByDay).forEach(([day, slots]) => {
    const daySlots = [];
    const slotsByDates = {};

    slots.forEach((slot) => {
      const duration = CompaniDate(slot.endDate).diff(slot.startDate, MINUTE);
      const durationObj = CompaniDuration(duration);
      const isAbsence = slot.attendances[0].status === MISSING;
      const startISO = CompaniDate(slot.startDate).toISO();
      const endISO = CompaniDate(slot.endDate).toISO();
      const dates = `${startISO}_${endISO}`;

      const { status: slotStatus, trainerBilling } = exports.getSlotStatus(slot, trainerId);

      if (!slotsByDates[dates]) {
        slotsByDates[dates] = {
          durationObj,
          hourlyAmount: slot.hourlyAmount,
          status: slotStatus,
          allAbsent: isAbsence,
          slotsDate: [],
        };
      } else {
        slotsByDates[dates].allAbsent = slotsByDates[dates].allAbsent && isAbsence;
      }

      slotsByDates[dates].slotsDate.push({
        _id: slot._id,
        courseId: slot.course._id,
        tradeName: slot.course.tradeName,
        traineeName: UtilsHelper.formatIdentity(slot.course.trainees[0].identity, 'FL'),
        startDate: startISO,
        endDate: endISO,
        duration,
        isAbsence,
        status: slotStatus,
        stepName: slot.step.name,
        ...(trainerBilling && trainerBilling.trainerBill && {
          trainerBill: trainerBilling.trainerBill._id,
          trainerBillNumber: trainerBilling.trainerBill.number,
        }),
      });
    });

    let dayTotals = initStatusTotals();

    Object.values(slotsByDates).forEach((slotsGroup) => {
      const { durationObj, hourlyAmount, status, allAbsent, slotsDate } = slotsGroup;

      const amount = NumbersHelper.multiply(hourlyAmount, durationObj.asHours());
      dayTotals = addToStatusTotals(dayTotals, status, durationObj, amount, allAbsent);
      totals = addToStatusTotals(totals, status, durationObj, amount, allAbsent);

      const formattedSlots = slotsDate.map(s => ({ ...s, amount }));
      daySlots.push(...formattedSlots);
    });

    formattedCollectiveSlots[day] = {
      slots: daySlots,
      notInvoicedDuration: dayTotals[NOT_INVOICED].duration.toISO(),
      notInvoicedAmount: dayTotals[NOT_INVOICED].amount,
      invoicedDuration: dayTotals[INVOICED].duration.toISO(),
      invoicedAmount: dayTotals[INVOICED].amount,
      paidDuration: dayTotals[PAID].duration.toISO(),
      paidAmount: dayTotals[PAID].amount,
    };
  });

  return { slots: formattedCollectiveSlots, totals };
};

const mergeStatusTotals = (target, source) => Object.fromEntries(
  SLOT_STATUS.map(status => [status, {
    duration: target[status].duration.add(source[status].duration),
    amount: NumbersHelper.add(target[status].amount, source[status].amount),
    absenceDuration: target[status].absenceDuration.add(source[status].absenceDuration),
  }])
);

exports.list = async (query) => {
  const singleCourses = await Course.find({ type: SINGLE }, { _id: 1 }).lean();
  const singleCourseIds = singleCourses.map(course => new ObjectId(course._id));
  const findQuery = {
    course: { $in: singleCourseIds },
    startDate: { $gte: query.startDate },
    endDate: { $lte: query.endDate },
    ...(query.trainerId && { trainers: query.trainerId }),
  };

  const courseSlots = await CourseSlot
    .find(findQuery)
    .populate({ path: 'step', select: '_id name' })
    .populate({ path: 'trainers', select: 'identity' })
    .populate({
      path: 'course',
      select: '_id misc subProgram trainees tradeName',
      populate: [
        { path: 'trainees', select: 'identity' },
        { path: 'subProgram', select: 'priceVersions' },
      ],
    })
    .populate({ path: 'attendances', select: 'status', options: { isVendorUser: true } })
    .populate({ path: 'trainerBillings.trainerBill', select: 'status number' })
    .lean();

  const filteredCourseSlots = courseSlots.reduce((acc, slot) => {
    if (!slot.attendances.length) return acc;

    const hourlyAmount = exports.getHourlyAmount(slot);
    if (hourlyAmount) acc.push({ ...slot, hourlyAmount });
    return acc;
  }, []);

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
    let trainerTotals = initStatusTotals();

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
        notInvoicedSingleSlotsDuration: courseTotals[NOT_INVOICED].duration.toISO(),
        notInvoicedSingleSlotsAmount: courseTotals[NOT_INVOICED].amount,
        notInvoicedSingleSlotsAbsenceDuration: courseTotals[NOT_INVOICED].absenceDuration.toISO(),
        invoicedSingleSlotsDuration: courseTotals[INVOICED].duration.toISO(),
        invoicedSingleSlotsAmount: courseTotals[INVOICED].amount,
        invoicedSingleSlotsAbsenceDuration: courseTotals[INVOICED].absenceDuration.toISO(),
        paidSingleSlotsDuration: courseTotals[PAID].duration.toISO(),
        paidSingleSlotsAmount: courseTotals[PAID].amount,
        paidSingleSlotsAbsenceDuration: courseTotals[PAID].absenceDuration.toISO(),
      });

      trainerTotals = mergeStatusTotals(trainerTotals, courseTotals);
    }

    const { slots: formattedCollectiveSlots, totals: collectiveTotals } = formatCollectiveSlots(
      collectiveSlots,
      trainer._id
    );

    trainerTotals = mergeStatusTotals(trainerTotals, collectiveTotals);

    formattedSlotsGroupByTrainer[trainer._id] = {
      identity: trainer.identity,
      courses: trainerCourses,
      collectiveSlots: {
        slots: formattedCollectiveSlots,
        totals: {
          notInvoicedCollectiveSlotsDuration: collectiveTotals[NOT_INVOICED].duration.toISO(),
          notInvoicedCollectiveSlotsAmount: collectiveTotals[NOT_INVOICED].amount,
          notInvoicedCollectiveSlotsAbsenceDuration: collectiveTotals[NOT_INVOICED].absenceDuration.toISO(),
          invoicedCollectiveSlotsDuration: collectiveTotals[INVOICED].duration.toISO(),
          invoicedCollectiveSlotsAmount: collectiveTotals[INVOICED].amount,
          invoicedCollectiveSlotsAbsenceDuration: collectiveTotals[INVOICED].absenceDuration.toISO(),
          paidCollectiveSlotsDuration: collectiveTotals[PAID].duration.toISO(),
          paidCollectiveSlotsAmount: collectiveTotals[PAID].amount,
          paidCollectiveSlotsAbsenceDuration: collectiveTotals[PAID].absenceDuration.toISO(),
        },
      },
      totalNotInvoicedSlotsDuration: trainerTotals[NOT_INVOICED].duration.toISO(),
      totalNotInvoicedSlotsAbsenceDuration: trainerTotals[NOT_INVOICED].absenceDuration.toISO(),
      totalNotInvoicedSlotsAmount: trainerTotals[NOT_INVOICED].amount,
      totalInvoicedSlotsDuration: trainerTotals[INVOICED].duration.toISO(),
      totalInvoicedSlotsAbsenceDuration: trainerTotals[INVOICED].absenceDuration.toISO(),
      totalInvoicedSlotsAmount: trainerTotals[INVOICED].amount,
      totalPaidSlotsDuration: trainerTotals[PAID].duration.toISO(),
      totalPaidSlotsAbsenceDuration: trainerTotals[PAID].absenceDuration.toISO(),
      totalPaidSlotsAmount: trainerTotals[PAID].amount,
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

exports.uploadCourseSlotsCSV = async (courseId, slotList, credentials) => {
  for (const slot of slotList) {
    let slotId;
    if (slot.slotId) slotId = slot.slotId;
    else {
      const createdSlot = await CourseSlot.create({ course: courseId, step: slot.stepId });
      slotId = createdSlot._id;
    }

    await exports.updateCourseSlot(
      slotId,
      pick(slot, ['startDate', 'endDate', 'address', 'meetingLink', 'trainers']),
      credentials
    );
    if (slot.trainees) await exports.updateCourseSlot(slotId, { trainees: slot.trainees }, credentials);
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
