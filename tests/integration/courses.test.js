const { expect } = require('expect');
const sinon = require('sinon');
const path = require('path');
const { ObjectId } = require('mongodb');
const omit = require('lodash/omit');
const pick = require('lodash/pick');
const get = require('lodash/get');
const app = require('../../server');
const Course = require('../../src/models/Course');
const CourseSlot = require('../../src/models/CourseSlot');
const drive = require('../../src/models/Google/Drive');
const CourseSmsHistory = require('../../src/models/CourseSmsHistory');
const CourseHistory = require('../../src/models/CourseHistory');
const {
  CONVOCATION,
  COURSE_SMS,
  TRAINEE_ADDITION,
  TRAINEE_DELETION,
  INTRA,
  INTER_B2B,
  OTHER,
  ESTIMATED_START_DATE_EDITION,
  COMPANY_ADDITION,
  COMPANY_DELETION,
  ON_SITE,
  INTRA_HOLDING,
  ALL_PDF,
  ALL_WORD,
  PDF,
  OFFICIAL,
  CUSTOM,
} = require('../../src/helpers/constants');
const {
  populateDB,
  coursesList,
  subProgramsList,
  programsList,
  traineeFromOtherCompany,
  traineeFromAuthCompanyWithFormationExpoToken,
  userCompanies,
  coachFromOtherCompany,
  traineeFormerlyInAuthCompany,
  traineeComingUpInAuthCompany,
  traineeFromAuthFormerlyInOther,
  clientAdminFromThirdCompany,
  traineeFromThirdCompany,
  fourthCompany,
} = require('./seed/coursesSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const {
  otherCompany,
  authCompany,
  companyWithoutSubscription: thirdCompany,
  authHolding,
  otherHolding,
} = require('../seed/authCompaniesSeed');
const {
  noRoleNoCompany,
  coach,
  trainer,
  clientAdmin,
  vendorAdmin,
  trainerAndCoach,
  noRole,
  holdingAdminFromAuthCompany,
  holdingAdminFromOtherCompany,
  trainerOrganisationManager,
  auxiliary,
} = require('../seed/authUsersSeed');
const EmailOptionsHelper = require('../../src/helpers/emailOptions');
const NodemailerHelper = require('../../src/helpers/nodemailer');
const SmsHelper = require('../../src/helpers/sms');
const DocxHelper = require('../../src/helpers/docx');
const NotificationHelper = require('../../src/helpers/notifications');
const UtilsHelper = require('../../src/helpers/utils');
const translate = require('../../src/helpers/translate');
const UtilsMock = require('../utilsMock');
const { CompaniDate } = require('../../src/helpers/dates/companiDates');

const { language } = translate;

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COURSES ROUTES - POST /courses', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create inter_b2b course', async () => {
      const payload = {
        misc: 'course',
        type: INTER_B2B,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        hasCertifyingTest: true,
        salesRepresentative: trainerOrganisationManager._id,
      };
      const coursesCountBefore = await Course.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      const createdCourseId = response.result.data.course._id;

      expect(response.statusCode).toBe(200);
      const coursesCountAfter = await Course.countDocuments();
      expect(coursesCountAfter).toEqual(coursesCountBefore + 1);
      const courseSlotsCount = await CourseSlot
        .countDocuments({ course: createdCourseId, step: { $in: subProgramsList[0].steps } });
      expect(courseSlotsCount).toEqual(1);

      const courseHistory = await CourseHistory.countDocuments({
        course: createdCourseId,
        'update.estimatedStartDate.to': '2022-05-31T08:00:00.000Z',
        action: ESTIMATED_START_DATE_EDITION,
      });

      expect(courseHistory).toEqual(1);
    });

    it('should create intra course', async () => {
      const payload = {
        misc: 'course',
        type: INTRA,
        maxTrainees: 12,
        company: authCompany._id,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        expectedBillsCount: 2,
        hasCertifyingTest: false,
      };
      const coursesCountBefore = await Course.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const coursesCountAfter = await Course.countDocuments();
      expect(coursesCountAfter).toEqual(coursesCountBefore + 1);
      const courseSlotsCount = await CourseSlot
        .countDocuments({ course: response.result.data.course._id, step: { $in: subProgramsList[0].steps } });
      expect(courseSlotsCount).toEqual(1);
    });

    it('should create intra_holding course', async () => {
      const payload = {
        misc: 'course',
        type: INTRA_HOLDING,
        maxTrainees: 12,
        holding: authHolding._id,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        hasCertifyingTest: false,
      };
      const coursesCountBefore = await Course.countDocuments();

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const coursesCountAfter = await Course.countDocuments();
      expect(coursesCountAfter).toEqual(coursesCountBefore + 1);
      const courseSlotsCount = await CourseSlot
        .countDocuments({ course: response.result.data.course._id, step: { $in: subProgramsList[0].steps } });
      expect(courseSlotsCount).toEqual(1);
    });

    it('should return 404 if invalid operationsRepresentative', async () => {
      const payload = {
        misc: 'course',
        type: INTER_B2B,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: clientAdmin._id,
        hasCertifyingTest: false,
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if company does not exist', async () => {
      const payload = {
        misc: 'course',
        type: INTRA,
        company: new ObjectId(),
        maxTrainees: 12,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        expectedBillsCount: 0,
        hasCertifyingTest: false,
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if subProgram does not exist', async () => {
      const payload = {
        misc: 'course',
        type: INTRA,
        company: authCompany._id,
        maxTrainees: 12,
        subProgram: new ObjectId(),
        operationsRepresentative: vendorAdmin._id,
        expectedBillsCount: 0,
        hasCertifyingTest: false,
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if holding does not exist', async () => {
      const payload = {
        misc: 'course',
        type: INTRA_HOLDING,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        holding: new ObjectId(),
        maxTrainees: 2,
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if invalid salesRepresentative', async () => {
      const payload = {
        misc: 'course',
        type: INTER_B2B,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        salesRepresentative: clientAdmin._id,
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if salesRepresentative doesn\'t exist', async () => {
      const payload = {
        misc: 'course',
        type: INTER_B2B,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        salesRepresentative: new ObjectId(),
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if subProgram is strictly e_learning', async () => {
      const payload = {
        misc: 'course',
        type: INTRA,
        company: authCompany._id,
        maxTrainees: 12,
        subProgram: subProgramsList[2]._id,
        operationsRepresentative: vendorAdmin._id,
        expectedBillsCount: 0,
        hasCertifyingTest: false,
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if subProgram is not published', async () => {
      const payload = {
        misc: 'course',
        type: INTRA,
        company: authCompany._id,
        maxTrainees: 12,
        subProgram: subProgramsList[3]._id,
        operationsRepresentative: vendorAdmin._id,
        expectedBillsCount: 0,
        hasCertifyingTest: false,
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if invalid type', async () => {
      const payload = {
        misc: 'course',
        type: 'invalid type',
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if inter_b2b course and maxTrainees is in payload', async () => {
      const payload = {
        misc: 'course',
        type: INTER_B2B,
        maxTrainees: 10,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if inter_b2b course and expectedBillsCount is in payload', async () => {
      const payload = {
        misc: 'course',
        type: INTER_B2B,
        expectedBillsCount: 2,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if intra_holding course and expectedBillsCount is in payload', async () => {
      const payload = {
        misc: 'course',
        type: INTRA_HOLDING,
        expectedBillsCount: 2,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        holding: authHolding._id,
        maxTrainees: 2,
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if inter_b2b course and companies is in payload', async () => {
      const payload = {
        misc: 'course',
        type: INTER_B2B,
        companies: [authCompany._id],
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if intra_holding course and companies is in payload', async () => {
      const payload = {
        misc: 'course',
        type: INTRA_HOLDING,
        companies: [authCompany._id],
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        holding: authHolding._id,
        maxTrainees: 2,
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if intra course and holding is in payload', async () => {
      const payload = {
        misc: 'course',
        type: INTRA,
        companies: [authCompany._id],
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        holding: authHolding._id,
        maxTrainees: 2,
        expectedBillsCount: 2,
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if inter_b2b course and holding is in payload', async () => {
      const payload = {
        misc: 'course',
        type: INTER_B2B,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        holding: authHolding._id,
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if expectedBillsCount is lower than 0', async () => {
      const payload = {
        misc: 'course',
        type: INTRA,
        expectedBillsCount: -3,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if expectedBillsCount is float', async () => {
      const payload = {
        misc: 'course',
        type: INTRA,
        expectedBillsCount: 3.2,
        subProgram: subProgramsList[0]._id,
        operationsRepresentative: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        hasCertifyingTest: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    const intraPayload = {
      misc: 'course',
      company: authCompany._id,
      subProgram: subProgramsList[0]._id,
      type: INTRA,
      maxTrainees: 8,
      operationsRepresentative: vendorAdmin._id,
      expectedBillsCount: 0,
      hasCertifyingTest: false,
    };
    ['company', 'subProgram', 'maxTrainees', 'expectedBillsCount'].forEach((param) => {
      it(`should return a 400 error if course is intra and '${param}' parameter is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/courses',
          payload: omit({ ...intraPayload }, param),
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    const intraHoldingPayload = {
      misc: 'course',
      subProgram: subProgramsList[0]._id,
      type: INTRA_HOLDING,
      maxTrainees: 8,
      operationsRepresentative: vendorAdmin._id,
      holding: authHolding._id,
      hasCertifyingTest: false,
    };

    ['holding', 'subProgram', 'maxTrainees'].forEach((param) => {
      it(`should return a 400 error if course is intra_holding and '${param}' parameter is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/courses',
          payload: omit({ ...intraHoldingPayload }, param),
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
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
        const payload = {
          misc: 'course',
          type: INTRA,
          maxTrainees: 8,
          company: authCompany._id,
          subProgram: subProgramsList[0]._id,
          operationsRepresentative: vendorAdmin._id,
          expectedBillsCount: 2,
          hasCertifyingTest: false,
        };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/courses',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /courses', () => {
  let authToken;
  beforeEach(populateDB);

  it('should return 200 as user is logged in (pedagogy mobile)', async () => {
    authToken = await getTokenByCredentials(noRole.local);

    const response = await app.inject({
      method: 'GET',
      url: '/courses?action=pedagogy&origin=mobile',
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const coursesAsTrainee = response.result.data.courses.traineeCourses;
    const coursesAsTutor = response.result.data.courses.tutorCourses;
    expect(coursesAsTrainee.length).toBe(2);
    expect(coursesAsTutor.length).toBe(1);
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get all courses (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?action=operations&origin=webapp',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(coursesList.length);

      const course =
         response.result.data.courses.find(c => UtilsHelper.areObjectIdsEquals(coursesList[3]._id, c._id));
      expect(course).toMatchObject({
        misc: 'second team formation',
        type: INTRA,
        companies: [
          { ...pick(otherCompany, ['_id', 'name']), holding: { _id: otherHolding._id, name: otherHolding.name } },
        ],
        subProgram: {
          _id: expect.any(ObjectId),
          program: {
            _id: programsList[0]._id,
            name: programsList[0].name,
            subPrograms: [expect.any(ObjectId), expect.any(ObjectId)],
          },
        },
        trainers: [pick(trainerAndCoach, ['_id', 'identity.firstname', 'identity.lastname'])],
        slots: [{
          _id: expect.any(ObjectId),
          startDate: CompaniDate('2020-03-05T08:00:00.000Z').toDate(),
          endDate: CompaniDate('2020-03-05T10:00:00.000Z').toDate(),
          course: coursesList[3]._id,
          address: {
            fullAddress: '37 rue de ponthieu 75008 Paris',
            zipCode: '75008',
            city: 'Paris',
            street: '37 rue de Ponthieu',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
          step: { _id: expect.any(ObjectId), type: ON_SITE },
        }],
        trainees: expect.arrayContaining([expect.any(ObjectId)]),
        slotsToPlan: [{ _id: expect.any(ObjectId), course: course._id }],
      });

      const archivedCourse = response.result.data.courses
        .find(c => UtilsHelper.areObjectIdsEquals(coursesList[14]._id, c._id));
      expect(archivedCourse.archivedAt).toEqual(CompaniDate('2021-01-01T00:00:00.000Z').toDate());
      expect(archivedCourse.estimatedStartDate).toEqual(CompaniDate('2020-11-03T10:00:00.000Z').toDate());
    });

    it('should get blended unarchived courses (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?action=operations&origin=webapp&format=blended&isArchived=false',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(20);
    });

    it('should get blended archived courses (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?action=operations&origin=webapp&format=blended&isArchived=true',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(2);
    });

    it('should get strictly e-learning courses (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?action=operations&origin=webapp&format=strictly_e_learning',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(4);
    });

    it('should get all trainee courses (pedagogy webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=pedagogy&origin=webapp&trainee=${traineeFromAuthFormerlyInOther._id.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.traineeCourses.length).toEqual(7);
    });

    it('should return 400 if no action', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?origin=mobile',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if no origin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?action=operations',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if query \'isArchived\' for non blended courses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?action=operations&origin=webapp&isArchived=false',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if trainee doesn\'t exist (pedagogy webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=pedagogy&origin=webapp&trainee=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if no trainee (pedagogy webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?action=pedagogy&origin=webapp}',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if action is operations but with trainee', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=operations&origin=webapp&trainee=${userCompanies[1].user.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if origin is mobile but with trainee', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=pedagogy&origin=mobile&trainee=${userCompanies[1].user.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    it('should get courses with a specific trainer (ops webapp)', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=operations&origin=webapp&trainer=${trainer._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(16);
    });

    it('should get trainer\'s course (ops mobile)', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=operations&origin=mobile&trainer=${trainer._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(16);

      const course =
         response.result.data.courses.find(c => UtilsHelper.areObjectIdsEquals(coursesList[2]._id, c._id));
      expect(course).toEqual(expect.objectContaining({
        misc: 'second session',
        companies: [
          { ...pick(authCompany, ['_id', 'name']), holding: { _id: authHolding._id, name: authHolding.name } },
        ],
        subProgram: expect.objectContaining({
          _id: expect.any(ObjectId),
          program: {
            _id: programsList[0]._id,
            name: programsList[0].name,
            image: programsList[0].image,
            description: programsList[0].description,
            subPrograms: [expect.any(ObjectId), expect.any(ObjectId)],
          },
        }),
        slots: [{
          startDate: CompaniDate('2020-03-04T08:00:00.000Z').toDate(),
          endDate: CompaniDate('2020-03-04T10:00:00.000Z').toDate(),
          course: coursesList[2]._id,
          step: {
            _id: expect.any(ObjectId),
            type: 'on_site',
          },
          _id: expect.any(ObjectId),
        }],
        slotsToPlan: [
          { _id: expect.any(ObjectId), course: course._id },
          { _id: expect.any(ObjectId), course: course._id },
        ],
      }));
      expect(course.trainer).toBeUndefined();
      expect(course.trainees).toBeUndefined();
      expect(course.operationsRepresentative).toBeUndefined();
    });

    it('should return 400 if no trainer (ops mobile)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses?action=operations&origin=mobile',
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should get courses for a specific company (ops webapp)', async () => {
      authToken = await getToken('coach');
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=operations&origin=webapp&company=${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(13);
      const course =
         response.result.data.courses.find(c => UtilsHelper.areObjectIdsEquals(coursesList[2]._id, c._id));
      expect(course.companies).toEqual([pick(authCompany, ['_id', 'name'])]);
    });

    it('should get courses for a specific holding (ops webapp)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=operations&origin=webapp&holding=${otherHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(10);
    });

    it('should return 200 if coach and same company (pedagogy webapp)', async () => {
      authToken = await getToken('coach');
      const url = `/courses?action=pedagogy&origin=webapp&trainee=${traineeFromAuthFormerlyInOther._id.toHexString()}`
        + `&company=${authCompany._id.toHexString()}`;

      const response = await app.inject({
        method: 'GET',
        url,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const resultCourseIds = response.result.data.courses.traineeCourses.map(course => course._id);
      expect(resultCourseIds.length).toBe(2);
      expect(UtilsHelper.doesArrayIncludeId(resultCourseIds, coursesList[19]._id)).toBeFalsy();
      [coursesList[7]._id, coursesList[8]._id]
        .forEach(courseId => expect(UtilsHelper.doesArrayIncludeId(resultCourseIds, courseId)).toBeTruthy());
    });

    it('should return 200 if coach and trainer and same company (pedagogy webapp)', async () => {
      authToken = await getTokenByCredentials(trainerAndCoach.local);
      const url = `/courses?action=pedagogy&origin=webapp&trainee=${userCompanies[2].user.toHexString()}`
        + `&company=${authCompany._id.toHexString()}`;

      const response = await app.inject({
        method: 'GET',
        url,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 if holding admin and same holding (pedagogy webapp)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const url = `/courses?action=pedagogy&origin=webapp&trainee=${traineeFromThirdCompany._id.toHexString()}`
        + `&holding=${otherHolding._id.toHexString()}`;

      const response = await app.inject({
        method: 'GET',
        url,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const resultCourseIds = response.result.data.courses.traineeCourses.map(course => course._id);
      expect(resultCourseIds.length).toBe(2);
      expect(UtilsHelper.doesArrayIncludeId(resultCourseIds, coursesList[20]._id)).toBeTruthy();
    });

    it('should return 403 if client admin and different company (pedagogy webapp)', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=pedagogy&origin=webapp&trainee=${userCompanies[1].user.toHexString()}`
        + `&company=${authCompany._id.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if holding admin and different holding (pedagogy webapp)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);
      const url = `/courses?action=pedagogy&origin=webapp&trainee=${traineeFromThirdCompany._id.toHexString()}`
        + `&holding=${otherHolding._id.toHexString()}`;

      const response = await app.inject({
        method: 'GET',
        url,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if company and holding in query', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=operations&origin=webapp&holding=${otherHolding._id}&company=${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if has no holding role (ops webapp)', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=operations&origin=webapp&holding=${authHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if not linked to good holding (ops webapp)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses?action=operations&origin=webapp&holding=${otherHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}
       requesting all courses (ops webapp)`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/courses?action=operations&origin=webapp',
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /courses/{_id}', () => {
  let authToken;
  const courseFromAuthCompanyIntra = coursesList[0];
  const courseFromAuthCompanyInterB2b = coursesList[4];
  beforeEach(populateDB);

  describe('TRAINING_ORGANISTION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get intra course (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyIntra._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id.toHexString()).toBe(courseFromAuthCompanyIntra._id.toHexString());
    });

    it('should get inter b2b course with all trainees (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyInterB2b._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id.toHexString()).toBe(courseFromAuthCompanyInterB2b._id.toHexString());
    });
  });

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get inter b2b course (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyInterB2b._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id.toHexString()).toBe(courseFromAuthCompanyInterB2b._id.toHexString());
    });

    it('should return elearning course with no access rule (ops webapp)',
      async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${coursesList[6]._id}?action=operations&origin=webapp`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);
      });

    it('should return course if course is eLearning and has accessRules that contain user company (ops webapp)',
      async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${coursesList[8]._id}?action=operations&origin=webapp`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);
      });

    it('should return 403 if course is eLearning and has accessRules that doesn\'t contain user company (ops webapp)',
      async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${coursesList[11]._id}?action=operations&origin=webapp`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(403);
      });

    it('should return 403 if course is intra and user company is not course company (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[1]._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if course is inter_b2b and no trainee is from user company (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[10]._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if no action', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[10]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if operation and no origin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[10]._id}?action=operations`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if pedagogy and origin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[8]._id}?action=pedagogy&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should get course from other company but same holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[5]._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id.toHexString()).toBe(coursesList[5]._id.toHexString());
    });

    it('should get intra_holding course from holding (without registered companies)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[22]._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id.toHexString()).toBe(coursesList[22]._id.toHexString());
    });

    it('should return 403 if course from company not in holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[0]._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return 200 if user is trainer and is course\'s trainer (ops webapp)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyInterB2b._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 if user is trainer and is course\'s trainer (ops mobile)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyInterB2b._id}?action=operations&origin=mobile`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 if user is trainer and is course\'s trainer (pedagogy)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyInterB2b._id}?action=pedagogy`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if user is trainer and isn\'t course\'s trainer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[10]._id}?action=operations&origin=webapp`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('NOT LOGGED', () => {
    it('should get intra course (for questionnaire)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyIntra._id}?action=questionnaire`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id.toHexString()).toBe(courseFromAuthCompanyIntra._id.toHexString());
    });

    it('should get inter course (for questionnaire)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyInterB2b._id}?action=questionnaire`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id.toHexString()).toBe(courseFromAuthCompanyInterB2b._id.toHexString());
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${new ObjectId()}?action=questionnaire`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if user is not logged and action is pedagogy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyIntra._id}?action=pedagogy`,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if user is not logged and action is operations', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyIntra._id}?action=operations`,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [{ name: 'helper', expectedCode: 403 }, { name: 'planning_referent', expectedCode: 403 }];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'GET',
          url: `/courses/${courseFromAuthCompanyInterB2b._id}?action=operations&origin=webapp`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should get blended course if trainee (pedagogy)', async () => {
      authToken = await getTokenByCredentials(noRole.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[5]._id.toHexString()}?action=pedagogy`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id).toEqual(coursesList[5]._id);
    });

    it('should get blended course if tutor (pedagogy)', async () => {
      authToken = await getTokenByCredentials(noRole.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[25]._id.toHexString()}?action=pedagogy`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id).toEqual(coursesList[25]._id);
    });

    it('should get elearning course if trainee, even if company doesn\'t have accessRules (pedagogy)', async () => {
      authToken = await getTokenByCredentials(noRole.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[11]._id.toHexString()}?action=pedagogy`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id).toEqual(coursesList[11]._id);
    });

    it('should not get course if not trainee', async () => {
      authToken = await getTokenByCredentials(noRole.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[0]._id.toHexString()}?action=pedagogy`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should get course if has access authorization (pedagogy)', async () => {
      authToken = await getTokenByCredentials(traineeFromOtherCompany.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[11]._id.toHexString()}?action=pedagogy`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should not get course if has not access authorization', async () => {
      authToken = await getTokenByCredentials(traineeFromOtherCompany.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[8]._id.toHexString()}?action=pedagogy`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('COURSES ROUTES - GET /courses/{_id}/follow-up', () => {
  let authToken;
  const intraCourseFromAuthCompanyId = coursesList[0]._id;
  beforeEach(populateDB);

  describe('TRANING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get course with follow up', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${intraCourseFromAuthCompanyId}/follow-up`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.followUp._id.toHexString()).toBe(intraCourseFromAuthCompanyId.toHexString());
    });
  });

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get course with follow up', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${intraCourseFromAuthCompanyId}/follow-up?company=${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if user company is not query company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${intraCourseFromAuthCompanyId}/follow-up?company=${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should get course with follow up', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[7]._id}/follow-up?holding=${otherHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 if holding and company in query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[4]._id}/follow-up?holding=${otherHolding._id}&company=${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if user holding is not query holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[7]._id}/follow-up?holding=${authHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return 200 as user trainer and course trainer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${intraCourseFromAuthCompanyId}/follow-up`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toEqual(200);
    });

    it('should return 403 as user trainer but not course trainer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[1]._id}/follow-up`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toEqual(403);
    });
  });

  describe('Other roles', () => {
    it('should return 403 if user has no company and query has no company', async () => {
      authToken = await getToken('auxiliary_without_company');

      const response = await app.inject({
        method: 'GET',
        url: `/courses/${intraCourseFromAuthCompanyId}/follow-up`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 200 as user is coach and trainer, but not course trainer', async () => {
      authToken = await getTokenByCredentials(trainerAndCoach.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${intraCourseFromAuthCompanyId}/follow-up?company=${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toEqual(200);
    });

    const roles = [{ name: 'helper', expectedCode: 403 }, { name: 'planning_referent', expectedCode: 403 }];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'GET',
          url: `/courses/${intraCourseFromAuthCompanyId}/follow-up?company=${authCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /courses/{_id}/activities', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should get questionnaire answers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[0]._id.toHexString()}/activities`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaireAnswers.length).toBe(1);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'GET',
          url: `/courses/${coursesList[0]._id.toHexString()}/activities`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /courses/{_id}/questionnaires', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should get questionnaires list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[0]._id.toHexString()}/questionnaires`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.questionnaires.length).toBe(1);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${new ObjectId()}/questionnaires`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if course is strictly e-learning', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[8]._id.toHexString()}/questionnaires`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 as user is trainer, but not course trainer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[1]._id.toHexString()}/questionnaires`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
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
          url: `/courses/${coursesList[0]._id.toHexString()}/questionnaires`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - PUT /courses/{_id}', () => {
  let authToken;
  const courseIdFromAuthCompany = coursesList[0]._id;
  const archivedCourse = coursesList[14]._id;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update course (intra)', async () => {
      const payload = {
        misc: 'new name',
        contact: vendorAdmin._id,
        estimatedStartDate: '2022-05-31T08:00:00.000Z',
        maxTrainees: 12,
        expectedBillsCount: 3,
        hasCertifyingTest: true,
        certifiedTrainees: [coach._id],
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[17]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseUpdated = await Course.countDocuments({ _id: coursesList[17]._id, ...payload });
      expect(courseUpdated).toEqual(1);

      const historyCreated = await CourseHistory.countDocuments({
        course: coursesList[17]._id,
        action: ESTIMATED_START_DATE_EDITION,
        update: { estimatedStartDate: { from: '', to: '2022-05-31T08:00:00.000Z' } },
      });
      expect(historyCreated).toEqual(1);
    });

    it('should update course (single course)', async () => {
      const payload = {
        misc: ' new single course',
        contact: trainer._id,
        estimatedStartDate: '2024-11-12T10:00:00.000Z',
        expectedBillsCount: 1,
        hasCertifyingTest: true,
        certifiedTrainees: [traineeFromAuthFormerlyInOther._id],
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[24]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseUpdated = await Course.countDocuments({ _id: coursesList[24]._id, ...payload });
      expect(courseUpdated).toEqual(1);
    });

    it('should update company representative and set as contact directly for INTRA course', async () => {
      const payload = { companyRepresentative: coachFromOtherCompany._id, contact: coachFromOtherCompany._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[3]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.countDocuments({ _id: coursesList[3]._id, ...payload }).lean();
      expect(course).toEqual(1);
    });

    it('should update company representative with holding admin', async () => {
      const payload = { companyRepresentative: holdingAdminFromOtherCompany._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[20]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.countDocuments({ _id: coursesList[20]._id, ...payload }).lean();
      expect(course).toEqual(1);
    });

    it('should return 400 if try to remove estimated start date', async () => {
      const payload = { estimatedStartDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const payload = { maxTrainees: 12 };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should set expectedBillsCount if not lower than number of validated bills', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: 1 },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow to set expectedBillsCount to 0 if no bill exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[17]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: 0 },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should archive a blended course', async () => {
      const payload = { archivedAt: CompaniDate('2020-03-25T09:00:00.000Z').toDate() };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.countDocuments({ _id: coursesList[0]._id, archivedAt: { $exists: true } });

      expect(course).toBeTruthy();
    });

    it('should unarchive an archived course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[14]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { archivedAt: '' },
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.countDocuments({ _id: coursesList[14]._id, archivedAt: { $exists: false } });

      expect(course).toBeTruthy();
    });

    it('should update salesRepresentative for a blended course', async () => {
      const payload = { salesRepresentative: trainerOrganisationManager._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.countDocuments({ _id: coursesList[0]._id, salesRepresentative: { $exists: true } });

      expect(course).toBe(1);
    });

    it('should unset salesRepresentative for a blended course', async () => {
      const payload = { salesRepresentative: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.countDocuments({ _id: coursesList[1]._id, salesRepresentative: { $exists: false } });

      expect(course).toBe(1);
    });

    const payloads = [
      { misc: 'new name' },
      { contact: vendorAdmin._id },
      { operationsRepresentative: new ObjectId() },
      { maxTrainees: 15 },
      { expectedBillsCount: 10 },
      { archivedAt: CompaniDate('2020-03-25T09:00:00.000Z').toDate() },
    ];
    payloads.forEach((payload) => {
      it(`should return 403 if course is archived (update ${Object.keys(payload)})`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${archivedCourse}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(403);
      });
    });

    it('should return 404 if invalid operationsRepresentative', async () => {
      const payload = { operationsRepresentative: clientAdmin._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if invalid companyRepresentative', async () => {
      const payload = { companyRepresentative: vendorAdmin._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if companyRepresentative has holding role but wrong company', async () => {
      const courseIdFromOtherCompany = coursesList[1]._id;
      const payload = { companyRepresentative: holdingAdminFromAuthCompany._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromOtherCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if companyRepresentative is in holding but has no holding role', async () => {
      const courseIdFromOtherCompany = coursesList[20]._id;
      const payload = { companyRepresentative: coachFromOtherCompany._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromOtherCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if company representative in intra_holding course is not holdingAdmin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { companyRepresentative: coach._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if company representative in intra_holding course is not from course holding', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { companyRepresentative: holdingAdminFromOtherCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if maxTrainees smaller than registered trainees', async () => {
      const payload = { maxTrainees: 4 };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if contact is not one of interlocutors', async () => {
      const payload = { contact: new ObjectId() };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if contact is one of interlocutors but interlocutor is changing', async () => {
      const payload = { operationsRepresentative: trainerOrganisationManager._id, contact: vendorAdmin._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if trying to unarchive a non archived course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { archivedAt: '' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 403 if trying to archive a not blended course', async () => {
      const payload = { archivedAt: CompaniDate('2020-03-25T09:00:00.000Z').toDate() };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[8]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);

      const course = await Course.findById(coursesList[8]._id)
        .populate({ path: 'slots', select: 'startDate endDate' })
        .populate({ path: 'slotsToPlan' })
        .lean();

      expect(course.trainees.length).toBeTruthy();
      expect(course.format).toBe('strictly_e_learning');
    });

    it('should return 403 if try to add estimated start date to course with slots', async () => {
      const payload = {
        estimatedStartDate: '2022-05-31T08:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if trying to set maxTrainees for inter b2b course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { maxTrainees: 14 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if trying to set expectedBillsCount for inter b2b course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: 14 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if trying to set expectedBillsCount for intra_holding course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: 14 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if expectedBillsCount is lower than 0', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[17]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: -14 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if expectedBillsCount is float', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[17]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: 14.3 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 409 if trying to set expectedBillsCount lower than the number of validated bills', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: 1 },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if try to add trainees in certification and trainee is not in course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { certifiedTrainees: [clientAdmin._id] },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if try to add trainees in certification for a non certifying course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[17]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { certifiedTrainees: [coach._id] },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if try to add trainees in certification while removing course certification', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { certifiedTrainees: [coach._id], hasCertifyingTest: false },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if remove course certification and there are trainees in certification list', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { hasCertifyingTest: false },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if invalid salesRepresentative', async () => {
      const payload = { salesRepresentative: coachFromOtherCompany._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course type is inter_b2b', async () => {
      const payload = { companyRepresentative: holdingAdminFromOtherCompany._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return 200 as user is the course trainer', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { misc: 'new name' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if try to update operationsRepresentative', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { operationsRepresentative: vendorAdmin._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update maxTrainees', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { maxTrainees: 9 },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update expectedBillsCount', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: 25 },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update estimated start date', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { estimatedStartDate: '2022-01-01T08:00:00' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update contact and company representative from other company (intra)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { contact: clientAdmin._id, companyRepresentative: clientAdmin._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update sales representative', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { salesRepresentative: trainerOrganisationManager._id },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    it('should return 200 as user is holding admin from course holding (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[22]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { misc: 'new name' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 if update company representative (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { companyRepresentative: holdingAdminFromAuthCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 if update company representative which is contact (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);

      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[22]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { contact: holdingAdminFromOtherCompany._id, companyRepresentative: holdingAdminFromOtherCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 if update company representative which is contact (intra)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);

      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[20]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { contact: clientAdminFromThirdCompany._id, companyRepresentative: clientAdminFromThirdCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is holding admin but not from course holding (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { misc: 'new name' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update contact and company rep which is not contact (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);

      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { contact: holdingAdminFromAuthCompany._id, companyRepresentative: holdingAdminFromAuthCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should update course as user is coach in the company of the course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { misc: 'new name' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update contact and company representative which is contact (intra)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { contact: clientAdmin._id, companyRepresentative: clientAdmin._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if try to update inter_b2b course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { misc: 'test' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update estimated start date', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { estimatedStartDate: '2022-01-01T08:00:00' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update expectedBillsCount', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { expectedBillsCount: 9 },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update maxTrainees', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { maxTrainees: 9 },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is coach but not in the company of the course (intra)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { misc: 'new name' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update contact and company rep which is not contact (intra)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { contact: clientAdmin._id, companyRepresentative: clientAdmin._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if coach try to update contact only (intra)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { contact: vendorAdmin._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if coach try to update company representative (intra_holding course)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { companyRepresentative: holdingAdminFromAuthCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        const payload = { misc: 'new name' };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${courseIdFromAuthCompany}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    ['client_admin', 'trainer'].forEach((role) => {
      it(`should return 403 if try to update hasCertifyingTest and user is ${role}`, async () => {
        authToken = await getToken(role);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${courseIdFromAuthCompany}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { hasCertifyingTest: true },
        });

        expect(response.statusCode).toBe(403);
      });

      it(`should return 403 if try to update certified trainees list and user is ${role}`, async () => {
        authToken = await getToken(role);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${coursesList[4]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { certifiedTrainees: [coach._id] },
        });

        expect(response.statusCode).toBe(403);
      });
    });
  });
});

describe('COURSES ROUTES - DELETE /courses/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete course', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[6]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const courseCount = await Course.countDocuments({ _id: coursesList[6]._id });
      expect(courseCount).toBe(0);
    });

    it('should delete course with slots to plan', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[16]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const courseCount = await Course.countDocuments({ _id: coursesList[16]._id });
      expect(courseCount).toBe(0);
      const slotsCount = await CourseSlot.countDocuments({ course: coursesList[16]._id });
      expect(slotsCount).toBe(0);
      const historiesCount = await CourseHistory.countDocuments({ course: coursesList[16]._id });
      expect(historiesCount).toBe(0);
    });

    it('should return 404 if course does not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 as course has trainees', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as course has slots', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[5]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should not delete course if billed', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[15]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
      const courseCount = await Course.countDocuments({ _id: coursesList[14]._id });
      expect(courseCount).toBe(1);
    });

    it('should return 403 if course has attendance sheets', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[12]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courses/${coursesList[6]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - POST /courses/{_id}/sms', () => {
  let authToken;
  const courseIdFromAuthCompany = coursesList[2]._id;
  const courseIdFromOtherCompany = coursesList[1]._id;
  const archivedCourseId = coursesList[14]._id;
  const courseIdWithoutReceiver = coursesList[7]._id;
  let SmsHelperStub;
  const payload = { content: 'Ceci est un test', type: CONVOCATION };

  beforeEach(populateDB);
  beforeEach(async () => {
    SmsHelperStub = sinon.stub(SmsHelper, 'send');
    UtilsMock.mockCurrentDate('2020-03-03T15:00:00.000Z');
  });
  afterEach(() => {
    SmsHelperStub.restore();
    UtilsMock.unmockCurrentDate();
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should send a SMS to user from compani', async () => {
      SmsHelperStub.returns('SMS SENT !');
      const smsHistoryBefore = await CourseSmsHistory.countDocuments({ course: courseIdFromAuthCompany });

      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromAuthCompany}/sms`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const smsHistoryAfter = await CourseSmsHistory.countDocuments({ course: courseIdFromAuthCompany });
      expect(smsHistoryAfter).toEqual(smsHistoryBefore + 1);
      sinon.assert.calledWithExactly(
        SmsHelperStub,
        {
          recipient: `+33${coach.contact.phone.substring(1)}`,
          sender: 'Compani',
          content: payload.content,
          tag: COURSE_SMS,
        }
      );
    });

    it('should send a sms if type is other and course is finished', async () => {
      SmsHelperStub.returns('SMS SENT !');
      const smsHistoryBefore = await CourseSmsHistory.countDocuments({ course: courseIdFromAuthCompany });

      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromAuthCompany}/sms`,
        payload: { content: 'test', type: OTHER },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const smsHistoryAfter = await CourseSmsHistory.countDocuments({ course: courseIdFromAuthCompany });
      expect(smsHistoryAfter).toEqual(smsHistoryBefore + 1);
      sinon.assert.calledWithExactly(
        SmsHelperStub,
        {
          recipient: `+33${coach.contact.phone.substring(1)}`,
          sender: 'Compani',
          content: 'test',
          tag: COURSE_SMS,
        }
      );
    });

    it('should return a 200 if course is archived and type is other', async () => {
      const smsHistoryBefore = await CourseSmsHistory.countDocuments({ course: archivedCourseId });

      const response = await app.inject({
        method: 'POST',
        url: `/courses/${archivedCourseId}/sms`,
        payload: { content: 'Ceci est un test', type: OTHER },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const courseIsArchived = !!await Course.countDocuments({ _id: archivedCourseId }, { archivedAt: 1 });
      expect(courseIsArchived).toBeTruthy();

      const smsHistoryAfter = await CourseSmsHistory.countDocuments({ course: archivedCourseId });
      expect(smsHistoryAfter).toEqual(smsHistoryBefore + 1);
      sinon.assert.calledWithExactly(
        SmsHelperStub,
        {
          recipient: `+33${coach.contact.phone.substring(1)}`,
          sender: 'Compani',
          content: 'Ceci est un test',
          tag: COURSE_SMS,
        }
      );
    });

    it('should return 200 if course is intra holding', async () => {
      SmsHelperStub.returns('SMS SENT !');
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[23]._id}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 400 error if type is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromAuthCompany}/sms`,
        payload: { ...payload, type: 'qwert' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
      sinon.assert.notCalled(SmsHelperStub);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${new ObjectId()}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if course has no slot to come and type is not other', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[0]._id}/sms`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);

      const course = await Course.findById(coursesList[0]._id)
        .populate({ path: 'slots', select: 'startDate endDate' })
        .populate({ path: 'slotsToPlan' })
        .populate({ path: 'trainees', select: 'contact.phone' })
        .lean();

      const hasSlotToCome = course.slots && course.slots.some(slot => CompaniDate().isBefore(slot.startDate));
      const hasReceiver = course.trainees && course.trainees.some(trainee => get(trainee, 'contact.phone'));
      expect(hasSlotToCome).toBeFalsy();
      expect(hasReceiver).toBeTruthy();

      sinon.assert.notCalled(SmsHelperStub);
      UtilsMock.unmockCurrentDate();
    });

    it('should return a 403 if course is started and type is convocation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromOtherCompany}/sms`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);

      const course = await Course.findById(courseIdFromOtherCompany)
        .populate({ path: 'slots', select: 'startDate endDate' })
        .populate({ path: 'slotsToPlan' })
        .populate({ path: 'trainees', select: 'contact.phone' })
        .lean();

      const IsStartedAndHasSlotToCome = course.slots.some(slot => CompaniDate().isAfter(slot.endDate)) &&
        course.slots.some(slot => CompaniDate().isBefore(slot.startDate));
      const hasReceiver = course.trainees && course.trainees.some(trainee => get(trainee, 'contact.phone'));
      expect(IsStartedAndHasSlotToCome).toBeTruthy();
      expect(hasReceiver).toBeTruthy();

      sinon.assert.notCalled(SmsHelperStub);
      UtilsMock.unmockCurrentDate();
    });

    it('should return a 403 if sms have no receiver', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdWithoutReceiver}/sms`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);

      const course = await Course.findById(courseIdWithoutReceiver)
        .populate({ path: 'slots', select: 'startDate endDate' })
        .populate({ path: 'slotsToPlan' })
        .populate({ path: 'trainees', select: 'contact.phone' })
        .lean();

      const hasSlotToCome = course.slots && course.slots.some(slot => CompaniDate().isBefore(slot.startDate));
      const hasReceiver = course.trainees && course.trainees.some(trainee => get(trainee, 'contact.phone'));
      expect(hasSlotToCome).toBeTruthy();
      expect(hasReceiver).toBeFalsy();

      sinon.assert.notCalled(SmsHelperStub);
    });

    ['content', 'type'].forEach((param) => {
      it(`should return a 400 error if missing ${param} parameter`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${courseIdFromAuthCompany}/sms`,
          payload: omit(payload, param),
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
        sinon.assert.notCalled(SmsHelperStub);
      });
    });
  });

  describe('HOLDING_ADMIN', () => {
    it('should return 200 if course is intra holding', async () => {
      SmsHelperStub.returns('SMS SENT !');
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[23]._id}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if course is intra holding from other holding', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[23]._id}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
      sinon.assert.notCalled(SmsHelperStub);
    });
  });

  describe('OTHER ROLES', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        SmsHelperStub.returns('SMS SENT !');
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${courseIdFromAuthCompany}/sms`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 200 as user is the course trainer', async () => {
      SmsHelperStub.returns('SMS SENT !');
      authToken = await getTokenByCredentials(trainer.local);
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromAuthCompany}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 as user is intra_holding course trainer', async () => {
      SmsHelperStub.returns('SMS SENT !');
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[23]._id}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is trainer if not one of his courses', async () => {
      SmsHelperStub.returns('SMS SENT !');
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[1]._id}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is client_admin requesting on an other company', async () => {
      SmsHelperStub.returns('SMS SENT !');
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromOtherCompany}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is client_admin and course is intra_holding', async () => {
      authToken = await getTokenByCredentials(clientAdminFromThirdCompany.local);
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[23]._id}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
      sinon.assert.notCalled(SmsHelperStub);
    });
  });
});

describe('COURSES ROUTES - GET /courses/{_id}/sms', () => {
  let authToken;
  const courseIdFromAuthCompany = coursesList[0]._id;
  const courseIdFromOtherCompany = coursesList[1]._id;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get SMS from course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.sms.every(sms =>
        UtilsHelper.areObjectIdsEquals(sms.course, courseIdFromAuthCompany)))
        .toBeTruthy();
    });

    it('should return a 404 error if course does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${new ObjectId()}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('OTHER ROLES', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'trainer', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${courseIdFromAuthCompany}/sms`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 as user is trainer if not one of his courses', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[1]._id}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is client_admin requesting on an other company (intra)', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromOtherCompany}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is client_admin requesting intra_holding course', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[21]._id}/sms`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('COURSES ROUTES - PUT /courses/{_id}/trainees', () => {
  let authToken;
  let sendNotificationToUser;
  const intraCourseIdFromAuthCompany = coursesList[0]._id;
  const archivedCourse = coursesList[14]._id;
  const intraCourseIdFromOtherCompany = coursesList[1]._id;
  const intraCourseIdWithTrainee = coursesList[2]._id;
  const interb2bCourseIdFromAuthCompany = coursesList[4]._id;
  const interb2bCourseIdFromOtherCompany = coursesList[5]._id;

  beforeEach(populateDB);

  beforeEach(() => {
    sendNotificationToUser = sinon.stub(NotificationHelper, 'sendNotificationToUser');
  });
  afterEach(() => {
    sendNotificationToUser.restore();
  });

  describe('TRAINING_ORGANISATION_MANAGER intra', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add existing user to course trainees', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id, isCertified: true },
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: intraCourseIdFromAuthCompany,
        trainee: traineeFromAuthCompanyWithFormationExpoToken._id,
        action: TRAINEE_ADDITION,
      });
      expect(courseHistory).toEqual(1);

      const course = await Course.countDocuments({
        _id: intraCourseIdFromAuthCompany,
        trainees: traineeFromAuthCompanyWithFormationExpoToken._id,
        certifiedTrainees: [traineeFromAuthCompanyWithFormationExpoToken._id],
      });
      expect(course).toEqual(1);
    });

    it('should return 200 if user will be in company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeComingUpInAuthCompany._id },
      });

      expect(response.statusCode).toBe(200);
      const courseHistory = await CourseHistory.countDocuments({
        action: TRAINEE_ADDITION,
        trainee: traineeComingUpInAuthCompany._id,
        course: intraCourseIdFromAuthCompany,
        company: authCompany._id,
      });

      expect(courseHistory).toBe(1);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${new ObjectId()}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${archivedCourse}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if course has already reached max trainees', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[3]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if user is no longer in company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFormerlyInAuthCompany._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if user is not from the course company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdFromOtherCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 422 if company in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdFromOtherCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 403 if user is already course trainer', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdWithTrainee}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: trainer._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if user is already registered to course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdWithTrainee}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if user does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdWithTrainee}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: new ObjectId() },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if trainee is missing in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
        payload: {},
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if field isCertified but course has no certification', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[2]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthFormerlyInOther._id, isCertified: true },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('TRAINING_ORGANISATION_MANAGER inter_b2b', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add user to inter b2b course with current company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseIdFromAuthCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeComingUpInAuthCompany._id, company: otherCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should add user to inter b2b course with future company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseIdFromAuthCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeComingUpInAuthCompany._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 if user company is not from course companies', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseIdFromOtherCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 404 if user is not from company in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseIdFromOtherCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id, company: thirdCompany._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 422 if no company in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseIdFromAuthCompany}/trainees`,
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 403 if trainee is course tutor', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[25]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: noRole._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('TRAINING_ORGANISATION_MANAGER intra_holding', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add user to intra_holding course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthFormerlyInOther._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 if user company is not from course holding', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromOtherCompany._id, company: otherCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 404 if user is not from company in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromOtherCompany._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 422 if no company in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}/trainees`,
        payload: { trainee: traineeFromAuthFormerlyInOther._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  describe('HOLDING_ADMIN intra_holding', () => {
    it('should add user to intra_holding course', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthFormerlyInOther._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 if holding admin is not from course holding', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthFormerlyInOther._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 as user is trainer but not of this course', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[3]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: coachFromOtherCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 as user is inter b2b course trainer', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseIdFromAuthCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 as user is intra_holding course trainer', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthFormerlyInOther._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 200 as user is intra course trainer', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is client_admin requesting on an other company', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseIdFromOtherCompany}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthCompanyWithFormationExpoToken._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if client_admin company is not in intra_holding course', async () => {
      authToken = await getTokenByCredentials(coachFromOtherCompany.local);
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[21]._id}/trainees`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainee: traineeFromAuthFormerlyInOther._id, company: authCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('COURSES ROUTES - POST /courses/{_id}/register-e-learning', () => {
  let authToken;

  beforeEach(populateDB);

  describe('Logged user', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
    });

    it('should add trainee to e-learning course', async () => {
      const course = coursesList[6];
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${course._id}/register-e-learning`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const courseUpdated = await Course.countDocuments({ _id: course._id, trainees: noRoleNoCompany._id });
      expect(courseUpdated).toEqual(1);
    });

    it('should return 404 if course does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${new ObjectId()}/register-e-learning`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course is not strictly e learning', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[0]._id}/register-e-learning`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if trainee already subscribed to course', async () => {
      authToken = await getTokenByCredentials(traineeFromOtherCompany.local);

      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[4]._id}/register-e-learning`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if the course has accessRules and user not from a company with access', async () => {
      authToken = await getTokenByCredentials(traineeFromOtherCompany.local);

      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[8]._id}/register-e-learning`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('COURSES ROUTES - DELETE /courses/{_id}/trainees/{traineeId}', () => {
  let authToken;
  const courseIdFromAuthCompany = coursesList[2]._id;
  const courseIdFromOtherCompany = coursesList[1]._id;
  const archivedCourse = coursesList[14]._id;
  const traineeId = coach._id;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete course trainee (intra)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${courseIdFromAuthCompany.toHexString()}/trainees/${traineeId.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const course = await Course.findById(courseIdFromAuthCompany).lean();
      expect(course.trainees).toHaveLength(coursesList[2].trainees.length - 1);

      const courseHistory = await CourseHistory.countDocuments({
        course: courseIdFromAuthCompany,
        trainee: traineeId,
        action: TRAINEE_DELETION,
      });
      expect(courseHistory).toEqual(1);
    });

    it('should delete course trainee with certification', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[4]._id.toHexString()}/trainees/${traineeFromOtherCompany._id.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const course = await Course.findById(coursesList[4]._id).lean();
      expect(UtilsHelper.doesArrayIncludeId(course.trainees, traineeFromOtherCompany._id)).toBeFalsy();
      expect(UtilsHelper.doesArrayIncludeId(course.certifiedTrainees, traineeFromOtherCompany._id)).toBeFalsy();
    });

    it('should delete course trainee (intra_holding)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[23]._id}/trainees/${traineeFromOtherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 if trainee is not in course', async () => {
      const courseId = courseIdFromAuthCompany.toHexString();
      const traineeNotInCourseId = traineeFromAuthFormerlyInOther._id.toHexString();

      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${courseId}/trainees/${traineeNotInCourseId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${new ObjectId()}/trainees/${traineeId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${archivedCourse.toHexString()}/trainees/${traineeId.toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    it('should delete course trainee (intra)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const res = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[20]._id}/trainees/${traineeFromThirdCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should delete course trainee (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const res = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[23]._id}/trainees/${traineeFromThirdCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 if holding admin delete learner not from his holding', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const res = await app.inject({
        method: 'DELETE',
        url: `/courses/${courseIdFromAuthCompany}/trainees/${traineeId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return 200 as user is the intra course trainer', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${courseIdFromAuthCompany}/trainees/${traineeId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is trainer but this is not one of his courses', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[1]._id}/trainees/${traineeFromOtherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is the inter b2b course trainer', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[4]._id}/trainees/${traineeId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is the intra_holding course trainer', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[23]._id}/trainees/${traineeFromAuthCompanyWithFormationExpoToken._id
          .toHexString()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('CLIENT_ADMIN/COACH', () => {
    it('should return 200 as user is coach requesting on his company (intra_holding)', async () => {
      authToken = await getTokenByCredentials(coachFromOtherCompany.local);
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[23]._id}/trainees/${traineeFromOtherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is client_admin requesting on an other company (intra)', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${courseIdFromOtherCompany}/trainees/${traineeId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 as user is client_admin requesting on an other company (intra_holding)', async () => {
      authToken = await getTokenByCredentials(clientAdminFromThirdCompany.local);
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[23]._id}/trainees/${traineeFromOtherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courses/${courseIdFromAuthCompany.toHexString()}/trainees/${traineeId.toHexString()}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /{_id}/attendance-sheets', () => {
  let authToken;
  const intraCourseIdFromAuthCompany = coursesList[2]._id;
  const interCourseIdFromAuthCompany = coursesList[5]._id;
  const courseIdWithoutOnSiteSlotFromAuth = coursesList[12]._id;
  const courseIdFromOtherCompany = coursesList[1]._id;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should return 200 for intra course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${intraCourseIdFromAuthCompany}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 for inter course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${interCourseIdFromAuthCompany}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 for intra_holding course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[21]._id}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if course does not exist', async () => {
      const invalidId = (new ObjectId()).toHexString();
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${invalidId}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 if no on-site slot', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdWithoutOnSiteSlotFromAuth}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
      expect(response.result.message).toBeDefined();
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should return 200 for intra_holding course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[22]._id}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 for intra_holding course with other holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[21]._id}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company (intra)`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${intraCourseIdFromAuthCompany}/attendance-sheets`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });

      it(`should return ${role.expectedCode} as user is ${role.name}, company in course (intra_holding)`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${coursesList[21]._id}/attendance-sheets`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 as user is trainer if not one of his courses', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[1]._id}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 200 as user is the course trainer', async () => {
      authToken = await getTokenByCredentials(trainer.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${intraCourseIdFromAuthCompany}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is client_admin requesting on an other company (intra)', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromOtherCompany}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is coach and company not in course (intra_holding)', async () => {
      authToken = await getTokenByCredentials(coachFromOtherCompany.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[22]._id}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is client_admin requesting on inter b2b course', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${interCourseIdFromAuthCompany}/attendance-sheets`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('COURSES ROUTES - GET /{_id}/completion-certificates', () => {
  let authToken;
  const courseIdFromAuthCompany = coursesList[2]._id;
  const courseIdFromOtherCompany = coursesList[1]._id;

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(populateDB);

    let downloadFileByIdStub;
    let createDocxStub;
    beforeEach(async () => {
      downloadFileByIdStub = sinon.stub(drive, 'downloadFileById');
      createDocxStub = sinon.stub(DocxHelper, 'createDocx');
      createDocxStub.returns(path.join(__dirname, 'assets/certificate_template.docx'));
      process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID = '1234';

      authToken = await getToken('training_organisation_manager');
    });

    afterEach(() => {
      downloadFileByIdStub.restore();
      createDocxStub.restore();
      process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID = '';
    });

    it('should return 200 if type is CUSTOM', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates?format=${ALL_WORD}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 if type is OFFICIAL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates?format=${ALL_WORD}&type=${OFFICIAL}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if course does not exist', async () => {
      const invalidId = (new ObjectId()).toHexString();
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${invalidId}/completion-certificates?format=${ALL_WORD}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('NO_ROLE', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRole.local);
    });

    it('should return 200 if user is course trainee', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[5]._id}/completion-certificates?format=${PDF}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 if user is not course trainee', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates?format=${PDF}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if user is accessing certificate with an other format than PDF', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[5]._id}/completion-certificates?format=${ALL_WORD}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('TRAINER', () => {
    beforeEach(populateDB);

    let downloadFileByIdStub;
    let createDocxStub;
    beforeEach(async () => {
      downloadFileByIdStub = sinon.stub(drive, 'downloadFileById');
      createDocxStub = sinon.stub(DocxHelper, 'createDocx');
      createDocxStub.returns(path.join(__dirname, 'assets/certificate_template.docx'));
      process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID = '1234';

      authToken = await getToken('trainer');
    });

    afterEach(() => {
      downloadFileByIdStub.restore();
      createDocxStub.restore();
      process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID = '';
    });

    it('should return 200 as user is the course trainer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates?format=${ALL_PDF}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is trainer if not one of his courses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[1]._id}/completion-certificates?format=${ALL_PDF}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is the course trainer and access ALL_WORD', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates?format=${ALL_WORD}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is trainer and type is OFFICIAL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates?format=${ALL_PDF}&type=${OFFICIAL}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('COACH', () => {
    beforeEach(populateDB);

    let downloadFileByIdStub;
    let createDocxStub;
    beforeEach(async () => {
      downloadFileByIdStub = sinon.stub(drive, 'downloadFileById');
      createDocxStub = sinon.stub(DocxHelper, 'createDocx');
      createDocxStub.returns(path.join(__dirname, 'assets/certificate_template.docx'));
      process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID = '1234';

      authToken = await getToken('coach');
    });

    afterEach(() => {
      downloadFileByIdStub.restore();
      createDocxStub.restore();
      process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID = '';
    });

    it('should return 200 as user is coach, course is inter_b2b and type is CUSTOM', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[7]._id}/completion-certificates?format=${ALL_PDF}&type=${CUSTOM}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 as user is coach, course is inter_b2b and type is OFFICIAL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[7]._id}/completion-certificates?format=${ALL_PDF}&type=${OFFICIAL}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is coach and access ALL_WORD', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates?format=${ALL_WORD}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);

    let downloadFileByIdStub;
    let createDocxStub;
    beforeEach(async () => {
      downloadFileByIdStub = sinon.stub(drive, 'downloadFileById');
      createDocxStub = sinon.stub(DocxHelper, 'createDocx');
      createDocxStub.returns(path.join(__dirname, 'assets/certificate_template.docx'));
      process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID = '1234';
      UtilsMock.mockCurrentDate('2019-01-24T15:00:00.000Z');
    });

    afterEach(() => {
      downloadFileByIdStub.restore();
      createDocxStub.restore();
      process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID = '';
      UtilsMock.unmockCurrentDate();
    });

    const roles = [{ name: 'helper', expectedCode: 403 }, { name: 'planning_referent', expectedCode: 403 }];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${courseIdFromAuthCompany}/completion-certificates?format=${ALL_PDF}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 as user is client_admin requesting on an other company', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromOtherCompany}/completion-certificates?format=${ALL_PDF}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('COURSES ROUTES - POST /:_id/accessrules', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should return 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[8]._id}/accessrules`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: otherCompany._id },
      });

      expect(response.statusCode).toBe(200);
      const course = await Course.countDocuments({ _id: coursesList[8]._id, accessRules: otherCompany._id });
      expect(course).toBe(1);
    });

    it('should return 404 if course doen\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${new ObjectId()}/accessrules`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: otherCompany._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if accessRules already exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[8]._id}/accessrules`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: authCompany._id },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 404 if company does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[8]._id}/accessrules`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: new ObjectId() },
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
          url: `/courses/${coursesList[8]._id}/accessrules`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { company: otherCompany._id },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - DELETE /:_id/accessrules/:accessRuleId', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should return 200', async () => {
      const courseId = coursesList[8]._id;
      const accessRulesExistBefore = await Course.countDocuments({ _id: courseId, accessRules: authCompany._id });
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${courseId}/accessrules/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(accessRulesExistBefore).toBe(1);
      const accessRulesExistAfter = await Course.countDocuments({ _id: courseId, accessRules: authCompany._id });
      expect(accessRulesExistAfter).toBe(0);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${new ObjectId()}/accessrules/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if accessRules doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[8]._id}/accessrules/${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
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
          method: 'DELETE',
          url: `/courses/${coursesList[8]._id}/accessrules/${authCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /:_id/convocations', () => {
  beforeEach(populateDB);

  describe('NOT LOGGED', () => {
    it('should return 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[5]._id}/convocations`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if course doen\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${new ObjectId()}/convocations`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});

describe('COURSES ROUTES - PUT /courses/{_id}/companies', () => {
  let authToken;
  const interb2bCourseId = coursesList[7]._id;
  const archivedCourseId = coursesList[18]._id;
  const intraCourseId = coursesList[0]._id;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add company to inter course companies', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseId}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: otherCompany._id },
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: interb2bCourseId,
        company: otherCompany._id,
        action: COMPANY_ADDITION,
      });
      expect(courseHistory).toEqual(1);

      const course = await Course.countDocuments({ _id: interb2bCourseId, companies: otherCompany._id });
      expect(course).toEqual(1);
    });

    it('should add company to intra_holding course companies', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[22]._id}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: otherCompany._id },
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: coursesList[22]._id,
        company: otherCompany._id,
        action: COMPANY_ADDITION,
      });
      expect(courseHistory).toEqual(1);

      const course = await Course.countDocuments({ _id: coursesList[22]._id, companies: otherCompany._id });
      expect(course).toEqual(1);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${new ObjectId()}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: otherCompany._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if company doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseId}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: new ObjectId() },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if course is intra', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${intraCourseId}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: otherCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${archivedCourseId}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: otherCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 409 if company is already linked to course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseId}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: authCompany._id },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 400 if company is missing in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${interb2bCourseId}/companies`,
        payload: {},
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 404 if company is not in holding (intra_holding course)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[22]._id}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: authCompany._id },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('HOLDING_ADMIN', () => {
    it('should return a 200 if holding admin add company to intra_holding course', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);

      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[22]._id}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: thirdCompany._id },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 if holding admin is not from holding (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);

      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[22]._id}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: thirdCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if holding admin try to update inter course', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);

      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[4]._id}/companies`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { company: thirdCompany._id },
      });

      expect(response.statusCode).toBe(403);
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
      it(`should return ${role.expectedCode} as user is ${role.name} (inter_b2b)`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${interb2bCourseId}/companies`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { company: otherCompany._id },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });

      it(`should return ${role.expectedCode} as user is ${role.name} (intra_holding)`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${coursesList[21]._id}/companies`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: { company: fourthCompany._id },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - DELETE /courses/{_id}/companies{companyId}', () => {
  let authToken;
  const interb2bCourseId = coursesList[7]._id;
  const archivedCourseId = coursesList[18]._id;
  const intraCourseId = coursesList[0]._id;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should remove company from inter_b2b course', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${interb2bCourseId}/companies/${thirdCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: interb2bCourseId,
        company: thirdCompany._id,
        action: COMPANY_DELETION,
      });
      expect(courseHistory).toEqual(1);

      const course = await Course.countDocuments({ _id: interb2bCourseId, companies: thirdCompany._id });
      expect(course).toEqual(0);
    });

    it('should remove company from intra_holding course even if has attendances', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[21]._id}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${new ObjectId()}/companies/${thirdCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if company not in course', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${interb2bCourseId}/companies/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if course is intra', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${intraCourseId}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if company trainee is still registered to course', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${interb2bCourseId}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual(translate[language].companyTraineeRegisteredToCourse);
    });

    it('should return a 403 if company has bill', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[19]._id}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual(translate[language].companyHasCourseBill);
    });

    it('should return a 403 if company has attendance (intra or inter)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[19]._id}/companies/${thirdCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual(translate[language].companyTraineeAttendedToCourse);
    });

    it('should return a 403 if company has attendance sheet', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[12]._id}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual(translate[language].companyHasAttendanceSheetForCourse);
    });

    it('should return a 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${archivedCourseId}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    it('should remove company from intra_holding course', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);

      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[21]._id}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 if holding admin is not from holding (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);

      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[21]._id}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if holding admin try to update inter course', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);

      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${interb2bCourseId}/companies/${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
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
      it(`should return ${role.expectedCode} as user is ${role.name} (inter_b2b)`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courses/${interb2bCourseId}/companies/${thirdCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });

      it(`should return ${role.expectedCode} as user is ${role.name} (intra_holding)`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courses/${coursesList[21]._id}/companies/${authCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - POST /courses/{_id}/trainingcontracts', () => {
  let authToken;
  const intraCourseIdFromAuthCompany = coursesList[0]._id;
  const interCourseIdFromAuthCompany = coursesList[10]._id;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should return 200 for intra course', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainingcontracts`,
        payload: { price: 4300, company: authCompany._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 for inter_b2b course', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${interCourseIdFromAuthCompany}/trainingcontracts`,
        payload: { price: 4300, company: otherCompany._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if course does not exist', async () => {
      const invalidId = (new ObjectId()).toHexString();
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${invalidId}/trainingcontracts`,
        payload: { price: 4300, company: authCompany._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if price not greater than 0', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainingcontracts`,
        payload: { price: 0, company: authCompany._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if no price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainingcontracts`,
        payload: { company: authCompany._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if no company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${intraCourseIdFromAuthCompany}/trainingcontracts`,
        payload: { price: 4300 },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 403 if company has no address', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${coursesList[5]._id}/trainingcontracts`,
        payload: { price: 4300, company: thirdCompany._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toBeDefined();
    });

    it('should return a 403 if company is not in course', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${interCourseIdFromAuthCompany}/trainingcontracts`,
        payload: { price: 4300, company: thirdCompany._id },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toBeDefined();
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${intraCourseIdFromAuthCompany}/trainingcontracts`,
          payload: { price: 4300 },
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - PUT /courses/{_id}/trainers', () => {
  let authToken;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add trainer to course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[7]._id}/trainers`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainer: trainerAndCoach._id },
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.countDocuments({ _id: coursesList[7]._id, trainers: trainerAndCoach._id });
      expect(course).toEqual(1);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${new ObjectId()}/trainers`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainer: trainerAndCoach._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if trainer doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[7]._id}/trainers`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainer: new ObjectId() },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if trainer is trainee', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[0]._id}/trainers`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainer: vendorAdmin._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[14]._id}/trainers`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainer: trainerAndCoach._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if trainer is not in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[7]._id}/trainers`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 409 if trainer is already trainer', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[7]._id}/trainers`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { trainer: trainer._id },
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
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${coursesList[7]._id}/trainers`,
          payload: { trainer: trainerAndCoach._id },
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - DELETE /courses/{_id}/trainers/{trainerId}', () => {
  let authToken;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should remove trainer from course', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[0]._id}/trainers/${trainer._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if course\'s _id doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${new ObjectId()}/trainers/${trainer._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if trainerId is not in course\'s trainers', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[0]._id}/trainers/${vendorAdmin._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[14]._id}/trainers/${trainer._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('OTHERS ROLES', () => {
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
          method: 'DELETE',
          url: `/courses/${coursesList[0]._id}/trainers/${trainer._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - PUT /courses/{_id}/tutors', () => {
  let authToken;
  let sendinBlueTransporter;
  let addTutorContent;

  beforeEach(populateDB);
  beforeEach(() => {
    sendinBlueTransporter = sinon.stub(NodemailerHelper, 'sendinBlueTransporter')
      .returns({ sendMail: sinon.stub().returns('emailSent') });
    addTutorContent = sinon.stub(EmailOptionsHelper, 'addTutorContent').returns('content for tutor');
  });
  afterEach(() => {
    sendinBlueTransporter.restore();
    addTutorContent.restore();
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should add tutor to course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[24]._id}/tutors`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { tutor: auxiliary._id },
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.countDocuments({ _id: coursesList[24]._id, tutors: auxiliary._id });
      expect(course).toEqual(1);
      sinon.assert.calledOnceWithExactly(sendinBlueTransporter);
      sinon.assert.calledOnceWithExactly(addTutorContent, 'Auxiliary OLAIT', 'Michel DRUCKER', 'program');
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${new ObjectId()}/tutors`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { tutor: traineeFromThirdCompany._id },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[14]._id}/tutors`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { tutor: traineeFromAuthFormerlyInOther._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if course is not a single course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[7]._id}/tutors`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { tutor: traineeFromThirdCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if tutor is not in company', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[25]._id}/tutors`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { tutor: traineeFromThirdCompany._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if tutor is trainee', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[24]._id}/tutors`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { tutor: traineeFromAuthFormerlyInOther._id },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if tutor is already tutor in course', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[25]._id}/tutors`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { tutor: noRole._id },
      });

      expect(response.statusCode).toBe(409);
    });
  });
});

describe('COURSE ROUTES - DELETE /course/{_id}/tutors/{tutorId}', () => {
  let authToken;

  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    before(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should remove tutor from course', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[25]._id}/tutors/${noRole._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${new ObjectId()}/tutors/${traineeFromAuthCompanyWithFormationExpoToken._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[14]._id}/tutors/${traineeFromAuthFormerlyInOther._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if tutorId is not in course tutors', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[25]._id}/tutors/${traineeFromAuthFormerlyInOther._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('OTHER ROLE', () => {
    const roles = [
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courses/${coursesList[25]._id}/tutors/${traineeFromAuthCompanyWithFormationExpoToken._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
