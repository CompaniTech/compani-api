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
        .lean();

      const courseIds = courses.map(c => c._id.toHexString());

      const attendances = await Attendance.find({})
        .populate({ path: 'courseSlot', select: 'startDate endDate course' })
        .setOptions({ isVendorUser: true })
        .lean();
      const startOfMonth = CompaniDate(month, MM_YYYY).startOf(MONTH).toISO();
      const endOfMonth = CompaniDate(month, MM_YYYY).endOf(MONTH).toISO();

      const attendancesOnMonth = attendances.filter((a) => {
        const { courseSlot: slot } = a;

        const isAttendanceOnMonth = CompaniDate(slot.endDate).isBefore(endOfMonth) &&
          CompaniDate(slot.startDate).isAfter(startOfMonth);

        return isAttendanceOnMonth && courseIds.includes(slot.course.toHexString());
      });

      const attendancesByCourse = groupBy(attendancesOnMonth, 'courseSlot.course');
      const coursesWithAHOrAttendancesOnMonth = [];
      for (const course of courses) {
        if ((attendancesByCourse[course._id] || []).length) {
          coursesWithAHOrAttendancesOnMonth.push(course);
          continue;
        }

        const courseActivities = course.subProgram.steps.map(s => s.activities).flat();
        const courseTrainee = get(course, 'trainees[0]._id');
        const traineeActivityHistories = await ActivityHistory
          .find({ activity: { $in: courseActivities }, user: courseTrainee })
          .lean();

        if (traineeActivityHistories.length) coursesWithAHOrAttendancesOnMonth.push(course);
      }

      const certificateCreated = [];
      const errors = [];
      for (const course of coursesWithAHOrAttendancesOnMonth) {
        try {
          const hasCertificateForMonth = await CompletionCertificate
            .findOne({ course: course._id, month })
            .setOptions({ isVendorUser: true })
            .lean();

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
