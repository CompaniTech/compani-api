const expect = require('expect');
const sinon = require('sinon');
const moment = require('moment');
const { ObjectID } = require('mongodb');
const omit = require('lodash/omit');
const pick = require('lodash/pick');
const app = require('../../server');
const User = require('../../src/models/User');
const Course = require('../../src/models/Course');
const CourseSmsHistory = require('../../src/models/CourseSmsHistory');
const { CONVOCATION } = require('../../src/helpers/constants');
const {
  populateDB,
  coursesList,
  programsList,
  auxiliary,
  traineeWithoutCompany,
  courseTrainer,
  coachFromAuthCompany,
  helper,
  auxiliaryWithoutCompany,
  clientAdmin,
  trainerOrganisationManager,
  traineeFromOtherCompany,
}
  = require('./seed/coursesSeed');
const { getToken, authCompany, getTokenByCredentials, otherCompany } = require('./seed/authenticationSeed');
const TwilioHelper = require('../../src/helpers/twilio');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COURSES ROUTES - POST /courses', () => {
  let token;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      token = await getToken('vendor_admin');
    });

    it('should create intra course', async () => {
      const payload = { misc: 'course', type: 'intra', company: authCompany._id, program: programsList[0]._id };
      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { 'x-access-token': token },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should create inter_b2b course', async () => {
      const payload = { misc: 'course', type: 'inter_b2b', program: programsList[0]._id };
      const response = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { 'x-access-token': token },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    const missingParams = [
      { path: 'company' },
      { path: 'program' },
      { path: 'type' },
    ];
    const payload = { misc: 'course', type: 'intra', company: authCompany._id, program: programsList[0]._id };
    missingParams.forEach((test) => {
      it(`should return a 400 error if missing '${test.path}' parameter`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/courses',
          payload: omit({ ...payload }, test.path),
          headers: { 'x-access-token': token },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        const payload = { misc: 'course', type: 'intra', company: authCompany._id, program: programsList[0]._id };
        token = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/courses',
          headers: { 'x-access-token': token },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /courses', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should get all courses', async () => {
      const coursesNumber = coursesList.length;
      const response = await app.inject({
        method: 'GET',
        url: '/courses',
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(coursesNumber);
      expect(response.result.data.courses[3]).toEqual(expect.objectContaining({
        company: pick(otherCompany, ['_id', 'name']),
        program: pick(programsList[0], ['_id', 'name', 'image']),
        trainer: null,
        slots: [{
          startDate: moment('2020-03-20T09:00:00').toDate(),
          endDate: moment('2020-03-20T11:00:00').toDate(),
          courseId: coursesList[3]._id,
          _id: expect.any(ObjectID),
        }],
        trainees: expect.arrayContaining([expect.objectContaining({
          _id: expect.any(ObjectID),
          company: pick(authCompany, ['_id', 'name']),
        })]),
      }));
      expect(response.result.data.courses[3].slotsToPlan).toHaveLength(1);
      expect(response.result.data.courses[3].program.learningGoals).toBeUndefined();
      expect(response.result.data.courses[3].trainees[0].local).toBeUndefined();
      expect(response.result.data.courses[3].trainees[0].refreshtoken).toBeUndefined();
    });

    it('should get courses for a specific trainee', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses?trainees=${traineeFromOtherCompany._id}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(3);
    });
  });

  it('should get courses with a specific trainer', async () => {
    authToken = await getTokenByCredentials(courseTrainer.local);
    const response = await app.inject({
      method: 'GET',
      url: `/courses?trainer=${courseTrainer._id}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.courses.length).toEqual(2);
  });

  it('should get courses for a specific company', async () => {
    authToken = await getToken('coach');
    const response = await app.inject({
      method: 'GET',
      url: `/courses?company=${authCompany._id}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.courses.length).toEqual(3);
  });

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should not get any course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courses',
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should get course if trainee from same company', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses?trainees=${helper._id}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.courses.length).toEqual(2);
    });

    it('should not get course if trainee from different company', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'GET',
        url: `/courses?trainees=${traineeFromOtherCompany._id}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name} requesting all courses`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/courses',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /courses/{_id}', () => {
  let authToken = null;
  const courseFromAuthCompanyIntra = coursesList[0];
  const courseFromAuthCompanyInterB2b = coursesList[4];
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should get intra course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyIntra._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course).toEqual(expect.objectContaining({
        _id: courseFromAuthCompanyIntra._id,
        program: expect.objectContaining(pick(programsList[0], ['_id', 'name', 'learningGoals'])),
        trainer: expect.objectContaining({
          _id: courseTrainer._id,
          identity: { firstname: 'trainer', lastname: 'trainer' },
        }),
        company: { _id: authCompany._id, name: 'Test SAS' },
        contact: { name: '' },
        slots: expect.arrayContaining([
          expect.objectContaining({
            startDate: moment('2020-03-20T09:00:00').toDate(),
            endDate: moment('2020-03-20T11:00:00').toDate(),
            courseId: courseFromAuthCompanyIntra._id,
            _id: expect.any(ObjectID),
          }),
          expect.objectContaining({
            startDate: moment('2020-03-20T14:00:00').toDate(),
            endDate: moment('2020-03-20T18:00:00').toDate(),
            courseId: courseFromAuthCompanyIntra._id,
            _id: expect.any(ObjectID),
          }),
        ]),
        trainees: expect.arrayContaining([
          expect.objectContaining({
            _id: expect.any(ObjectID),
            identity: { firstname: 'Coach', lastname: 'Calif' },
            company: pick(authCompany, ['_id', 'name']),
          }),
          expect.objectContaining({
            _id: expect.any(ObjectID),
            identity: { firstname: 'Helper', lastname: 'Test' },
            company: pick(authCompany, ['_id', 'name']),
          }),
          expect.objectContaining({
            _id: expect.any(ObjectID),
            identity: { firstname: 'client_admin', lastname: 'Chef' },
            company: pick(authCompany, ['_id', 'name']),
          }),
          expect.objectContaining({
            _id: expect.any(ObjectID),
            identity: { firstname: 'trainer', lastname: 'trainer' },
          }),
        ]),
      }));
    });

    it('should get inter b2b course with all trainees', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyInterB2b._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course.trainees).toEqual(expect.arrayContaining([
        expect.objectContaining({
          _id: expect.any(ObjectID),
          identity: { firstname: 'Coach', lastname: 'Calif' },
          company: pick(authCompany, ['_id', 'name']),
        }),
        expect.objectContaining({
          _id: expect.any(ObjectID),
          identity: { firstname: 'Fred', lastname: 'Astaire' },
          company: pick(otherCompany, ['_id', 'name']),
        }),
      ]));
    });
  });

  describe('CLIENT_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('client_admin');
    });

    it('should get inter b2b course with trainees from same company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseFromAuthCompanyInterB2b._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course.trainees).toEqual(expect.arrayContaining([expect.objectContaining({
        _id: expect.any(ObjectID),
        identity: { firstname: 'Coach', lastname: 'Calif' },
        company: pick(authCompany, ['_id', 'name']),
      })]));
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'client_admin', expectedCode: 200 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await app.inject({
          method: 'GET',
          url: `/courses/${courseFromAuthCompanyInterB2b._id.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES ROUTES - GET /courses/user', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('Get user own courses for each role', () => {
    const roles = [
      { name: 'helper', credentials: helper.local, expectedCode: 200, numberOfCourse: 2 },
      { name: 'auxiliary', credentials: auxiliary.local, expectedCode: 200, numberOfCourse: 1 },
      { name: 'auxiliary_without_company', credentials: auxiliaryWithoutCompany.local, expectedCode: 200, numberOfCourse: 0 },
      { name: 'coach', credentials: coachFromAuthCompany.local, expectedCode: 200, numberOfCourse: 4 },
      { name: 'client_admin', credentials: clientAdmin.local, expectedCode: 200, numberOfCourse: 3 },
      { name: 'training_organisation_manager', credentials: trainerOrganisationManager.local, expectedCode: 200, numberOfCourse: 1 },
      { name: 'trainer', credentials: courseTrainer.local, expectedCode: 200, numberOfCourse: 1 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getTokenByCredentials(role.credentials);

        const response = await app.inject({
          method: 'GET',
          url: '/courses/user',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
        expect(response.result.data.courses.length).toBe(role.numberOfCourse);
      });
    });
  });

  it('should return 401 if user is not login', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses/user',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('COURSES ROUTES - GET /courses/{_id}/public-infos', () => {
  let authToken = null;
  const courseIdFromAuthCompany = coursesList[0]._id;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should get course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany.toHexString()}/public-infos`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course._id).toEqual(courseIdFromAuthCompany);
    });
  });

  it('should get course even if not authenticate', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseIdFromAuthCompany.toHexString()}/public-infos`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.course._id).toEqual(courseIdFromAuthCompany);
  });
});

describe('COURSES ROUTES - GET /courses/{_id}/user', () => {
  let authToken = null;
  const courseId = coursesList[0]._id;
  beforeEach(populateDB);

  it('should get course if trainee', async () => {
    authToken = await getTokenByCredentials(coachFromAuthCompany.local);
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseId.toHexString()}/user`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.course).toEqual(expect.objectContaining({
      _id: courseId,
      program: pick(programsList[0], ['_id', 'name', 'image']),
    }));
  });

  it('should not get course if not trainee', async () => {
    authToken = await getToken('vendor_admin');
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseId.toHexString()}/user`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('COURSES ROUTES - PUT /courses/{_id}', () => {
  let token;
  const courseIdFromAuthCompany = coursesList[0]._id;
  const courseIdFromOtherCompany = coursesList[1]._id;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      token = await getToken('vendor_admin');
    });

    it('should update course', async () => {
      const payload = {
        misc: 'new name',
        trainer: new ObjectID(),
        contact: { name: 'name new contact', email: 'test@toto.aa', phone: '0777228811' },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { 'x-access-token': token },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const course = await Course.findOne({ _id: courseIdFromAuthCompany }).lean();

      expect(course.misc).toEqual(payload.misc);
      expect(course.trainer).toEqual(payload.trainer);
      expect(course.contact).toEqual(payload.contact);
    });

    it('should return 400 error if contact phone number is invalid', async () => {
      const payload = {
        contact: { phone: '07772211' },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { 'x-access-token': token },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'client_admin', expectedCode: 200 },
      { name: 'training_organisation_manager', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        const payload = { misc: 'new name' };
        token = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${courseIdFromAuthCompany}`,
          headers: { 'x-access-token': token },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 as user is trainer if not one of his courses', async () => {
      const payload = { misc: 'new name' };
      token = await getToken('trainer');
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${coursesList[1]._id}`,
        headers: { 'x-access-token': token },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    ['coach', 'client_admin'].forEach((role) => {
      it(`should return 403 as user is ${role} requesting on an other company`, async () => {
        const payload = { misc: 'new name' };
        token = await getToken(role);
        const response = await app.inject({
          method: 'PUT',
          url: `/courses/${courseIdFromOtherCompany}`,
          headers: { 'x-access-token': token },
          payload,
        });

        expect(response.statusCode).toBe(403);
      });
    });

    it('should return 200 as user is the course trainer', async () => {
      const payload = { misc: 'new name' };
      token = await getToken('trainer');
      const response = await app.inject({
        method: 'PUT',
        url: `/courses/${courseIdFromAuthCompany}`,
        headers: { 'x-access-token': token },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });
  });
});

describe('COURSES ROUTES - POST /courses/{_id}/sms', () => {
  let authToken;
  const courseIdFromAuthCompany = coursesList[2]._id;
  const courseIdFromOtherCompany = coursesList[3]._id;
  let TwilioHelperStub;
  const payload = { body: 'Ceci est un test', type: CONVOCATION };

  beforeEach(populateDB);

  beforeEach(async () => {
    authToken = await getToken('vendor_admin');
    TwilioHelperStub = sinon.stub(TwilioHelper, 'send');
  });
  afterEach(() => {
    TwilioHelperStub.restore();
  });

  it('should send a SMS to user from compani', async () => {
    const smsHistoryBefore = await CourseSmsHistory.countDocuments({ course: courseIdFromAuthCompany }).lean();
    TwilioHelperStub.returns('SMS SENT !');
    const response = await app.inject({
      method: 'POST',
      url: `/courses/${courseIdFromAuthCompany}/sms`,
      payload,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.message).toBe('SMS bien envoyé.');
    const smsHistoryAfter = await CourseSmsHistory.countDocuments({ course: courseIdFromAuthCompany }).lean();
    expect(smsHistoryAfter).toEqual(smsHistoryBefore + 1);
    sinon.assert.calledWithExactly(
      TwilioHelperStub,
      { to: `+33${coachFromAuthCompany.contact.phone.substring(1)}`, from: 'Compani', body: payload.body }
    );
  });

  it('should return a 400 error if type is invalid', async () => {
    TwilioHelperStub.returns('SMS SENT !');
    const response = await app.inject({
      method: 'POST',
      url: `/courses/${courseIdFromAuthCompany}/sms`,
      payload: { ...payload, type: 'qwert' },
      headers: { 'x-access-token': authToken },
    });
    expect(response.statusCode).toBe(400);
    sinon.assert.notCalled(TwilioHelperStub);
  });

  const missingParams = ['body', 'type'];
  missingParams.forEach((param) => {
    it(`should return a 400 error if missing ${param} parameter`, async () => {
      TwilioHelperStub.returns('SMS SENT !');
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromAuthCompany}/sms`,
        payload: omit(payload, param),
        headers: { 'x-access-token': authToken },
      });
      expect(response.statusCode).toBe(400);
      sinon.assert.notCalled(TwilioHelperStub);
    });
  });

  const roles = [
    { name: 'helper', expectedCode: 403 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'auxiliary_without_company', expectedCode: 403 },
    { name: 'coach', expectedCode: 200 },
    { name: 'client_admin', expectedCode: 200 },
    { name: 'training_organisation_manager', expectedCode: 200 },
  ];
  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
      TwilioHelperStub.returns('SMS SENT !');
      authToken = await getToken(role.name);
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromAuthCompany}/sms`,
        headers: { 'x-access-token': authToken },
        payload,
      });

      expect(response.statusCode).toBe(role.expectedCode);
    });
  });

  it('should return 403 as user is trainer if not one of his courses', async () => {
    TwilioHelperStub.returns('SMS SENT !');
    authToken = await getToken('trainer');
    const response = await app.inject({
      method: 'POST',
      url: `/courses/${coursesList[1]._id}/sms`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(403);
  });

  ['coach', 'client_admin'].forEach((role) => {
    it(`should return 403 as user is ${role} requesting on an other company`, async () => {
      TwilioHelperStub.returns('SMS SENT !');
      authToken = await getToken(role);
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${courseIdFromOtherCompany}/sms`,
        headers: { 'x-access-token': authToken },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  it('should return 200 as user is the course trainer', async () => {
    TwilioHelperStub.returns('SMS SENT !');
    authToken = await getTokenByCredentials(courseTrainer.local);
    const response = await app.inject({
      method: 'POST',
      url: `/courses/${courseIdFromAuthCompany}/sms`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('COURSES ROUTES - GET /courses/{_id}/sms', () => {
  let authToken;
  const courseIdFromAuthCompany = coursesList[0]._id;
  const courseIdFromOtherCompany = coursesList[1]._id;

  beforeEach(populateDB);

  beforeEach(async () => {
    authToken = await getToken('vendor_admin');
  });

  it('should get SMS from course', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseIdFromAuthCompany}/sms`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.sms).toHaveLength(1);
    expect(response.result.data.sms.every(sms => sms.course.toHexString() === courseIdFromAuthCompany.toHexString()))
      .toBeTruthy();
  });

  const roles = [
    { name: 'helper', expectedCode: 403 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'auxiliary_without_company', expectedCode: 403 },
    { name: 'coach', expectedCode: 200 },
    { name: 'client_admin', expectedCode: 200 },
    { name: 'training_organisation_manager', expectedCode: 200 },
  ];
  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
      authToken = await getToken(role.name);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/sms`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(role.expectedCode);
    });
  });

  it('should return 403 as user is trainer if not one of his courses', async () => {
    authToken = await getToken('trainer');
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${coursesList[1]._id}/sms`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(403);
  });

  ['coach', 'client_admin'].forEach((role) => {
    it(`should return 403 as user is ${role} requesting on an other company`, async () => {
      authToken = await getToken(role);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromOtherCompany}/sms`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  it('should return a 200 as user is course trainer', async () => {
    authToken = await getTokenByCredentials(courseTrainer.local);
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseIdFromAuthCompany}/sms`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('COURSES ROUTES - POST /courses/{_id}/trainee', () => {
  let token;
  const intraCourseIdFromAuthCompany = coursesList[0]._id;
  const intraCourseIdFromOtherCompany = coursesList[1]._id;
  const intraCourseIdWithTrainee = coursesList[2]._id;
  const interb2bCourseIdFromAuthCompany = coursesList[4]._id;
  const payload = {
    identity: { firstname: 'Coco', lastname: 'Bongo' },
    local: { email: 'coco_bongo@alenvi.io' },
    contact: { phone: '0689320234' },
    company: authCompany._id,
  };
  const existingUserPayload = { local: { email: auxiliary.local.email }, company: authCompany._id };

  beforeEach(populateDB);

  describe('intra', () => {
    describe('VENDOR_ADMIN', () => {
      beforeEach(async () => {
        token = await getToken('vendor_admin');
      });

      it('should add existing user to course trainees', async () => {
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
          headers: { 'x-access-token': token },
          payload: existingUserPayload,
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.course.trainees).toEqual(expect.arrayContaining([auxiliary._id]));
      });

      it('should add new user to course trainees', async () => {
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
          headers: { 'x-access-token': token },
          payload,
        });

        expect(response.statusCode).toBe(200);
        const newUser = await User.findOne({ 'local.email': payload.local.email }).lean({ autopopulate: true });
        expect(newUser).toBeDefined();
        expect(newUser.role).toBeUndefined();
        expect(response.result.data.course.trainees).toEqual(expect.arrayContaining([newUser._id]));
      });

      it('should add user to course trainees, and update user by adding his company', async () => {
        const updatePayload = { local: { email: traineeWithoutCompany.local.email }, company: authCompany._id };
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
          payload: updatePayload,
          headers: { 'x-access-token': token },
        });

        expect(response.statusCode).toBe(200);
        const updatedUser = await User.findOne({ 'local.email': updatePayload.local.email })
          .lean({ autopopulate: true });
        expect(updatedUser).toBeDefined();
        expect(updatedUser.company).toBeDefined();
        expect(response.result.data.course.trainees).toEqual(expect.arrayContaining([updatedUser._id]));
      });

      it('should return a 409 error if user is not from the course company', async () => {
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${intraCourseIdFromOtherCompany}/trainees`,
          headers: { 'x-access-token': token },
          payload: existingUserPayload,
        });

        expect(response.statusCode).toBe(409);
      });

      it('should return a 409 error as user "trainee" exists and is already registered to course', async () => {
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${intraCourseIdWithTrainee}/trainees`,
          headers: { 'x-access-token': token },
          payload: { ...pick(coachFromAuthCompany, ['local.email', 'company']), identity: { lastname: 'same_trainee' } },
        });

        expect(response.statusCode).toBe(409);
      });

      it('should return a 400 error if missing email parameter', async () => {
        const falsyPayload = omit(payload, 'local.email');
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
          payload: falsyPayload,
          headers: { 'x-access-token': token },
        });

        expect(response.statusCode).toBe(400);
      });

      const missingParams = ['identity.lastname', 'company'];
      missingParams.forEach((path) => {
        it(`should return a 400 error if user has to be created, and missing '${path}' parameter`, async () => {
          const falsyPayload = omit(payload, path);
          const response = await app.inject({
            method: 'POST',
            url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
            payload: falsyPayload,
            headers: { 'x-access-token': token },
          });

          expect(response.statusCode).toBe(400);
        });
      });
    });


    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'auxiliary_without_company', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
        { name: 'client_admin', expectedCode: 200 },
        { name: 'training_organisation_manager', expectedCode: 200 },
      ];
      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
          token = await getToken(role.name);
          const response = await app.inject({
            method: 'POST',
            url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
            headers: { 'x-access-token': token },
            payload,
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });

      it('should return 403 as user is trainer if not one of his courses', async () => {
        token = await getToken('trainer');
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${coursesList[1]._id}/trainees`,
          headers: { 'x-access-token': token },
          payload,
        });

        expect(response.statusCode).toBe(403);
      });

      ['coach', 'client_admin'].forEach((role) => {
        it(`should return 403 as user is ${role} requesting on an other company`, async () => {
          token = await getToken(role);
          const response = await app.inject({
            method: 'POST',
            url: `/courses/${intraCourseIdFromOtherCompany}/trainees`,
            headers: { 'x-access-token': token },
            payload,
          });

          expect(response.statusCode).toBe(403);
        });
      });

      it('should return a 200 as user is course trainer', async () => {
        token = await getTokenByCredentials(courseTrainer.local);
        const response = await app.inject({
          method: 'POST',
          url: `/courses/${intraCourseIdFromAuthCompany}/trainees`,
          headers: { 'x-access-token': token },
          payload,
        });

        expect(response.statusCode).toBe(200);
      });
    });
  });

  describe('inter_b2b vendor_role', () => {
    beforeEach(async () => {
      token = await getToken('vendor_admin');
    });

    it('should add user to inter b2b course', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${interb2bCourseIdFromAuthCompany}/trainees`,
        headers: { 'x-access-token': token },
        payload: existingUserPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.course.trainees).toEqual(expect.arrayContaining([auxiliary._id]));
    });

    it('should return a 400 error if trainee exist, has no company, and missing company parameter', async () => {
      const falsyPayload = { local: { email: traineeWithoutCompany.local.email } };
      const response = await app.inject({
        method: 'POST',
        url: `/courses/${interb2bCourseIdFromAuthCompany}/trainees`,
        payload: falsyPayload,
        headers: { 'x-access-token': token },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

describe('COURSES ROUTES - DELETE /courses/{_id}/trainees/{traineeId}', () => {
  let authToken = null;
  const courseIdFromAuthCompany = coursesList[2]._id;
  const courseIdFromOtherCompany = coursesList[3]._id;
  const traineeId = coachFromAuthCompany._id;

  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should delete course trainee', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${courseIdFromAuthCompany.toHexString()}/trainees/${traineeId.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const course = await Course.findById(courseIdFromAuthCompany).lean();
      expect(course.trainees).toHaveLength(coursesList[2].trainees.length - 1);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'client_admin', expectedCode: 200 },
      { name: 'training_organisation_manager', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courses/${courseIdFromAuthCompany.toHexString()}/trainees/${traineeId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 as user is trainer if not one of his courses', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${coursesList[1]._id}/trainees/${traineeFromOtherCompany._id.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    ['coach', 'client_admin'].forEach((role) => {
      it(`should return 403 as user is ${role} requesting on an other company`, async () => {
        authToken = await getToken(role);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courses/${courseIdFromOtherCompany.toHexString()}/trainees/${traineeId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(403);
      });
    });

    it('should return 200 as user is the course trainer', async () => {
      authToken = await getTokenByCredentials(courseTrainer.local);
      const response = await app.inject({
        method: 'DELETE',
        url: `/courses/${courseIdFromAuthCompany.toHexString()}/trainees/${traineeId.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});

describe('COURSE ROUTES - GET /:_id/attendance-sheets', () => {
  let authToken = null;
  const courseIdFromAuthCompany = coursesList[2]._id;
  const courseIdFromOtherCompany = coursesList[3]._id;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should return 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/attendance-sheets`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 404 error if course does not exist', async () => {
      const invalidId = (new ObjectID()).toHexString();
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${invalidId}/attendance-sheets`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'client_admin', expectedCode: 200 },
      { name: 'training_organisation_manager', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${courseIdFromAuthCompany}/attendance-sheets`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 as user is trainer if not one of his courses', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[1]._id}/attendance-sheets`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    ['coach', 'client_admin'].forEach((role) => {
      it(`should return 403 as user is ${role} requesting on an other company`, async () => {
        authToken = await getToken(role);
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${courseIdFromOtherCompany}/attendance-sheets`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(403);
      });
    });

    it('should return 200 as user is the course trainer', async () => {
      authToken = await getTokenByCredentials(courseTrainer.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/attendance-sheets`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});

describe('COURSE ROUTES - GET /:_id/completion-certificates', () => {
  let authToken = null;
  const courseIdFromAuthCompany = coursesList[2]._id;
  const courseIdFromOtherCompany = coursesList[3]._id;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should return 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 404 error if course does not exist', async () => {
      const invalidId = (new ObjectID()).toHexString();
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${invalidId}/completion-certificates`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'client_admin', expectedCode: 200 },
      { name: 'training_organisation_manager', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}, requesting on his company`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${courseIdFromAuthCompany}/completion-certificates`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });

    it('should return 403 as user is trainer if not one of his courses', async () => {
      authToken = await getToken('trainer');
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${coursesList[1]._id}/completion-certificates`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    ['coach', 'client_admin'].forEach((role) => {
      it(`should return 403 as user is ${role} requesting on an other company`, async () => {
        authToken = await getToken(role);
        const response = await app.inject({
          method: 'GET',
          url: `/courses/${courseIdFromOtherCompany}/completion-certificates`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(403);
      });
    });

    it('should return 200 as user is the course trainer', async () => {
      authToken = await getTokenByCredentials(courseTrainer.local);
      const response = await app.inject({
        method: 'GET',
        url: `/courses/${courseIdFromAuthCompany}/completion-certificates`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
