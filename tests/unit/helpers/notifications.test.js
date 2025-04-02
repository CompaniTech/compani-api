const axios = require('axios');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const {
  BLENDED_COURSE_REGISTRATION,
  NEW_ELEARNING_COURSE,
  ATTENDANCE_SHEET_SIGNATURE_REQUEST,
} = require('../../../src/helpers/constants');
const NotificationHelper = require('../../../src/helpers/notifications');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const Course = require('../../../src/models/Course');
const User = require('../../../src/models/User');
const SinonMongoose = require('../sinonMongoose');

describe('sendNotificationToAPI', () => {
  let post;
  beforeEach(() => {
    post = sinon.stub(axios, 'post');
  });
  afterEach(() => {
    post.restore();
  });

  it('should call expo api', async () => {
    const EXPO_NOTIFICATION_API_URL = 'https://exp.host/--/api/v2/push/send/';
    const courseId = new ObjectId();
    const payload = {
      to: 'ExponentPushToken[JeSuisUnTokenExpo]',
      title: 'Bonjour, c\'est Philippe Etchebest',
      body: '#TeamMathias',
      data: { _id: courseId, type: BLENDED_COURSE_REGISTRATION },
    };

    await NotificationHelper.sendNotificationToAPI(payload);

    sinon.assert.calledOnceWithExactly(
      post,
      `${EXPO_NOTIFICATION_API_URL}`,
      {
        to: 'ExponentPushToken[JeSuisUnTokenExpo]',
        title: 'Bonjour, c\'est Philippe Etchebest',
        body: '#TeamMathias',
        data: { _id: courseId, type: BLENDED_COURSE_REGISTRATION },
      }
    );
  });
});

describe('sendNotificationToUser', () => {
  let sendNotificationToAPI;
  beforeEach(() => {
    sendNotificationToAPI = sinon.stub(NotificationHelper, 'sendNotificationToAPI');
  });
  afterEach(() => {
    sendNotificationToAPI.restore();
  });

  it('should call expo api to send notification', async () => {
    const courseId = new ObjectId();
    const payload = {
      title: 'Bonjour, c\'est Philippe Etchebest',
      body: '#TeamMathias',
      data: { _id: courseId, type: BLENDED_COURSE_REGISTRATION },
      expoToken: 'ExponentPushToken[JeSuisUnTokenExpo]',
    };

    await NotificationHelper.sendNotificationToUser(payload);

    sinon.assert.calledOnceWithExactly(
      sendNotificationToAPI,
      {
        to: 'ExponentPushToken[JeSuisUnTokenExpo]',
        title: 'Bonjour, c\'est Philippe Etchebest',
        body: '#TeamMathias',
        data: { _id: courseId, type: BLENDED_COURSE_REGISTRATION },
      }
    );
  });
});

describe('sendBlendedCourseRegistrationNotification', () => {
  let sendNotificationToUser;
  let findOne;
  beforeEach(() => {
    sendNotificationToUser = sinon.stub(NotificationHelper, 'sendNotificationToUser');
    findOne = sinon.stub(Course, 'findOne');
  });
  afterEach(() => {
    sendNotificationToUser.restore();
    findOne.restore();
  });

  it('should format payload and call sendNotificationToUser', async () => {
    const trainee = {
      formationExpoTokenList: ['ExponentPushToken[jeSuisUnTokenExpo]', 'ExponentPushToken[jeSuisUnAutreTokenExpo]'],
    };
    const courseId = new ObjectId();
    const course = {
      _id: courseId,
      subProgram: { program: { name: 'La communication avec Patrick' } },
      misc: 'skusku',
      slots: [{ startDate: '2020-01-02' }],
    };

    findOne.returns(SinonMongoose.stubChainedQueries(course));

    await NotificationHelper.sendBlendedCourseRegistrationNotification(trainee, courseId);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } }],
        },
        { query: 'lean', args: [] },
      ]
    );
    sinon.assert.calledWithExactly(
      sendNotificationToUser.getCall(0),
      {
        title: 'Vous avez été inscrit(e) à une formation',
        body: 'Rendez-vous sur la page "à propos" de votre formation La communication avec Patrick - skusku'
        + ' pour en découvrir le programme.',
        data: { _id: courseId, type: BLENDED_COURSE_REGISTRATION },
        expoToken: 'ExponentPushToken[jeSuisUnTokenExpo]',
      }
    );
    sinon.assert.calledWithExactly(
      sendNotificationToUser.getCall(1),
      {
        title: 'Vous avez été inscrit(e) à une formation',
        body: 'Rendez-vous sur la page "à propos" de votre formation La communication avec Patrick - skusku'
        + ' pour en découvrir le programme.',
        data: { _id: courseId, type: BLENDED_COURSE_REGISTRATION },
        expoToken: 'ExponentPushToken[jeSuisUnAutreTokenExpo]',
      }
    );
  });

  it('should do nothing if trainee has no formationExpoTokenList', async () => {
    const trainee = {};
    const courseId = new ObjectId();

    await NotificationHelper.sendBlendedCourseRegistrationNotification(trainee, courseId);

    sinon.assert.notCalled(findOne);
    sinon.assert.notCalled(sendNotificationToUser);
  });
});

describe('sendNewElearningCourseNotification', () => {
  let sendNotificationToUser;
  let courseFindOne;
  let userFind;

  beforeEach(() => {
    sendNotificationToUser = sinon.stub(NotificationHelper, 'sendNotificationToUser');
    courseFindOne = sinon.stub(Course, 'findOne');
    userFind = sinon.stub(User, 'find');
  });

  afterEach(() => {
    sendNotificationToUser.restore();
    courseFindOne.restore();
    userFind.restore();
  });

  it('should format payload and call sendNotificationToUser', async () => {
    const trainees = [{
      formationExpoTokenList: ['ExponentPushToken[jeSuisUnTokenExpo]', 'ExponentPushToken[jeSuisUnAutreTokenExpo]'],
    }];
    const courseId = new ObjectId();
    const course = {
      _id: courseId,
      subProgram: { program: { _id: new ObjectId(), name: 'La communication avec Patrick' } },
      misc: 'skusku',
      slots: [{ startDate: '2020-01-02' }],
    };
    const query = { formationExpoTokenList: { $exists: true, $not: { $size: 0 } } };

    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));
    userFind.returns(SinonMongoose.stubChainedQueries(trainees, ['lean']));

    await NotificationHelper.sendNewElearningCourseNotification(courseId, query);

    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } }],
        },
        { query: 'lean', args: [] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      userFind,
      [
        {
          query: 'find',
          args: [
            { formationExpoTokenList: { $exists: true, $not: { $size: 0 } } },
            'formationExpoTokenList',
          ],
        },
        { query: 'lean', args: [] },
      ]
    );
    sinon.assert.calledWithExactly(
      sendNotificationToUser.getCall(0),
      {
        title: 'Une nouvelle formation est disponible',
        body: 'Découvrez notre nouvelle formation : La communication avec Patrick - skusku.',
        data: { _id: course.subProgram.program._id, type: NEW_ELEARNING_COURSE },
        expoToken: 'ExponentPushToken[jeSuisUnTokenExpo]',
      }
    );
    sinon.assert.calledWithExactly(
      sendNotificationToUser.getCall(1),
      {
        title: 'Une nouvelle formation est disponible',
        body: 'Découvrez notre nouvelle formation : La communication avec Patrick - skusku.',
        data: { _id: course.subProgram.program._id, type: NEW_ELEARNING_COURSE },
        expoToken: 'ExponentPushToken[jeSuisUnAutreTokenExpo]',
      }
    );
  });

  it('should do nothing if no trainee', async () => {
    const courseId = new ObjectId();
    const course = {
      _id: courseId,
      subProgram: { program: { name: 'La communication avec Patrick' } },
      misc: 'skusku',
      slots: [{ startDate: '2020-01-02' }],
    };
    const query = { formationExpoTokenList: { $exists: true, $not: { $size: 0 } } };

    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));
    userFind.returns(SinonMongoose.stubChainedQueries([], ['lean']));

    await NotificationHelper.sendNewElearningCourseNotification(courseId, query);

    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } }],
        },
        { query: 'lean', args: [] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      userFind,
      [
        {
          query: 'find',
          args: [
            { formationExpoTokenList: { $exists: true, $not: { $size: 0 } } },
            'formationExpoTokenList',
          ],
        },
        { query: 'lean', args: [] },
      ]
    );
    sinon.assert.notCalled(sendNotificationToUser);
  });
});

describe('sendAttendanceSheetSignatureRequestNotification', () => {
  let sendNotificationToUser;
  let findOne;
  beforeEach(() => {
    sendNotificationToUser = sinon.stub(NotificationHelper, 'sendNotificationToUser');
    findOne = sinon.stub(AttendanceSheet, 'findOne');
  });
  afterEach(() => {
    sendNotificationToUser.restore();
    findOne.restore();
  });

  it('should format payload and call sendNotificationToUser', async () => {
    const formationExpoTokenList = [
      'ExponentPushToken[jeSuisUnTokenExpo]',
      'ExponentPushToken[jeSuisUnAutreTokenExpo]',
    ];
    const attendanceSheetId = new ObjectId();
    const courseId = new ObjectId();
    const attendanceSheet = {
      _id: attendanceSheetId,
      trainer: { _id: new ObjectId(), identity: { firstname: 'Paul', lastname: 'Seul' } },
      course: { _id: courseId, misc: 'skusku', subProgram: { program: { name: 'La communication avec Patrick' } } },
    };

    findOne.returns(SinonMongoose.stubChainedQueries(attendanceSheet));

    await NotificationHelper.sendAttendanceSheetSignatureRequestNotification(attendanceSheetId, formationExpoTokenList);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: attendanceSheetId }, { course: 1 }] },
        { query: 'populate', args: [{ path: 'trainer', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'subProgram misc',
            populate: { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
          }],
        },
        { query: 'lean', args: [] },
      ]
    );
    sinon.assert.calledWithExactly(
      sendNotificationToUser.getCall(0),
      {
        title: 'Vous avez une demande d\'émargement à signer',
        body: 'Paul SEUL vous demande d\'émarger des créneaux pour la formation La communication avec '
        + 'Patrick - skusku.',
        data: { _id: attendanceSheetId, courseId, type: ATTENDANCE_SHEET_SIGNATURE_REQUEST },
        expoToken: 'ExponentPushToken[jeSuisUnTokenExpo]',
      }
    );
    sinon.assert.calledWithExactly(
      sendNotificationToUser.getCall(1),
      {
        title: 'Vous avez une demande d\'émargement à signer',
        body: 'Paul SEUL vous demande d\'émarger des créneaux pour la formation La communication avec '
        + 'Patrick - skusku.',
        data: { _id: attendanceSheetId, courseId, type: ATTENDANCE_SHEET_SIGNATURE_REQUEST },
        expoToken: 'ExponentPushToken[jeSuisUnAutreTokenExpo]',
      }
    );
  });

  it('should do nothing if trainee has no formationExpoTokenList', async () => {
    const attendanceSheetId = new ObjectId();

    await NotificationHelper.sendAttendanceSheetSignatureRequestNotification(attendanceSheetId, []);

    sinon.assert.notCalled(findOne);
    sinon.assert.notCalled(sendNotificationToUser);
  });
});
