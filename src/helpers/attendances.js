const get = require('lodash/get');
const pick = require('lodash/pick');
const groupBy = require('lodash/groupBy');
const mapValues = require('lodash/mapValues');
const keyBy = require('lodash/keyBy');
const Attendance = require('../models/Attendance');
const Course = require('../models/Course');
const UtilsHelper = require('./utils');
const CourseSlot = require('../models/CourseSlot');
const User = require('../models/User');
const { BLENDED, VENDOR_ROLES, COURSE, TRAINEE, PRESENT } = require('./constants');
const CourseHistoriesHelper = require('./courseHistories');

const createSingleAttendance = async (payload, courseTrainees, traineeId, traineesCompanyForAttendance) => {
  if (UtilsHelper.doesArrayIncludeId(courseTrainees, traineeId)) {
    return Attendance.create({ ...payload, company: traineesCompanyForAttendance[traineeId] });
  }

  const unsubscribedTraineeUserCompany = await User
    .findOne({ _id: traineeId }, { company: 1 })
    .populate({ path: 'company' })
    .lean();

  return Attendance.create({ ...payload, company: unsubscribedTraineeUserCompany.company });
};

const createManyAttendances = async (courseTrainees, courseSlotId, credentials, traineesCompanyForAttendance) => {
  const existingAttendances = await Attendance
    .find({ courseSlot: courseSlotId, trainee: { $in: courseTrainees } })
    .setOptions({ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) })
    .lean();

  const traineesWithAttendance = existingAttendances.map(a => a.trainee);
  const traineesWithoutAttendances = courseTrainees
    .filter(tId => !UtilsHelper.doesArrayIncludeId(traineesWithAttendance, tId));

  const newAttendances = traineesWithoutAttendances
    .map(tId => ({ courseSlot: courseSlotId, trainee: tId, company: traineesCompanyForAttendance[tId] }));

  await Attendance.updateMany({ _id: { $in: existingAttendances.map(a => a._id) } }, { $set: { status: PRESENT } });

  return Attendance.insertMany(newAttendances);
};

exports.create = async (payload, credentials) => {
  const { courseSlot: courseSlotId, trainee: traineeId } = payload;

  const courseSlot = await CourseSlot.findById(courseSlotId, { course: 1 })
    .populate({ path: 'course', select: 'type trainees companies' })
    .lean();

  const { course } = courseSlot;
  const traineeList = traineeId ? [traineeId] : course.trainees;
  const traineesCompanyListForAttendance = await CourseHistoriesHelper
    .getCompanyAtCourseRegistrationList({ key: COURSE, value: course._id }, { key: TRAINEE, value: traineeList });

  const traineesCompanyForAttendance = mapValues(keyBy(traineesCompanyListForAttendance, 'trainee'), 'company');

  if (traineeId) return createSingleAttendance(payload, course.trainees, traineeId, traineesCompanyForAttendance);

  return createManyAttendances(course.trainees, courseSlotId, credentials, traineesCompanyForAttendance);
};

exports.list = async (courseSlotsIds, credentials) => {
  const loggedUserCompanies = get(credentials, 'role.holding')
    ? credentials.holding.companies
    : [get(credentials, 'company._id')];
  const loggedUserHasVendorRole = get(credentials, 'role.vendor');
  const companies = !loggedUserHasVendorRole ? loggedUserCompanies : null;

  return Attendance
    .find({ courseSlot: { $in: courseSlotsIds }, ...(companies && { company: { $in: companies } }) })
    .setOptions({ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) })
    .lean();
};

const formatAttendances = (course, specificCourseTrainees) =>
  course.slots.map((slot) => {
    const { attendances } = slot;
    if (!attendances) return {};

    return attendances
      .filter(a => UtilsHelper.doesArrayIncludeId(specificCourseTrainees, a.trainee._id) &&
          !UtilsHelper.doesArrayIncludeId(course.trainees, a.trainee._id))
      .map(a => ({
        trainee: a.trainee,
        courseSlot: pick(slot, ['step', 'startDate', 'endDate']),
        misc: course.misc,
        trainers: course.trainers,
      }));
  });

exports.listUnsubscribed = async (query, credentials) => {
  const courseId = query.course;
  const companies = [];
  if (query.company) companies.push(query.company);
  if (query.holding) companies.push(...credentials.holding.companies);

  const course = await Course.findOne({ _id: courseId })
    .populate({ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'subPrograms' } })
    .lean();

  const coursesWithSameProgram = await Course
    .find({ format: BLENDED, subProgram: { $in: get(course, 'subProgram.program.subPrograms') } })
    .populate({
      path: 'slots',
      select: 'attendances startDate endDate',
      populate: {
        path: 'attendances',
        ...(companies.length && { match: { company: { $in: companies } } }),
        select: 'trainee company',
        populate: { path: 'trainee', select: 'identity' },
        options: { isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) },
      },
    })
    .populate({ path: 'trainers', select: 'identity' })
    .lean();

  const unsubscribedAttendances = coursesWithSameProgram.map(c => formatAttendances(c, course.trainees));

  return groupBy(unsubscribedAttendances.flat(3), 'trainee._id');
};

exports.getTraineeUnsubscribedAttendances = async (traineeId, credentials) => {
  const trainee = await User.findOne({ _id: traineeId }, { company: 1 }).populate({ path: 'company' }).lean();

  const attendances = await Attendance
    .find({ trainee: traineeId, company: trainee.company })
    .populate({
      path: 'courseSlot',
      select: 'course startDate endDate',
      populate: [
        {
          path: 'course',
          match: { trainees: { $ne: traineeId } },
          select: 'trainers misc subProgram',
          populate: [
            { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
            { path: 'trainers', select: 'identity' },
          ],
        },
      ],
    })
    .setOptions({ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) })
    .lean();

  const unsubscribedAttendances = attendances
    .filter(a => a.courseSlot.course)
    .map(a => ({
      courseSlot: pick(a.courseSlot, ['startDate', 'endDate']),
      course: {
        misc: get(a, 'courseSlot.course.misc'),
        trainers: get(a, 'courseSlot.course.trainers').map(t => ({ _id: t._id, identity: t.identity })),
      },
      program: pick(a.courseSlot.course.subProgram.program, ['_id', 'name']),
    }));

  return groupBy(unsubscribedAttendances, 'program._id');
};

exports.delete = async (query) => {
  const { courseSlot: courseSlotId, trainee: traineeId } = query;
  if (traineeId) return Attendance.deleteOne(query);

  const courseSlot = await CourseSlot.findById(courseSlotId, { course: 1 })
    .populate({ path: 'course', select: 'trainees' })
    .lean();
  const { course } = courseSlot;

  return Attendance.deleteMany({ courseSlot: courseSlotId, trainee: { $in: course.trainees } });
};
