const Boom = require('@hapi/boom');
const get = require('lodash/get');
const has = require('lodash/has');
const compact = require('lodash/compact');
const isEqual = require('lodash/isEqual');
const groupBy = require('lodash/groupBy');
const keyBy = require('lodash/keyBy');
const CourseSlot = require('../../models/CourseSlot');
const Course = require('../../models/Course');
const CompletionCertificate = require('../../models/CompletionCertificate');
const Step = require('../../models/Step');
const Attendance = require('../../models/Attendance');
const AttendanceSheet = require('../../models/AttendanceSheet');
const CourseHistory = require('../../models/CourseHistory');
const User = require('../../models/User');
const Geocode = require('../../models/Geocode');
const translate = require('../../helpers/translate');
const { checkAuthorization } = require('./courses');
const {
  E_LEARNING,
  ON_SITE,
  REMOTE,
  INTRA,
  INTRA_HOLDING,
  MM_YYYY,
  TRAINER,
  SINGLE,
  TRAINER_DELETION,
} = require('../../helpers/constants');
const UtilsHelper = require('../../helpers/utils');
const { CompaniDate } = require('../../helpers/dates/companiDates');
const { EMAIL_VALIDATION } = require('../../models/utils');

const { language } = translate;

exports.authorizeCreate = async (req) => {
  try {
    const { course: courseId, step: stepId } = req.payload;

    const course = await Course.findById(courseId, { subProgram: 1, archivedAt: 1, trainers: 1 })
      .populate({ path: 'subProgram', select: 'steps' })
      .lean();
    if (!course) throw Boom.notFound();
    if (course.archivedAt) throw Boom.forbidden();

    const { credentials } = req.auth;
    const isTrainer = get(credentials, 'role.vendor.name') === TRAINER;
    if (isTrainer && !UtilsHelper.doesArrayIncludeId(course.trainers, credentials._id)) throw Boom.forbidden();

    const isStepElearning = await Step.countDocuments({ _id: stepId, type: E_LEARNING }).lean();

    if (isStepElearning || !UtilsHelper.doesArrayIncludeId(course.subProgram.steps, stepId)) throw Boom.badRequest();

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const hasConflicts = async (slot) => {
  const query = {
    course: slot.course,
    startDate: { $lt: slot.endDate },
    endDate: { $gt: slot.startDate },
  };
  if (slot._id) query._id = { $ne: slot._id };
  const slotsInConflict = await CourseSlot.countDocuments(query);

  return !!slotsInConflict;
};

const checkPayload = async (courseSlot, payload) => {
  const {
    course: courseId,
    step,
    trainers: initialTrainers,
    startDate: initialStartDate,
    endDate: initialEndDate,
  } = courseSlot;
  const { startDate, endDate, trainers } = payload;
  const hasBothDates = !!(startDate && endDate);
  const hasOneDate = !!(startDate || endDate);

  const attendanceSheets = await AttendanceSheet.countDocuments({ 'slots.slotId': courseSlot._id });
  if (attendanceSheets) throw Boom.forbidden(translate[language].courseSlotWithAttendances);

  const slotMonth = courseSlot.startDate ? CompaniDate(courseSlot.startDate).format(MM_YYYY) : '';
  const payloadMonth = startDate ? CompaniDate(startDate).format(MM_YYYY) : '';
  const slotsMonths = compact([slotMonth, payloadMonth]);
  const completionCertificates = await CompletionCertificate.countDocuments({
    course: courseId,
    month: { $in: slotsMonths },
    file: { $exists: true },
  });
  if (completionCertificates) throw Boom.forbidden(translate[language].courseSlotDateInCompletionCertificate);

  const course = await Course.findById(courseId, { subProgram: 1, trainees: 1 })
    .populate({ path: 'subProgram', select: 'steps' })
    .lean();

  const editTrainers = (trainers || []).length > 0 && (
    !trainers.every(t => UtilsHelper.doesArrayIncludeId(initialTrainers, t)) ||
    !initialTrainers.every(t => UtilsHelper.doesArrayIncludeId(trainers, t))
  );
  const editStartDate = startDate && (!initialStartDate || !CompaniDate(startDate).isSame(initialStartDate));
  const editEndDate = endDate && (!initialEndDate || !CompaniDate(endDate).isSame(initialEndDate));
  const editDates = editStartDate || editEndDate;

  if (editTrainers || editDates || !hasOneDate) {
    const query = { courseSlot: courseSlot._id };
    if (payload.trainees) {
      query.trainee = { $in: course.trainees.filter(t => !UtilsHelper.doesArrayIncludeId(payload.trainees, t)) };
    }
    const attendances = await Attendance.countDocuments(query);
    if (attendances) throw Boom.forbidden(translate[language].courseSlotWithAttendances);
  }

  if (hasOneDate) {
    if (!hasBothDates) throw Boom.badRequest();
    const sameDay = CompaniDate(startDate).isSame(endDate, 'day');
    const startDateBeforeEndDate = CompaniDate(startDate).isSameOrBefore(endDate);
    if (!(sameDay && startDateBeforeEndDate)) throw Boom.badRequest();

    const slotHasConflicts = await hasConflicts({ ...courseSlot, ...payload });
    if (slotHasConflicts) throw Boom.conflict(translate[language].courseSlotConflict);
    if (payload.wholeDay) {
      const startHour = CompaniDate(startDate).getUnits(['hour', 'minute']);
      const endHour = CompaniDate(endDate).getUnits(['hour', 'minute']);
      if (startHour.hour !== 9 || startHour.minute !== 0 || endHour.hour !== 12 || endHour.minute !== 30) {
        throw Boom.badRequest();
      }

      const afternonStartDate = CompaniDate(payload.startDate).set({ hour: 13, minute: 30 }).toISO();
      const afternoonEndDate = CompaniDate(payload.endDate).set({ hour: 17, minute: 0 }).toISO();
      const hasConflictsOnAfternoon = await hasConflicts(
        { _id: courseSlot._id, startDate: afternonStartDate, endDate: afternoonEndDate, course: courseSlot.course }
      );
      if (hasConflictsOnAfternoon) throw Boom.conflict(translate[language].courseSlotWholeDayConflict);
    }
  }

  if (step.type === E_LEARNING) throw Boom.badRequest();
  if (!UtilsHelper.doesArrayIncludeId(course.subProgram.steps, step._id)) throw Boom.badRequest();
  if ((payload.address && step.type !== ON_SITE) || (payload.meetingLink && step.type !== REMOTE)) {
    throw Boom.badRequest();
  }
};

exports.authorizeUpdate = async (req) => {
  try {
    const { credentials } = req.auth;
    const courseSlot = await CourseSlot
      .findOne({ _id: req.params._id }, { course: 1, step: 1, startDate: 1, endDate: 1, trainers: 1 })
      .populate({ path: 'step', select: 'type' })
      .lean();
    if (!courseSlot) throw Boom.notFound(translate[language].courseSlotNotFound);

    const courseId = get(courseSlot, 'course') || '';
    const course = await Course
      .findOne({ _id: courseId }, { archivedAt: 1, trainees: 1, trainers: 1, type: 1, companies: 1, holding: 1 })
      .lean();
    if (course.archivedAt) throw Boom.forbidden();
    if (has(req.payload, 'trainees')) {
      const userVendorRole = get(req.auth, 'credentials.role.vendor.name');
      if (!userVendorRole || course.type === SINGLE) throw Boom.forbidden();
      if (!req.payload.trainees.some(t => UtilsHelper.doesArrayIncludeId(course.trainees, t))) throw Boom.notFound();
    } else {
      const courseCompanies = [INTRA, INTRA_HOLDING].includes(course.type) ? course.companies : [];
      const courseHolding = course.type === INTRA_HOLDING ? course.holding : null;
      const courseTrainerIds = get(course, 'trainers', []);
      checkAuthorization(credentials, courseTrainerIds, courseCompanies, courseHolding);

      if (has(req.payload, 'trainers')) {
        const { trainers } = req.payload;
        const userVendorRole = get(credentials, 'role.vendor.name');
        if (!userVendorRole) throw Boom.forbidden();

        const courseHistories = await CourseHistory.find({ course: courseId, action: TRAINER_DELETION }).lean();
        const trainerIds = [...courseTrainerIds, ...courseHistories.map(cH => cH.trainer)];

        const everyTrainerIsOrWasInCourse = trainers.every(t => UtilsHelper.doesArrayIncludeId(trainerIds, t));
        if (!everyTrainerIsOrWasInCourse) throw Boom.notFound();

        const isTrainer = userVendorRole === TRAINER;
        if (isTrainer && !UtilsHelper.doesArrayIncludeId(trainers, credentials._id)) throw Boom.forbidden();
      }
    }
    await checkPayload(courseSlot, req.payload);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeDeletion = async (req) => {
  try {
    const courseSlot = await CourseSlot
      .findOne({ _id: req.params._id }, { course: 1, step: 1 })
      .populate({ path: 'step', select: '_id type' })
      .lean();
    if (!courseSlot) throw Boom.notFound(translate[language].courseSlotNotFound);

    const course = await Course.findOne({ _id: courseSlot.course }, { archivedAt: 1, trainers: 1 }).lean();
    if (course.archivedAt) throw Boom.forbidden();

    const { credentials } = req.auth;
    const isTrainer = get(credentials, 'role.vendor.name') === TRAINER;
    if (isTrainer && !UtilsHelper.doesArrayIncludeId(course.trainers, credentials._id)) throw Boom.forbidden();

    const courseStepHasOtherSlots = await CourseSlot.countDocuments(
      { _id: { $nin: [courseSlot._id] }, course: courseSlot.course, step: courseSlot.step._id },
      { limit: 1 }
    );
    if (!courseStepHasOtherSlots) throw Boom.forbidden();

    const attendanceExists = await Attendance.countDocuments({ courseSlot: courseSlot._id });
    if (attendanceExists) throw Boom.conflict(translate[language].attendanceExists);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const extractEmails = value => [...new Set(
  (value || '').split('/').map(email => email.trim().toLowerCase()).filter(Boolean)
)];

exports.authorizeUploadCourseSlotsCSV = async (req) => {
  try {
    const { credentials } = req.auth;
    const { course: courseId, file } = req.payload;

    const course = await Course
      .findOne({ _id: courseId }, { trainers: 1, trainees: 1, archivedAt: 1, companies: 1, holding: 1, type: 1 })
      .populate({ path: 'subProgram', select: 'steps', populate: { path: 'steps', select: 'name type' } })
      .lean();
    if (!course) throw Boom.notFound();
    if (course.archivedAt) throw Boom.forbidden();

    const courseCompanies = [INTRA, INTRA_HOLDING].includes(course.type) ? course.companies : [];
    const courseHolding = course.type === INTRA_HOLDING ? course.holding : null;
    checkAuthorization(credentials, course.trainers, courseCompanies, courseHolding);

    const slotList = await UtilsHelper.parseCsv(file);

    if (slotList.length > process.env.MAX_CSV_COURSE_SIZE) throw Boom.forbidden(translate[language].fileIsToBig);

    const allowedKeys = ['step', 'startDate', 'endDate', 'address', 'meetingLink', 'trainers', 'trainees'].sort();
    if (!slotList.length || !isEqual(Object.keys(slotList[0]).sort(), allowedKeys)) {
      throw Boom.badRequest(translate[language].wrongColumnsInCsv);
    }

    const steps = get(course, 'subProgram.steps', []);
    const stepsByName = keyBy(steps, s => s.name.trim().toLowerCase());

    const existingSlots = await CourseSlot.find({ course: courseId }, { step: 1, startDate: 1, endDate: 1 }).lean();
    const slotsToPlanByStep = groupBy(existingSlots.filter(s => !s.startDate), 'step');
    const conflictIntervals = existingSlots
      .filter(s => s.startDate)
      .map(s => ({ startDate: s.startDate, endDate: s.endDate }));

    const allEmails = [...new Set(slotList.flatMap(
      row => [...extractEmails(row.trainers), ...extractEmails(row.trainees)]
    ))];
    const users = await User.find({ 'local.email': { $in: allEmails } }, { _id: 1, local: 1 }).lean();
    const userByEmail = keyBy(users, u => u.local.email);

    const stepForSlot = slot => stepsByName[(slot.step || '').trim().toLowerCase()] || null;
    const addressesToGeocode = [...new Set(slotList
      .filter(slot => slot.address && !slot.meetingLink && get(stepForSlot(slot), 'type') === ON_SITE)
      .map(slot => slot.address))];
    const geocodeResponses = await Promise.all(
      addressesToGeocode.map(address => Geocode.search(address).catch(() => null))
    );
    const geocodeByAddress = keyBy(
      addressesToGeocode.map((address, index) => ({ address, data: get(geocodeResponses[index], 'data') })),
      'address'
    );

    const errorsBySlot = {};
    const addError = (rowLabel, message) => {
      if (errorsBySlot[rowLabel]) errorsBySlot[rowLabel].push(message);
      else errorsBySlot[rowLabel] = [message];
    };
    const formattedSlotList = [];

    let i = 1;
    for (const slot of slotList) {
      const rowLabel = `Créneau ${i}`;

      let step = stepsByName[(slot.step || '').trim().toLowerCase()] || null;
      if (!step) {
        addError(rowLabel, translate[language].unknownStep);
      } else if (step.type === E_LEARNING) {
        addError(rowLabel, translate[language].courseSlotElearningStepCsv);
        step = null;
      }

      let formattedStartDate = null;
      let formattedEndDate = null;
      const startDate = slot.startDate ? new Date(slot.startDate) : null;
      const endDate = slot.endDate ? new Date(slot.endDate) : null;
      const isStartDateValid = startDate && !Number.isNaN(startDate.getTime());
      const isEndDateValid = endDate && !Number.isNaN(endDate.getTime());
      if (!isStartDateValid || !isEndDateValid) {
        addError(rowLabel, translate[language].incorrectDate);
      } else {
        formattedStartDate = CompaniDate(startDate).toISO();
        formattedEndDate = CompaniDate(endDate).toISO();
        if (!CompaniDate(formattedStartDate).isSame(formattedEndDate, 'day')) {
          addError(rowLabel, translate[language].courseSlotDatesNotSameDay);
        }
        if (!CompaniDate(formattedStartDate).isSameOrBefore(formattedEndDate)) {
          addError(rowLabel, translate[language].courseSlotStartAfterEndCsv);
        }
      }

      let address = null;
      const meetingLink = slot.meetingLink || null;
      if (slot.address && meetingLink) {
        addError(rowLabel, translate[language].addressAndMeetingLinkBothSet);
      } else {
        if (step) {
          if (slot.address && step.type !== ON_SITE) {
            addError(rowLabel, translate[language].addressNotAllowedForStepType);
          }
          if (meetingLink && step.type !== REMOTE) {
            addError(rowLabel, translate[language].meetingLinkNotAllowedForStepType);
          }
        }
        if (slot.address && get(step, 'type') === ON_SITE) {
          const { data } = geocodeByAddress[slot.address];
          const [best] = [...(get(data, 'features') || [])].sort((a, b) => b.properties.score - a.properties.score);
          if (!best) addError(rowLabel, translate[language].unknownAddress);
          else {
            address = {
              fullAddress: best.properties.label,
              street: best.properties.name,
              zipCode: best.properties.postcode,
              city: best.properties.city,
              location: best.geometry,
            };
          }
        }
      }

      const trainerEmails = extractEmails(slot.trainers);
      const trainerIds = [];
      if (!trainerEmails.length) addError(rowLabel, translate[language].missingTrainersCsv);
      trainerEmails.forEach((email) => {
        if (!email.match(EMAIL_VALIDATION)) {
          addError(rowLabel, translate[language].incorrectTrainerEmail);
          return;
        }
        const user = userByEmail[email];
        if (!user) {
          addError(rowLabel, translate[language].unknownTrainer);
          return;
        }
        if (!UtilsHelper.doesArrayIncludeId(course.trainers, user._id)) {
          addError(rowLabel, translate[language].trainerNotInCourse);
          return;
        }
        trainerIds.push(user._id);
      });

      const traineeEmails = extractEmails(slot.trainees);
      const traineeIds = [];
      traineeEmails.forEach((email) => {
        if (!email.match(EMAIL_VALIDATION)) {
          addError(rowLabel, translate[language].incorrectTraineeEmail);
          return;
        }
        const user = userByEmail[email];
        if (!user) {
          addError(rowLabel, translate[language].unknownTraineeCsv);
          return;
        }
        if (!UtilsHelper.doesArrayIncludeId(course.trainees, user._id)) {
          addError(rowLabel, translate[language].traineeNotInCourse);
          return;
        }
        traineeIds.push(user._id);
      });

      let candidateInterval = null;
      if (step && formattedStartDate && formattedEndDate) {
        candidateInterval = { startDate: formattedStartDate, endDate: formattedEndDate };
        const isInConflict = conflictIntervals.some(interval =>
          CompaniDate(candidateInterval.startDate).isBefore(interval.endDate) &&
          CompaniDate(candidateInterval.endDate).isAfter(interval.startDate)
        );
        if (isInConflict) addError(rowLabel, translate[language].courseSlotConflict);
      }

      if (!errorsBySlot[rowLabel]) {
        if (candidateInterval) conflictIntervals.push(candidateInterval);

        const queue = slotsToPlanByStep[step._id] || [];
        const reuseSlot = queue.shift();

        formattedSlotList.push({
          stepId: step._id,
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          ...(address && { address }),
          ...(meetingLink && { meetingLink }),
          trainers: trainerIds,
          ...(traineeIds.length && { trainees: traineeIds }),
          ...(reuseSlot && { slotId: reuseSlot._id }),
        });
      }
      i += 1;
    }

    if (Object.keys(errorsBySlot).length) {
      const error = Boom.badData();
      error.output.payload.errorsBySlot = errorsBySlot;
      throw error;
    }

    return formattedSlotList;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeCourseSlotListGet = async (req) => {
  try {
    const { credentials } = req.auth;
    const vendorRole = get(credentials, 'role.vendor');
    const loggedUserIsTrainer = get(vendorRole, 'name') === TRAINER;
    if (loggedUserIsTrainer) {
      if (!req.query.trainerId) throw Boom.badRequest();

      const loggedUserId = get(credentials, '_id');
      if (!UtilsHelper.areObjectIdsEquals(loggedUserId, req.query.trainerId)) throw Boom.forbidden();
    } else if (req.query.trainerId) {
      const trainerExists = await User.countDocuments({ _id: req.query.trainerId, 'role.vendor': { $exists: true } });
      if (!trainerExists) throw Boom.notFound();
    }

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};
