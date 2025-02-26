const groupBy = require('lodash/groupBy');
const { Boom } = require('@hapi/boom');
const get = require('lodash/get');
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
      const coursesWithAHOrAttendancesOnMonth = [];
      for (const course of courses) {
        if ((attendancesByCourse[course._id] || []).length) {
          coursesWithAHOrAttendancesOnMonth.push(course);
          continue;
        }

        const courseActivities = course.subProgram.steps.map(s => s.activities).flat();
        const courseTrainee = get(course, 'trainees[0]._id');

        const traineeActivityHistories = await ActivityHistory.countDocuments({
          activity: { $in: courseActivities },
          user: courseTrainee,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        });

        if (traineeActivityHistories) coursesWithAHOrAttendancesOnMonth.push(course);
      }

      const certificateCreated = [];
      const errors = [];
      for (const course of coursesWithAHOrAttendancesOnMonth) {
        try {
          const hasCertificateForMonth = await CompletionCertificate.countDocuments({ course: course._id, month });

          if (hasCertificateForMonth) {
            server.log(`Un certificat existe déjà pour la formation ${course._id} sur ${month}`);
            continue;
          }

          if (course.trainees.length === 1) {
            await CompletionCertificate.create({
              course: course._id,
              trainee: get(course, 'trainees[0]._id'),
              month,
            });

            certificateCreated.push(course._id);
          }
        } catch (e) {
          server.log('completionCertificateCreation', e);
          errors.push(course._id);
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
