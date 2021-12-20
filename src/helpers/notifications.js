const get = require('lodash/get');
const axios = require('axios');
const Course = require('../models/Course');
const User = require('../models/User');
const { BLENDED_COURSE_REGISTRATION, NEW_ELEARNING_COURSE } = require('./constants');

const EXPO_NOTIFICATION_API_URL = 'https://exp.host/--/api/v2/push/send/';

exports.sendNotificationToAPI = async payload => axios.post(`${EXPO_NOTIFICATION_API_URL}`, payload);

exports.sendNotificationToUser = async (payload) => {
  const expoPayload = { to: payload.expoToken, title: payload.title, body: payload.body, data: payload.data };
  await this.sendNotificationToAPI(expoPayload);
};

const getCourseName = course => `${get(course, 'subProgram.program.name')}${course.misc ? ` - ${course.misc}` : ''}`;

exports.sendBlendedCourseRegistrationNotification = async (trainee, courseId) => {
  if (!get(trainee, 'formationExpoTokenList.length')) return;

  const course = await Course.findOne({ _id: courseId })
    .populate({ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } })
    .lean();

  const courseName = getCourseName(course);

  const notifications = [];
  for (const expoToken of trainee.formationExpoTokenList) {
    notifications.push(
      this.sendNotificationToUser({
        title: 'Vous avez été inscrit(e) à une formation',
        body: `Rendez-vous sur la page "à propos" de votre formation ${courseName} pour en découvrir le programme.`,
        data: { _id: courseId, type: BLENDED_COURSE_REGISTRATION },
        expoToken,
      })
    );
  }

  await Promise.all(notifications);
};

exports.sendNewElearningCourseNotification = async (courseId) => {
  const course = await Course.findOne({ _id: courseId })
    .populate({ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } })
    .lean();
  const trainees = await User
    .find(
      { formationExpoTokenList: { $exists: true, $not: { $size: 0 } } },
      'formationExpoTokenList'
    )
    .lean();

  const courseName = getCourseName(course);

  const notifications = [];
  for (const trainee of trainees) {
    for (const expoToken of trainee.formationExpoTokenList) {
      notifications.push(
        this.sendNotificationToUser({
          title: 'Une nouvelle formation est disponible',
          body: `Découvrez notre nouvelle formation : ${courseName}.`,
          data: { _id: course.subProgram.program._id, type: NEW_ELEARNING_COURSE },
          expoToken,
        })
      );
    }
  }

  await Promise.all(notifications);
};
