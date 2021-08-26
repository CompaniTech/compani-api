const expect = require('expect');
const { ObjectID } = require('mongodb');
const omit = require('lodash/omit');
const app = require('../../server');
const {
  populateDB,
  questionnairesList,
  questionnaireHistoriesUsersList,
  cardsList,
  coursesList,
} = require('./seed/questionnaireHistoriesSeed');
const { getTokenByCredentials } = require('./helpers/authentication');
const { noRoleNoCompany } = require('../seed/authUsersSeed');
const QuestionnaireHistory = require('../../src/models/QuestionnaireHistory');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('QUESTIONNAIRE HISTORIES ROUTES - POST /questionnairehistories', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('Logged user', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
    });

    it('should create questionnaireHistory', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [
          { card: cardsList[0]._id, answerList: ['blabla'] },
          { card: cardsList[3]._id, answerList: ['blebleble'] },
          { card: cardsList[4]._id, answerList: [new ObjectID(), new ObjectID()] },
          { card: cardsList[5]._id, answerList: [new ObjectID()] },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const questionnaireHistoriesCount = await QuestionnaireHistory.countDocuments();
      expect(questionnaireHistoriesCount).toBe(1);
    });

    it('should create questionnaireHistory without questionnaireAnswersList', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const questionnaireHistoriesCount = await QuestionnaireHistory.countDocuments();
      expect(questionnaireHistoriesCount).toBe(1);
    });

    it('should return 400 if questionnaire answer without card', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ answerList: [new ObjectID(), new ObjectID()] }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if questionnaire answer without answer', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ card: cardsList[0]._id }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    const missingParams = ['questionnaire', 'user', 'course'];
    missingParams.forEach((param) => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
      };

      it(`should return 400 as ${param} is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/questionnairehistories',
          payload: omit(payload, param),
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return a 409 if a questionnaire history already exists for this course and user', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
      };

      await QuestionnaireHistory.create(payload);

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 404 if questionnaire doesn\'t exist', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: new ObjectID(),
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 if user is not registered to course', async () => {
      const payload = {
        course: coursesList[1]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if card not in questionnaire', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ card: cardsList[1]._id, answerList: ['blabla'] }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 422 if card not a survey, an open question or a question/answer', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ card: cardsList[2]._id, answerList: ['blabla'] }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if card is a survey and has more than one item in answerList', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ card: cardsList[0]._id, answerList: ['bla', 'ble'] }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if card is a open question and has more than one item in answerList', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ card: cardsList[3]._id, answerList: ['bla', 'ble'] }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a q/a and is not multiplechoice and has more than one item in answerList', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ card: cardsList[5]._id, answerList: [new ObjectID(), new ObjectID()] }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a q/a and items in answerList are not ObjectID', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ card: cardsList[4]._id, answerList: ['blabla'] }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });
  });
});
