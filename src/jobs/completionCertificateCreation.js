const groupBy = require('lodash/groupBy');
const { Boom } = require('@hapi/boom');
const { ObjectId } = require('mongodb');
const Course = require('../models/Course');
const Attendance = require('../models/Attendance');
const ActivityHistory = require('../models/ActivityHistory');
const CompletionCertificate = require('../models/CompletionCertificate');
const { MONTHLY, MM_YYYY, MONTH } = require('../helpers/constants');
const { CompaniDate } = require('../helpers/dates/companiDates');
const EmailHelper = require('../helpers/email');

const completionCertificateCreationJob = {
  async method(server) {
    try {
      const { month } = server.query;

      const courses = await Course
        .find({ archivedAt: { $exists: false }, certificateGenerationMode: MONTHLY })
        .populate({
          path: 'subProgram',
          select: 'steps',
          populate: [{ path: 'steps', select: 'activities' }],
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

      const attendances = await Attendance.find({ courseSlot: { $in: courseSlots } })
        .populate({ path: 'courseSlot', select: 'startDate endDate course' })
        .setOptions({ isVendorUser: true })
        .lean();

      const attendancesByCourse = groupBy(attendances, 'courseSlot.course');
      const traineeCoursesWithAHOrAttendancesOnMonth = [];
      for (const course of courses) {
        if ((attendancesByCourse[course._id] || []).length) {
          const attendanceByTrainee = groupBy(attendancesByCourse[course._id], 'trainee');
          for (const trainee of Object.keys(attendanceByTrainee)) {
            traineeCoursesWithAHOrAttendancesOnMonth.push({ course: course._id, trainee: new ObjectId(trainee) });
          }
          continue;
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
            traineeCoursesWithAHOrAttendancesOnMonth.push({ course: course._id, trainee: new ObjectId(trainee) });
          }
        }
      }

      const certificateCreated = [];
      const errors = [];
      for (const traineeCourse of traineeCoursesWithAHOrAttendancesOnMonth) {
        const { course, trainee } = traineeCourse;
        try {
          const hasCertificateForMonth = await CompletionCertificate.countDocuments({ course, trainee, month });

          if (hasCertificateForMonth) {
            server.log(`Un certificat existe déjà pour l'apprenant ${trainee} de la formation ${course} sur ${month}`);
            continue;
          }

          await CompletionCertificate.create({ course, trainee, month });

          certificateCreated.push({ course, trainee });
        } catch (e) {
          server.log('completionCertificateCreation', e);
          errors.push({ course, trainee });
        }
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
