const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const omit = require('lodash/omit');
const app = require('../../server');
const {
  populateDB,
  questionnairesList,
  questionnaireHistoriesUsersList,
  cardsList,
  coursesList,
  questionnaireHistoriesList,
} = require('./seed/questionnaireHistoriesSeed');
const { getTokenByCredentials, getToken } = require('./helpers/authentication');
const { companyWithoutSubscription } = require('../seed/authCompaniesSeed');
const { noRoleNoCompany } = require('../seed/authUsersSeed');
const QuestionnaireHistory = require('../../src/models/QuestionnaireHistory');
const { WEBAPP, START_COURSE, END_COURSE, UNKNOWN } = require('../../src/helpers/constants');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('QUESTIONNAIRE HISTORIES ROUTES - POST /questionnairehistories', () => {
  let authToken;
  beforeEach(populateDB);

  describe('NO_ROLE_NO_COMPANY', () => {
    let nowStub;
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
      nowStub = sinon.stub(Date, 'now');
    });

    afterEach(() => {
      nowStub.restore();
    });

    it('should create questionnaireHistory', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [
          { card: cardsList[0]._id, answerList: ['5'] },
          { card: cardsList[3]._id, answerList: ['blebleble'] },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const questionnaireHistoriesCount = await QuestionnaireHistory
        .countDocuments({ company: companyWithoutSubscription._id });
      expect(questionnaireHistoriesCount).toBe(1);
    });

    it('should create questionnaireHistory with timeline START_COURSE', async () => {
      nowStub.returns(new Date('2021-04-20T10:00:00.000Z'));

      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[1]._id,
        questionnaireAnswersList: [
          { card: cardsList[1]._id, answerList: ['Premier niveau'] },
          { card: cardsList[3]._id, answerList: ['coucou'] },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const qhCount = await QuestionnaireHistory
        .countDocuments({
          course: coursesList[0]._id,
          user: questionnaireHistoriesUsersList[0],
          questionnaire: questionnairesList[1]._id,
          timeline: START_COURSE,
        });
      expect(qhCount).toBe(1);
    });

    it('should create questionnaireHistory with timeline END_COURSE', async () => {
      nowStub.returns(new Date('2021-04-24T10:00:00.000Z'));

      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[1]._id,
        questionnaireAnswersList: [
          { card: cardsList[1]._id, answerList: ['Premier niveau'] },
          { card: cardsList[3]._id, answerList: ['coucou'] },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const qhCount = await QuestionnaireHistory
        .countDocuments({
          course: coursesList[0]._id,
          user: questionnaireHistoriesUsersList[0],
          questionnaire: questionnairesList[1]._id,
          timeline: END_COURSE,
        });
      expect(qhCount).toBe(1);
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
      const questionnaireHistoriesCount = await QuestionnaireHistory
        .countDocuments({
          course: coursesList[0]._id,
          user: questionnaireHistoriesUsersList[0],
          questionnaire: questionnairesList[0]._id,
        });
      expect(questionnaireHistoriesCount).toBe(1);
    });

    it('should set timeline to UNKNOWN if user tries to answer a questionnaire between middle '
      + 'and end of the course', async () => {
      nowStub.returns(new Date('2021-04-21T10:00:00.000Z'));

      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[1]._id,
        questionnaireAnswersList: [
          { card: cardsList[1]._id, answerList: ['Premier niveau'] },
          { card: cardsList[3]._id, answerList: ['coucou'] },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const questionnaireHistoriesCount = await QuestionnaireHistory
        .countDocuments({
          course: coursesList[0]._id,
          user: questionnaireHistoriesUsersList[0],
          questionnaire: questionnairesList[1]._id,
          timeline: UNKNOWN,
        });
      expect(questionnaireHistoriesCount).toBe(1);
    });

    it('should return 400 if questionnaire answer without card', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [{ answerList: [new ObjectId(), new ObjectId()] }],
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
        user: questionnaireHistoriesUsersList[2],
        questionnaire: questionnairesList[0]._id,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 409 if a questionnaire history already exists for this course, timeline and user', async () => {
      nowStub.returns(new Date('2021-04-24T10:00:00.000Z'));

      const payload = {
        course: coursesList[1]._id,
        user: questionnaireHistoriesUsersList[1],
        questionnaire: questionnairesList[2]._id,
      };

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
        questionnaire: new ObjectId(),
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
        questionnaireAnswersList: [{ card: cardsList[5]._id, answerList: [new ObjectId(), new ObjectId()] }],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a q/a and items in answerList are not ObjectId', async () => {
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

  describe('NOT LOGGED', () => {
    it('should create questionnaireHistory', async () => {
      const questionnaireHistoriesCountBefore = await QuestionnaireHistory.countDocuments();
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [
          { card: cardsList[0]._id, answerList: ['5'] },
          { card: cardsList[3]._id, answerList: ['test'] },
        ],
        origin: WEBAPP,
        timeline: START_COURSE,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const questionnaireHistoriesCountAfter = await QuestionnaireHistory.countDocuments();
      expect(questionnaireHistoriesCountAfter).toBe(questionnaireHistoriesCountBefore + 1);
    });

    it('should return 400 if timeline is not in payload', async () => {
      const payload = {
        course: coursesList[0]._id,
        user: questionnaireHistoriesUsersList[0],
        questionnaire: questionnairesList[0]._id,
        questionnaireAnswersList: [
          { card: cardsList[0]._id, answerList: ['5'] },
          { card: cardsList[3]._id, answerList: ['test'] },
        ],
        origin: WEBAPP,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

describe('QUESTIONNAIRE HISTORIES ROUTES - PUT /questionnairehistories/{_id}', () => {
  let authToken;
  beforeEach(populateDB);
  const endSelfPositionningQuestionnaireHistoryId = questionnaireHistoriesList[1]._id;

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should update questionnaireHistory', async () => {
      const payload = {
        trainerAnswers: [{ card: cardsList[1]._id, answer: '1' }],
        trainerComment: 'Appréciation du formateur',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnairehistories/${endSelfPositionningQuestionnaireHistoryId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const questionnaireHistory = await QuestionnaireHistory
        .countDocuments({
          _id: endSelfPositionningQuestionnaireHistoryId,
          timeline: END_COURSE,
          isValidated: true,
          trainerComment: 'Appréciation du formateur',
        });
      expect(questionnaireHistory).toBe(1);
    });

    it('should return 404 if questionnaireHistory doesn\'t exist', async () => {
      const payload = { trainerAnswers: [{ card: cardsList[1]._id }] };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnairehistories/${new ObjectId()}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if questionnaireHistory has START_COURSE timeline', async () => {
      const startSelfPositionningQuestionnaireHistoryId = questionnaireHistoriesList[2]._id;

      const payload = { trainerAnswers: [{ card: cardsList[1]._id }] };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnairehistories/${startSelfPositionningQuestionnaireHistoryId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if card is not in questionnaire', async () => {
      const payload = { trainerAnswers: [{ card: cardsList[2]._id }] };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnairehistories/${endSelfPositionningQuestionnaireHistoryId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if trainerAnswers has not good number of elements', async () => {
      const payload = { trainerAnswers: [{ card: cardsList[1]._id }, { card: cardsList[3]._id }] };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnairehistories/${endSelfPositionningQuestionnaireHistoryId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if a trainerAnswer is not allowed', async () => {
      const payload = {
        trainerAnswers: [{ card: cardsList[1]._id, answer: 'mauvaiseReponse' }],
        trainerComment: 'Appréciation du formateur',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnairehistories/${endSelfPositionningQuestionnaireHistoryId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('OTHER ROLES', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const payload = { trainerAnswers: [{ card: cardsList[1]._id }] };

        const response = await app.inject({
          method: 'PUT',
          url: `/questionnairehistories/${endSelfPositionningQuestionnaireHistoryId}`,
          payload,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 if user is not course trainer', async () => {
      authToken = await getToken('training_organisation_manager');

      const payload = { trainerAnswers: [{ card: cardsList[1]._id }] };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnairehistories/${endSelfPositionningQuestionnaireHistoryId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
