const Boom = require('@hapi/boom');
const Course = require('../../models/Course');
const TrainerMission = require('../../models/TrainerMission');
const User = require('../../models/User');
const translate = require('../../helpers/translate');
const { CompaniDate } = require('../../helpers/dates/companiDates');

const { language } = translate;

exports.authorizeTrainerMissionCreation = async (req) => {
  const { trainer, courses } = req.payload;
  const coursesId = Array.isArray(courses) ? courses.map(course => course.courseId) : [courses.courseId];

  const coursesCount = await Course.countDocuments({ _id: { $in: coursesId }, trainers: trainer });
  if (coursesCount !== coursesId.length) throw Boom.notFound();

  const trainerMission = await TrainerMission
    .countDocuments({ courses: { $in: coursesId }, cancelledAt: { $exists: false }, trainer });
  if (trainerMission) throw Boom.conflict(translate[language].trainerMissionAlreadyExist);

  return null;
};

exports.authorizeTrainerMissionGet = async (req) => {
  const { trainer: trainerId } = req.query;

  const trainer = await User.countDocuments({ _id: trainerId, 'role.vendor': { $exists: true } });
  if (!trainer) throw Boom.notFound();

  return null;
};

exports.authorizeTrainerMissionEdit = async (req) => {
  const trainerMission = await TrainerMission.findOne({ _id: req.params._id }, { cancelledAt: 1, date: 1 }).lean();
  if (trainerMission.cancelledAt) throw Boom.forbidden();
  if (req.payload.cancelledAt && CompaniDate(req.payload.cancelledAt).isBefore(trainerMission.date)) {
    throw Boom.conflict();
  }

  return null;
};
