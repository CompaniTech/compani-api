const groupBy = require('lodash/groupBy');
const get = require('lodash/get');
const pick = require('lodash/pick');
const Boom = require('@hapi/boom');
const { ObjectId } = require('mongodb');
const Course = require('../models/Course');
const Attendance = require('../models/Attendance');
const ActivityHistory = require('../models/ActivityHistory');
const CompletionCertificate = require('../models/CompletionCertificate');
const { MONTHLY, MM_YYYY, MONTH } = require('../helpers/constants');
const { CompaniDate } = require('../helpers/dates/companiDates');
const EmailHelper = require('../helpers/email');
const UtilsHelper = require('../helpers/utils');
const CoursesHelper = require('../helpers/courses');

const completionCertificateCreationJob = {
  async method(server) {
    try {
      const { month } = server.query;

      const courses = await Course
        .find({ archivedAt: { $exists: false }, certificateGenerationMode: MONTHLY })
        .populate({
          path: 'subProgram',
          select: 'steps subProgram',
          populate: [{ path: 'steps', select: 'activities' }, { path: 'program', select: 'subPrograms' }],
        })
        .populate({ path: 'slots', select: 'startDate endDate' })
        .lean();

      const startOfMonth = CompaniDate(month, MM_YYYY).startOf(MONTH).toISO();
      const endOfMonth = CompaniDate(month, MM_YYYY).endOf(MONTH).toISO();

      const courseSlots = courses
        .map((course) => {
          const filteredSlots = course.slots.filter(s => !!s.startDate && CompaniDate(s.endDate).isBefore(endOfMonth) &&
            CompaniDate(s.startDate).isAfter(startOfMonth));

          return filteredSlots.map(s => s._id);
        })
        .flat();

      const attendanceList = await Attendance.find({ courseSlot: { $in: courseSlots } })
        .populate({ path: 'courseSlot', select: 'startDate endDate course' })
        .setOptions({ isVendorUser: true })
        .lean();

      const attendancesByCourse = groupBy(attendanceList, 'courseSlot.course');
      const traineeCoursesWithAHOrAttendancesOnMonth = [];
      for (const course of courses) {
        const unsubscribedAttendances = await CoursesHelper.getUnsubscribedAttendances(
          {
            ...pick(course, ['_id', 'trainees', 'companies']),
            subPrograms: get(course, 'subProgram.program.subPrograms'),
          },
          true
        );

        const attendances = [...(attendancesByCourse[course._id] || []), ...unsubscribedAttendances];
        if (attendances.length) {
          const attendanceByTrainee = groupBy(attendances, 'trainee');
          for (const trainee of Object.keys(attendanceByTrainee)) {
            if (!UtilsHelper.doesArrayIncludeId(course.trainees, trainee)) continue;

            const payload = { course: course._id, trainee: new ObjectId(trainee), month };
            const hasCertificateForMonth = await CompletionCertificate.countDocuments(payload);

            if (hasCertificateForMonth) {
              server.log(`Un certificat existe déjà pour l'apprenant ${trainee} de la formation ${course._id}
                sur ${month}`);
              continue;
            }

            traineeCoursesWithAHOrAttendancesOnMonth.push(payload);
          }
        }

        const courseActivities = course.subProgram.steps.map(s => s.activities).flat();

        const traineesActivityHistories = await ActivityHistory.find({
          activity: { $in: courseActivities },
          user: course.trainees,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        }).lean();

        if (traineesActivityHistories.length) {
          const activityHistoryByTrainee = groupBy(traineesActivityHistories, 'user');

          for (const trainee of Object.keys(activityHistoryByTrainee)) {
            const payload = { course: course._id, trainee: new ObjectId(trainee), month };
            const hasCertificateForMonth = await CompletionCertificate.countDocuments(payload);

            if (hasCertificateForMonth) {
              server.log(`Un certificat existe déjà pour l'apprenant ${trainee} de la formation ${course._id}
                sur ${month}`);
              continue;
            }

            const certificateIsGonnaBeCreated = traineeCoursesWithAHOrAttendancesOnMonth.some(certificate =>
              Object.entries(payload).every(([key, value]) => {
                if (key === 'month') return certificate[key] === value;
                return UtilsHelper.areObjectIdsEquals(certificate[key], value);
              }));
            if (certificateIsGonnaBeCreated) continue;

            traineeCoursesWithAHOrAttendancesOnMonth.push(payload);
          }
        }
      }

      const certificateCreated = [];
      const errors = [];
      try {
        const res = await CompletionCertificate.insertMany(traineeCoursesWithAHOrAttendancesOnMonth);

        certificateCreated.push(...res);
      } catch (e) {
        const { writeErrors } = e;
        server.log('completionCertificateCreation', e);
        errors.push(...writeErrors.map(error => error.err.op));
      }

      await EmailHelper.completionCertificateCreationEmail(certificateCreated, errors, month);

      return { certificateCreated, errors };
    } catch (e) {
      server.log('completionCertificateCreation', e);
      return Boom.isBoom(e) ? e : Boom.badImplementation(e);
    }
  },
};

module.exports = { completionCertificateCreationJob };
