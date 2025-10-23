const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const Questionnaire = require('../../src/models/Questionnaire');
const Card = require('../../src/models/Card');
const UtilsHelper = require('../../src/helpers/utils');
const {
  populateDB,
  questionnairesList,
  cardsList,
  coursesList,
  programsList,
} = require('./seed/questionnairesSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { noRoleNoCompany } = require('../seed/authUsersSeed');
const {
  SURVEY,
  PUBLISHED,
  DRAFT,
  FLASHCARD,
  EXPECTATIONS,
  END_OF_COURSE,
  SELF_POSITIONNING,
  START_COURSE,
  END_COURSE,
} = require('../../src/helpers/constants');
const { companyWithoutSubscription, authCompany } = require('../seed/authCompaniesSeed');
const UtilsMock = require('../utilsMock');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('QUESTIONNAIRES ROUTES - POST /questionnaires', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create questionnaire', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnaires',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: 'test', type: END_OF_COURSE },
      });

      expect(response.statusCode).toBe(200);
      const questionnairesCount = await Questionnaire.countDocuments();
      expect(questionnairesCount).toBe(questionnairesList.length + 1);
    });

    it('should create self-positionning questionnaire', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnaires',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: 'nouveau questionnaire', type: SELF_POSITIONNING, program: programsList[1]._id },
      });

      expect(response.statusCode).toBe(200);
      const questionnairesCount = await Questionnaire.countDocuments();
      expect(questionnairesCount).toBe(questionnairesList.length + 1);
    });

    it('should return 400 if no name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnaires',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: '', type: EXPECTATIONS },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if wrong type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnaires',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: 'test', type: 'wrong type' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if set program on end_of_course questionnaire', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnaires',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: 'test', type: END_OF_COURSE, program: programsList[0]._id },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 409 if already exists a draft questionnaire with same type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnaires',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: 'test', type: EXPECTATIONS },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if program doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnaires',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { name: 'test auto-positionnement', type: SELF_POSITIONNING, program: new ObjectId() },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/questionnaires',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { name: 'test', type: EXPECTATIONS },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('QUESTIONNAIRES ROUTES - GET /questionnaires', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
      UtilsMock.mockCurrentDate('2021-04-20T10:00:00.000Z');
    });

    afterEach(() => {
      UtilsMock.unmockCurrentDate();
    });

    it('should get all questionnaires', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/questionnaires',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaires.length).toEqual(6);
    });

    it('should get questionnaires linked to course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires?course=${coursesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaires.length).toEqual(3);
    });

    it('should get all SELF_POSITIONNING questionnaires linked to a program', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires?program=${programsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaires.length).toEqual(2);
      expect(
        response.result.data.questionnaires
          .every(q => q.program && UtilsHelper.areObjectIdsEquals(q.program._id, programsList[0]._id))
      ).toBeTruthy();
    });

    it('should return 404 if program doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires?program=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires?course=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('NOT LOGGED', () => {
    beforeEach(async () => {
      UtilsMock.mockCurrentDate('2021-04-22T10:00:00.000Z');
    });

    afterEach(() => {
      UtilsMock.unmockCurrentDate();
    });

    it('should get all questionnaires', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires?course=${coursesList[0]._id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaires.length).toEqual(3);
    });

    it('should return 403 if no course query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/questionnaires',
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name} and no course query`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/questionnaires',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('QUESTIONNAIRES ROUTES - GET /questionnaires/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get questionnaire', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaire._id).toEqual(questionnairesList[0]._id);
    });

    it('should return 404 if questionnaire does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('NOT LOGGED', () => {
    it('should get questionnaire', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/${questionnairesList[1]._id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaire._id).toEqual(questionnairesList[1]._id);
    });
  });

  describe('Other roles', () => {
    it('should return 200 if questionnaire is published', async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/${questionnairesList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name} and questionnaire is draft`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnairesList[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('QUESTIONNAIRES ROUTES - GET /questionnaires/user', () => {
  let authToken;
  beforeEach(populateDB);

  describe('LOGGED USER', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
      UtilsMock.mockCurrentDate('2021-04-20T10:00:00.000Z');
    });

    afterEach(() => {
      UtilsMock.unmockCurrentDate();
    });

    it('should get questionnaire EXPECTATION and SELF_POSITIONNING when before mid-course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/user?course=${coursesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaires.length).toBe(2);
    });

    it('should get questionnaire EXPECTATION and SELF_POSITIONNING when mid-course has to be planned', async () => {
      UtilsMock.mockCurrentDate('2021-04-22T10:00:00.000Z');

      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/user?course=${coursesList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaires.length).toBe(2);
    });

    it('should get questionnaire END_OF_COURSE and SELF_POSITIONNING when after last slot', async () => {
      UtilsMock.mockCurrentDate('2021-04-22T16:05:00.000Z');

      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/user?course=${coursesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaires.length).toBe(2);
    });

    it('should return 400 if query is empty', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/questionnaires/user',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/user?course=${(new ObjectId()).toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});

describe('QUESTIONNAIRE ROUTES - GET /questionnaires/{_id}/follow-up', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return 404 if questionnaire doesn\'t exist', async () => {
      const courseId = coursesList[0]._id;

      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/${new ObjectId()}/follow-up?course=${courseId.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    describe('REVIEW', () => {
      it('should get questionnaire answers', async () => {
        const questionnaireId = questionnairesList[3]._id;
        const courseId = coursesList[0]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}&action=review`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.followUp.length).toBe(1);
      });

      it('should return 400 if action is REVIEW and course isn\'t in query', async () => {
        const questionnaireId = questionnairesList[3]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?action=review`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 404 if questionnaire\'s type is not SELF_POSITIONNING', async () => {
        const questionnaireId = questionnairesList[0]._id;
        const courseId = coursesList[0]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}&action=review`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return 404 if course doesn\'t exist', async () => {
        const questionnaireId = questionnairesList[3]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${new ObjectId()}&action=review`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return 404 if course is strictly e-learning', async () => {
        const questionnaireId = questionnairesList[3]._id;
        const courseId = coursesList[1]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}&action=review`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return 404 if the questionnaire program is not the same as the course program', async () => {
        const questionnaireId = questionnairesList[3]._id;
        const courseId = coursesList[3]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}&action=review`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return 403 if user is trainer but not course trainer', async () => {
        const questionnaireId = questionnairesList[3]._id;
        const courseId = coursesList[2]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}&action=review`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(403);
      });
    });

    describe('LIST', () => {
      it('should get questionnaire answers', async () => {
        const questionnaireId = questionnairesList[1]._id;
        const courseId = coursesList[0]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.followUp.length).toBe(1);
      });

      it('should return 404 if course doesn\'t exist', async () => {
        const questionnaireId = questionnairesList[0]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${new ObjectId()}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return 404 if course is strictly e-learning', async () => {
        const questionnaireId = questionnairesList[0]._id;
        const courseId = coursesList[1]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return 404 as user is trainer, but not course trainer', async () => {
        const questionnaireId = questionnairesList[0]._id;
        const courseId = coursesList[2]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return 403 as user is trainer and route not called for a specific course', async () => {
        const questionnaireId = questionnairesList[0]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId}/follow-up`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(403);
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const questionnaireId = questionnairesList[0]._id;
        const courseId = coursesList[0]._id;

        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/${questionnaireId.toHexString()}/follow-up?course=${courseId.toHexString()}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 200 as user is ROF and route not called for a specific course (LIST)', async () => {
      authToken = await getToken('training_organisation_manager');
      const questionnaireId = questionnairesList[1]._id;

      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/${questionnaireId.toHexString()}/follow-up`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.followUp.length).toBe(1);
      expect(response.result.data.followUp[0].answers.length).toBe(2);
      const answerForNewCompany = response.result.data.followUp[0].answers
        .find(a => UtilsHelper.areObjectIdsEquals(a.course._id, coursesList[0]._id));
      expect(answerForNewCompany.traineeCompany).toEqual(authCompany._id);

      const answerForOldCompany = response.result.data.followUp[0].answers
        .find(a => UtilsHelper.areObjectIdsEquals(a.course._id, coursesList[2]._id));
      expect(answerForOldCompany.traineeCompany).toEqual(companyWithoutSubscription._id);
    });

    it('should return 403 as user is ROF, but not course trainer (REVIEW)', async () => {
      authToken = await getToken('training_organisation_manager');

      const questionnaireId = questionnairesList[3]._id;
      const courseId = coursesList[0]._id;

      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/${questionnaireId}/follow-up?course=${courseId}&action=review`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('QUESTIONNAIRES ROUTES - PUT /questionnaires/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update questionnaire name', async () => {
      const payload = { name: 'test2' };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const questionnairesCount = await Questionnaire.countDocuments({ _id: questionnairesList[0]._id, ...payload });
      expect(questionnairesCount).toBe(1);
    });

    it('should update questionnaire name even if questionnaire is published', async () => {
      const payload = { name: 'test2' };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const questionnairesCount = await Questionnaire.countDocuments({ _id: questionnairesList[1]._id, ...payload });
      expect(questionnairesCount).toBe(1);
    });

    it('should update cards order', async () => {
      const payload = { cards: [questionnairesList[0].cards[1], questionnairesList[0].cards[0]] };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const questionnairesCount = await Questionnaire.countDocuments({ _id: questionnairesList[0]._id, ...payload });
      expect(questionnairesCount).toBe(1);
    });

    it('should update questionnaire status', async () => {
      await Questionnaire.deleteMany({ _id: questionnairesList[1]._id });

      const payload = { status: PUBLISHED };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const questionnairesCount = await Questionnaire.countDocuments({ _id: questionnairesList[0]._id, ...payload });
      expect(questionnairesCount).toBe(1);
    });

    it('should update self_positionning questionnaire status', async () => {
      const payload = { status: PUBLISHED };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[5]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const questionnairesCount = await Questionnaire.countDocuments({ _id: questionnairesList[5]._id, ...payload });
      expect(questionnairesCount).toBe(1);
    });

    it('should return 400 if questionnaire status is not PUBLISHED', async () => {
      await Questionnaire.deleteMany({ _id: questionnairesList[1]._id });

      const payload = { status: DRAFT };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if cards is not an array of strings', async () => {
      const payload = { cards: [1, 2] };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if name is not a string', async () => {
      const payload = { name: 123 };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if name is empty', async () => {
      const payload = { name: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if questionnaire does not exist', async () => {
      const payload = { name: 'test2' };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if cards are not valid', async () => {
      await Questionnaire.deleteMany({ _id: questionnairesList[1]._id });
      await Card.updateMany({ title: 'test1' }, { $set: { title: '' } });

      const payload = { status: PUBLISHED };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if questionnaire with same type is already published', async () => {
      const payload = { status: PUBLISHED };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if self_positionning questionnaire with same program is already published', async () => {
      const payload = { status: PUBLISHED };
      const response = await app.inject({
        method: 'PUT',
        url: `/questionnaires/${questionnairesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        const payload = { name: 'test2' };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/questionnaires/${questionnairesList[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('QUESTIONNAIRES ROUTES - POST /questionnaires/{_id}/card', () => {
  let authToken;
  const questionnaireId = questionnairesList[0]._id;
  beforeEach(populateDB);
  const payload = { template: SURVEY };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create card', async () => {
      const questionnaire = await Questionnaire.findById(questionnaireId).lean();

      const response = await app.inject({
        method: 'POST',
        url: `/questionnaires/${questionnaireId.toHexString()}/cards`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      const questionnaireUpdated = await Questionnaire.findById(questionnaireId).lean();

      expect(response.statusCode).toBe(200);
      expect(questionnaireUpdated.cards.length).toEqual(questionnaire.cards.length + 1);
    });

    it('should return a 400 if invalid template', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/questionnaires/${questionnaireId.toHexString()}/cards`,
        payload: { template: FLASHCARD },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if missing template', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/questionnaires/${questionnaireId.toHexString()}/cards`,
        payload: {},
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 404 if questionnaire does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/questionnaires/${new ObjectId()}/cards`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if questionnaire is published', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/questionnaires/${questionnairesList[1]._id.toHexString()}/cards`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          payload: { template: 'transition' },
          url: `/questionnaires/${questionnaireId.toHexString()}/cards`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('QUESTIONNAIRES ROUTES - DELETE /questionnaires/cards/{cardId}', () => {
  let authToken;
  beforeEach(populateDB);
  const draftQuestionnaire = questionnairesList.find(questionnaire => questionnaire.status === 'draft');
  const publishedQuestionnaire = questionnairesList.find(questionnaire => questionnaire.status === 'published');

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete questionnaire card', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/questionnaires/cards/${draftQuestionnaire.cards[0].toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const remainingCard = await Card.countDocuments({ _id: cardsList[0]._id });
      expect(remainingCard).toBe(0);

      const questionnaire = await Questionnaire.findById(draftQuestionnaire._id).lean();
      expect(questionnaire.cards.length).toEqual(draftQuestionnaire.cards.length - 1);
      expect(questionnaire.cards.includes(draftQuestionnaire.cards[0])).toBeFalsy();
    });

    it('should return 404 if card not found', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/questionnaires/cards/${(new ObjectId()).toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if activity is published', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/questionnaires/cards/${publishedQuestionnaire.cards[0].toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/questionnaires/cards/${draftQuestionnaire.cards[0].toHexString()}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('QUESTIONNAIRES ROUTES - GET /questionnaires/qrcode', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should get qrcode that links to the questionnaire with START COURSE timeline', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/qrcode?course=${coursesList[0]._id}&courseTimeline=${START_COURSE}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result).toBeDefined();
    });

    it('should get qrcode that links to the questionnaire with END COURSE timeline', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/qrcode?course=${coursesList[0]._id}&courseTimeline=${END_COURSE}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result).toBeDefined();
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/qrcode?course=${new ObjectId()}&courseTimeline=${START_COURSE}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if courseTimeline is invalid', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/questionnaires/qrcode?course=${coursesList[0]._id}&courseTimeline=test`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/questionnaires/qrcode?course=${coursesList[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
