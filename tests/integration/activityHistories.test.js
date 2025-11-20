const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const omit = require('lodash/omit');
const app = require('../../server');
const { populateDB, activitiesList, userList, cardsList, activityHistories } = require('./seed/activityHistoriesSeed');
const { getTokenByCredentials, getToken } = require('./helpers/authentication');
const ActivityHistory = require('../../src/models/ActivityHistory');
const { noRole } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('ACTIVITY HISTORIES ROUTES - POST /activityhistories', () => {
  let authToken;
  const payload = {
    user: userList[1]._id,
    activity: activitiesList[0]._id,
    questionnaireAnswersList: [
      { card: cardsList[0]._id, answerList: ['blabla'] },
      { card: cardsList[3]._id, answerList: ['blebleble'] },
      { card: cardsList[4]._id, answerList: [new ObjectId(), new ObjectId()] },
      { card: cardsList[5]._id, answerList: [new ObjectId()] },
    ],
    quizzAnswersList: [
      { card: cardsList[6]._id, answerList: [new ObjectId()] },
    ],
    score: 1,
    duration: 'PT23S',
  };

  beforeEach(populateDB);

  describe('Logged user', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(userList[1].local);
    });

    it('should create activityHistory', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);

      const activityHistoriesCount = await ActivityHistory.countDocuments();
      expect(activityHistoriesCount).toEqual(activityHistories.length + 1);
    });

    it('should create activityHistory if user is course tutor', async () => {
      authToken = await getTokenByCredentials(noRole.local);
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { user: noRole._id, activity: activitiesList[0]._id, score: 9 },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);

      const activityHistoriesCount = await ActivityHistory.countDocuments();
      expect(activityHistoriesCount).toEqual(activityHistories.length + 1);
    });

    it('should create activityHistory without questionnaireAnswersList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: omit(payload, 'questionnaireAnswersList'),
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should create activityHistory without quizzAnswersList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: omit(payload, 'quizzAnswersList'),
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should create activityHistory without quizzAnswersList and questionnaireAnswersList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: omit(payload, ['quizzAnswersList', 'questionnaireAnswersList']),
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should create activityHistory without duration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: omit(payload, 'duration'),
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 404 if activity doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, activity: new ObjectId() },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 if user doesn\'t follow course where activity', async () => {
      authToken = await getTokenByCredentials(userList[0].local);
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { user: userList[0]._id, activity: activitiesList[0]._id, score: 9 },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if activity user is not logged user', async () => {
      authToken = await getTokenByCredentials(userList[0].local);
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { user: userList[1]._id, activity: activitiesList[0]._id, score: 9 },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if questionnaire answer without card', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, questionnaireAnswersList: [{ answerList: [new ObjectId(), new ObjectId()] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if questionnaire answer without answer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[0]._id }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if quizz answer without card', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, quizzAnswersList: [{ answerList: [new ObjectId(), new ObjectId()] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if quizz answer without answer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, quizzAnswersList: [{ card: cardsList[6]._id }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if card does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: new ObjectId(), answerList: ['blabla'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if card not in activity', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[1]._id, answerList: ['blabla'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 422 if card not a survey, an open question, a question/answer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[7]._id, answerList: [new ObjectId()] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if card not a quizz card', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, quizzAnswersList: [{ card: cardsList[7]._id, answerList: ['blabla'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if card is a survey and has more than one item in answerList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[0]._id, answerList: ['bla', 'ble'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if card is a open question and has more than one item in answerList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[3]._id, answerList: ['bla', 'ble'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a q/a and is not multiplechoice and has more than one item in answerList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: {
          ...payload,
          questionnaireAnswersList: [{ card: cardsList[5]._id, answerList: [new ObjectId(), new ObjectId()] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if card is a qcu and has more than one item in answerList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: {
          ...payload,
          quizzAnswersList: [{ card: cardsList[2]._id, answerList: [new ObjectId(), new ObjectId()] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a q/a and items in answerList are not ObjectId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: {
          ...payload,
          questionnaireAnswersList: [{ card: cardsList[4]._id, answerList: ['blabla'] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a qcm and items in answerList are not ObjectId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: {
          ...payload,
          questionnaireAnswersList: [{ card: cardsList[6]._id, answerList: ['blabla'] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a qcu and items in answerList are not ObjectId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: {
          ...payload,
          quizzAnswersList: [{ card: cardsList[2]._id, answerList: ['blabla'] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is order the sequence and items in answerList are not ObjectId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: {
          ...payload,
          quizzAnswersList: [{ card: cardsList[8]._id, answerList: ['blabla', 'truc', 'rien'] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is fill the gaps and items in answerList are not ObjectId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/activityhistories',
        payload: {
          ...payload,
          quizzAnswersList: [{ card: cardsList[9]._id, answerList: ['blabla'] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    const missingParams = ['activity', 'user', 'score'];
    missingParams.forEach((param) => {
      it(`should return 400 as ${param} is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/activityhistories',
          payload: omit(payload, param),
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });
});

describe('ACTIVITY HISTORIES ROUTES - GET /activityhistories', () => {
  let authToken;

  describe('COACH', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should return a list of activity histories', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/activityhistories?startDate=2020-12-10T23:00:00&endDate=2021-01-10T23:00:00',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.activityHistories.length).toEqual(1);
    });

    it('should return 400 as startDate is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/activityhistories?endDate=2020-12-10T23:00:00',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 as endDate is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/activityhistories?startDate=2021-01-10T23:00:00',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if startDate is greater than endDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/activityhistories?startDate=2021-01-10T23:00:00&endDate=2020-12-10T23:00:00',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other client roles', () => {
    beforeEach(populateDB);

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/activityhistories?endDate=2021-01-10T23:00:00&startDate=2020-12-10T23:00:00',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });

  describe('Vendor roles', () => {
    it('should return 200 as user has a company', async () => {
      authToken = await getToken('training_organisation_manager');
      const response = await app.inject({
        method: 'GET',
        url: '/activityhistories?endDate=2021-01-10T23:00:00&startDate=2020-12-10T23:00:00',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user has no company', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'GET',
        url: '/activityhistories?endDate=2021-01-10T23:00:00&startDate=2020-12-10T23:00:00',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
