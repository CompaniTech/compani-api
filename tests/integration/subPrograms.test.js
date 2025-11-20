const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const omit = require('lodash/omit');
const app = require('../../server');
const SubProgram = require('../../src/models/SubProgram');
const Course = require('../../src/models/Course');
const Step = require('../../src/models/Step');
const NotificationHelper = require('../../src/helpers/notifications');
const UtilsHelper = require('../../src/helpers/utils');
const { populateDB, subProgramsList, stepsList, tester } = require('./seed/subProgramsSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { authCompany, otherCompany } = require('../seed/authCompaniesSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('SUBPROGRAMS ROUTES - PUT /subprograms/{_id}', () => {
  let authToken;
  let sendNewElearningCourseNotification;
  beforeEach(populateDB);
  const blendedSubProgramId = subProgramsList[0]._id;
  const eLearningSubProgramId = subProgramsList[1]._id;

  beforeEach(() => {
    sendNewElearningCourseNotification = sinon.stub(NotificationHelper, 'sendNotificationToUser');
  });
  afterEach(() => {
    sendNewElearningCourseNotification.restore();
  });

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update subProgram name and steps', async () => {
      const payload = {
        name: 'un autre nom pour le sous-programme',
        steps: [subProgramsList[0].steps[1], subProgramsList[0].steps[0]],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${blendedSubProgramId.toHexString()}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      const subProgramUpdated = await SubProgram.findById(blendedSubProgramId).lean();

      expect(response.statusCode).toBe(200);
      expect(subProgramUpdated.name).toEqual(payload.name);
      expect(subProgramUpdated.steps.length).toBe(2);
      expect(UtilsHelper.areObjectIdsEquals(subProgramUpdated.steps[0], payload.steps[0])).toBeTruthy();
      expect(UtilsHelper.areObjectIdsEquals(subProgramUpdated.steps[1], payload.steps[1])).toBeTruthy();
    });

    it('should publish blended subProgram', async () => {
      const payload = { status: 'published' };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${blendedSubProgramId.toHexString()}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const subProgramUpdated = !!await SubProgram.countDocuments({ _id: blendedSubProgramId, status: 'published' });
      expect(subProgramUpdated).toBeTruthy();
      const countCourse = await Course.countDocuments({
        subProgram: blendedSubProgramId,
        format: 'strictly_e_learning',
      });
      expect(countCourse).toBe(0);
    });

    it('should publish strictly e-learning subProgram, and create 100% e-learning course with accessRules',
      async () => {
        const payload = { status: 'published', accessCompanies: [authCompany._id] };
        const response = await app.inject({
          method: 'PUT',
          url: `/subprograms/${eLearningSubProgramId.toHexString()}`,
          payload,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(200);

        const subProgramUpdated = !!await SubProgram
          .countDocuments({ _id: eLearningSubProgramId, status: 'published' });
        expect(subProgramUpdated).toBeTruthy();
        const countCourse = await Course.countDocuments({
          subProgram: eLearningSubProgramId,
          format: 'strictly_e_learning',
          accessRules: payload.accessCompanies,
        });
        expect(countCourse).toBe(1);
      });

    it('should publish strictly e-learning subProgram, '
      + 'and create 100% e-learning course with several companies in accessRules',
    async () => {
      const payload = { status: 'published', accessCompanies: [authCompany._id, otherCompany._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${eLearningSubProgramId.toHexString()}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const subProgramUpdated = !!await SubProgram
        .countDocuments({ _id: eLearningSubProgramId, status: 'published' });
      expect(subProgramUpdated).toBeTruthy();
      const countCourse = await Course.countDocuments({
        subProgram: eLearningSubProgramId,
        format: 'strictly_e_learning',
        accessRules: payload.accessCompanies,
      });
      expect(countCourse).toBe(1);
    });

    it('should publish with empty onSite step', async () => {
      const subProgramId = subProgramsList[7]._id;
      const payload = { status: 'published', accessCompanies: [authCompany._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramId.toHexString()}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const subProgramUpdated = await SubProgram.findById(subProgramId).lean();
      expect(subProgramUpdated).toEqual(expect.objectContaining({ _id: subProgramId, status: 'published' }));
    });

    it('should return a 403 trying to publish with empty eLearning step', async () => {
      const subProgramId = subProgramsList[5]._id;
      const payload = { status: 'published', accessCompanies: [authCompany._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramId.toHexString()}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 trying to publish with empty activity', async () => {
      const subProgramId = subProgramsList[6]._id;
      const payload = { status: 'published', accessCompanies: [authCompany._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramId.toHexString()}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 trying to publish on_site step with empty theoreticalDuration', async () => {
      const subProgramId = subProgramsList[8]._id;
      const payload = { status: 'published', accessCompanies: [authCompany._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramId.toHexString()}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 trying to publish elearning step with empty theoreticalDuration', async () => {
      const subProgramId = subProgramsList[9]._id;
      const payload = { status: 'published', accessCompanies: [authCompany._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramId.toHexString()}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 404 if user tries to publish strictly e-learning subProgram with wrong accessCompany',
      async () => {
        const payload = { status: 'published', accessCompanies: [new ObjectId(), otherCompany._id] };
        const response = await app.inject({
          method: 'PUT',
          url: `/subprograms/${eLearningSubProgramId.toHexString()}`,
          payload,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(404);
      });

    it('should return 400 if setting status to draft ', async () => {
      const payload = { status: 'draft' };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${eLearningSubProgramId.toHexString()}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if name is empty', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${blendedSubProgramId.toHexString()}`,
        payload: { name: '' },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if steps is empty', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${blendedSubProgramId.toHexString()}`,
        payload: { steps: [] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if status is not a status type', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${blendedSubProgramId.toHexString()}`,
        payload: { status: 'qwertyuiop' },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if tryinig to update status and name at the same time', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${blendedSubProgramId.toHexString()}`,
        payload: { name: 'new name', status: 'draft' },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 403 if trying to update a subprogram with status published', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramsList[2]._id.toHexString()}`,
        payload: { name: 'qwertyuiop' },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 400 if step is not from subprogram', async () => {
      const payload = { steps: [subProgramsList[0].steps[1], subProgramsList[0].steps[0]] };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramsList[1]._id.toHexString()}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if accessCompanies in payload is empty', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${eLearningSubProgramId.toHexString()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { accessCompanies: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 409 if a published eLearning subprogram already exist in program', async () => {
      const payload = { status: 'published' };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramsList[3]._id.toHexString()}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 403 if subprogram is invalid', async () => {
      const payload = { status: 'published' };
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramsList[4]._id.toHexString()}`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        const payload = { name: 'un autre nom pour le sous-programme' };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          payload,
          url: `/subprograms/${blendedSubProgramId.toHexString()}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('SUBPROGRAMS ROUTES - POST /subprograms/{_id}/step', () => {
  let authToken;
  beforeEach(populateDB);
  const payload = { name: 'new step', type: 'e_learning' };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create step', async () => {
      const subProgramId = subProgramsList[0]._id;
      const stepsLengthBefore = subProgramsList[0].steps.length;
      const response = await app.inject({
        method: 'POST',
        url: `/subprograms/${subProgramId.toHexString()}/steps`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      const subProgramUpdated = !!await SubProgram
        .countDocuments({ _id: subProgramId, steps: { $size: stepsLengthBefore + 1 } });

      expect(response.statusCode).toBe(200);
      expect(subProgramUpdated).toBeTruthy();
    });

    const missingParams = ['name', 'type'];
    missingParams.forEach((param) => {
      it(`should return a 400 if missing ${param}`, async () => {
        const subProgramId = subProgramsList[0]._id;
        const response = await app.inject({
          method: 'POST',
          url: `/subprograms/${subProgramId.toHexString()}/steps`,
          payload: omit(payload, param),
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return a 404 if subprogram does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/subprograms/${new ObjectId()}/steps`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if trying to add step to a subprogram with status published', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/subprograms/${subProgramsList[2]._id.toHexString()}/steps`,
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const subProgramId = subProgramsList[0]._id;
        const response = await app.inject({
          method: 'POST',
          payload,
          url: `/subprograms/${subProgramId.toHexString()}/steps`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('SUBPROGRAMS ROUTES - PUT /subprograms/{_id}/steps', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should attach one step to subProgram', async () => {
      const subProgramId = subProgramsList[0]._id;
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramsList[0]._id}/steps`,
        payload: { steps: [stepsList[3]._id] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const subProgramUpdated = await SubProgram.countDocuments({ _id: subProgramId, steps: stepsList[3]._id });
      expect(subProgramUpdated).toBeTruthy();
    });

    it('should attach several step to subProgram', async () => {
      const subProgramId = subProgramsList[0]._id;
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramsList[0]._id}/steps`,
        payload: { steps: [stepsList[3]._id, stepsList[4]._id] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const subProgramUpdated = await SubProgram.countDocuments(
        { _id: subProgramId, steps: { $all: [stepsList[3]._id, stepsList[4]._id] } }
      );
      expect(subProgramUpdated).toBeTruthy();
    });

    it('should return a 404 if subProgram does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${new ObjectId()}/steps`,
        payload: { steps: [stepsList[0]._id] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 if step does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramsList[0]._id}/steps`,
        payload: { steps: [stepsList[3]._id, new ObjectId()] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if step is already attached to subProgram', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/subprograms/${subProgramsList[0]._id}/steps`,
        payload: { steps: [stepsList[0]._id, stepsList[2]._id] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
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
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const subProgramId = subProgramsList[0]._id;
        const payload = { steps: stepsList[3]._id };
        const response = await app.inject({
          method: 'PUT',
          payload,
          url: `/subprograms/${subProgramId}/steps`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('SUBPROGRAMS ROUTES - DELETE /subprograms/{_id}/step/{stepId}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should detach step from subprogram', async () => {
      const subProgramId = subProgramsList[0]._id;
      const stepsLengthBefore = subProgramsList[0].steps.length;
      const response = await app.inject({
        method: 'DELETE',
        url: `/subprograms/${subProgramId}/steps/${subProgramsList[0].steps[0]}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const subProgramUpdated = await SubProgram.findOne({ _id: subProgramId }).lean();
      expect(subProgramUpdated.steps.length).toEqual(stepsLengthBefore - 1);
      expect(subProgramUpdated.steps.some(step => step._id === subProgramsList[0].steps[0])).toBeFalsy();
    });

    it('should return a 404 if subprogram does not contain step', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/subprograms/${subProgramsList[0]._id}/steps/${stepsList[4]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if trying to remove step to a subprogram with status published', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/subprograms/${subProgramsList[2]._id}/steps/${subProgramsList[2].steps[0]}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 200 if step is linked to a courseSlot but from another subprogram', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/subprograms/${subProgramsList[6]._id}/steps/${subProgramsList[6].steps[1]}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
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
        const subProgramId = subProgramsList[0]._id;
        const response = await app.inject({
          method: 'DELETE',
          url: `/subprograms/${subProgramId.toHexString()}/steps/${subProgramsList[0].steps[0]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('SUBPROGRAMS ROUTES - GET /subprograms/draft-e-learning', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get all draft and e-learning subprograms', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/subprograms/draft-e-learning',
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const { subPrograms } = response.result.data;
      expect(subPrograms.length).toEqual(2);

      const stepsIds = subPrograms[0].steps.map(step => step._id);
      const countElearningSteps = await Step
        .countDocuments({ _id: { $in: stepsIds }, type: 'e_learning', status: 'draft' });
      expect(countElearningSteps).toBe(stepsIds.length);
    });
  });

  describe('Other roles', () => {
    it('should get draft and e-learning subprograms for which user is a tester', async () => {
      authToken = await getTokenByCredentials(tester.local);
      const response = await app.inject({
        method: 'GET',
        url: '/subprograms/draft-e-learning',
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const { subPrograms } = response.result.data;
      expect(subPrograms.length).toEqual(1);

      const stepsIds = subPrograms[0].steps.map(step => step._id);
      const countElearningSteps = await Step
        .countDocuments({ _id: { $in: stepsIds }, type: 'e_learning', status: 'draft' });
      expect(countElearningSteps).toBe(stepsIds.length);
    });

    const roles = ['helper', 'client_admin', 'trainer'];

    roles.forEach((role) => {
      it(`should return an empty array if ${role} is not a tester`, async () => {
        authToken = await getToken(role);
        const response = await app.inject({
          method: 'GET',
          url: '/subprograms/draft-e-learning',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.subPrograms.length).toEqual(0);
      });
    });
  });
});

describe('SUBPROGRAMS ROUTES - GET /subprograms/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get subprogram', async () => {
      const subProgramId = subProgramsList[3]._id.toHexString();
      const response = await app.inject({
        method: 'GET',
        url: `/subprograms/${subProgramId}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.subProgram._id.toHexString()).toBe(subProgramId);
    });

    it('should return 404 if subprogram does not exists', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/subprograms/${new ObjectId()}`,
        headers: { 'x-access-token': authToken },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    it('should get subprogram if user is tester', async () => {
      authToken = await getTokenByCredentials(tester.local);
      const subProgramId = subProgramsList[3]._id;
      const response = await app.inject({
        method: 'GET',
        url: `/subprograms/${subProgramId.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} if ${role.name} is not allowed to access this subprogram`, async () => {
        authToken = await getToken(role.name);
        const subProgramId = subProgramsList[0]._id;
        const response = await app.inject({
          method: 'GET',
          url: `/subprograms/${subProgramId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
