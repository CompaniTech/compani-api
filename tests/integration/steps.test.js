const { expect } = require('expect');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const Step = require('../../src/models/Step');
const { populateDB, programsList, stepsList, activitiesList, cardsList } = require('./seed/stepsSeed');
const Activity = require('../../src/models/Activity');
const { getToken } = require('./helpers/authentication');
const UtilsHelper = require('../../src/helpers/utils');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('STEPS ROUTES - PUT /steps/{_id}', () => {
  let authToken;
  beforeEach(populateDB);
  const stepId = stepsList[0]._id;

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update step name', async () => {
      const payload = { name: 'une nouvelle étape super innovante' };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const updatedStep = await Step.findOne({ _id: stepsList[0]._id }, { name: 1 }).lean();
      expect(updatedStep.name).toBe('une nouvelle étape super innovante');
    });

    it('should update step name even if step is published', async () => {
      const payload = { name: 'une nouvelle étape super innovante' };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepsList[3]._id}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const updatedStepCount = await Step.countDocuments({
        _id: stepsList[3]._id,
        name: 'une nouvelle étape super innovante',
      });
      expect(updatedStepCount).toBe(1);
    });

    it('should change activities order', async () => {
      const payload = { activities: [stepsList[1].activities[1], stepsList[1].activities[0]] };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepsList[1]._id}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      const stepUpdated = await Step.findById(stepsList[1]._id).lean();

      expect(response.statusCode).toBe(200);
      expect(stepUpdated).toEqual(expect.objectContaining({ _id: stepsList[1]._id, activities: payload.activities }));
    });

    it('should update theoreticalDuration with positive float', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}`,
        payload: { theoreticalDuration: 'PT5040S' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const stepUpdated = await Step.countDocuments({ _id: stepId, theoreticalDuration: 5040 });

      expect(stepUpdated).toBeTruthy();
    });

    it('should update theoreticalDuration even if step is published', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepsList[3]._id}`,
        payload: { theoreticalDuration: 'PT5400S' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const stepUpdated = await Step.countDocuments({
        _id: stepsList[3]._id,
        status: 'published',
        theoreticalDuration: 5400,
      });

      expect(stepUpdated).toBeTruthy();
    });

    it('should return 400 if theoreticalDuration is 0', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}`,
        payload: { theoreticalDuration: 'PT0S' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if theoreticalDuration is negative', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}`,
        payload: { theoreticalDuration: 'PT-432S' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 404 if step is invalid', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${new ObjectId()}`,
        payload: { name: 'une nouvelle étape super innovante' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if step is published and payload has activities', async () => {
      const payload = { activities: [stepsList[1].activities[0]], name: 'skusku' };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepsList[3]._id}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 400 if payload is empty', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}`,
        payload: {},
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if name is empty ', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}`,
        payload: { name: '' },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if activities\' lengths from db and payload are not equal', async () => {
      const payload = { activities: [stepsList[0].activities[1]] };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if activities from payload and from db are not strict equal', async () => {
      const payload = { activities: [stepsList[0].activities[1], new ObjectId()] };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const payload = { name: 'une nouvelle étape super innovante' };
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
          payload,
          url: `/steps/${stepId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('STEPS ROUTES - POST /steps/{_id}/activity', () => {
  let authToken;
  beforeEach(populateDB);
  const step = stepsList[1];

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create activity', async () => {
      const payload = { name: 'new activity', type: 'video' };
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${step._id}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      const stepUpdated = await Step.findById(step._id).lean();

      expect(response.statusCode).toBe(200);
      expect(stepUpdated._id).toEqual(step._id);
      expect(stepUpdated.activities.length).toEqual(step.activities.length + 1);
    });

    ['name', 'type'].forEach((missingParam) => {
      it('should return a 400 if missing required param', async () => {
        const payload = { name: 'new activity', type: 'video' };
        const response = await app.inject({
          method: 'POST',
          url: `/steps/${step._id}/activities`,
          payload: omit(payload, missingParam),
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    it('should return a 400 if invalid type', async () => {
      const payload = { name: 'new activity', type: 'video' };
      const wrongPayload = { ...payload, type: 'something_wrong' };
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${step._id}/activities`,
        payload: wrongPayload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should duplicate an activity', async () => {
      const duplicatedActivityId = activitiesList[0]._id;
      const duplicatedCardId = cardsList[0]._id;
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${step._id}/activities`,
        payload: { activityId: duplicatedActivityId },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      const stepUpdated = await Step.findById(step._id)
        .populate({
          path: 'activities',
          select: '-__v -createdAt -updatedAt -status',
          populate: { path: 'cards', select: '-__v -createdAt -updatedAt' },
        })
        .lean();

      expect(response.statusCode).toBe(200);
      expect(stepUpdated).toEqual(expect.objectContaining({
        _id: step._id,
        name: 'etape 2',
        type: 'e_learning',
        status: 'draft',
        activities: expect.arrayContaining([
          {
            _id: expect.any(Object),
            type: 'lesson',
            name: 'chanter',
            cards: expect.arrayContaining([
              { _id: expect.any(Object), template: 'transition', title: 'do mi sol do' },
            ]),
          },
        ]),
      }));
      expect(stepUpdated.activities[0]._id).not.toBe(duplicatedActivityId);
      expect(stepUpdated.activities[0].cards[0]._id).not.toBe(duplicatedCardId);
    });

    it('Duplicated activity should have status draft', async () => {
      const duplicatedActivityId = activitiesList[3]._id;
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${step._id}/activities`,
        payload: { activityId: duplicatedActivityId },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      const stepUpdated = await Step.findById(step._id)
        .populate({
          path: 'activities',
          select: '-__v -createdAt -updatedAt',
          populate: { path: 'cards', select: '-__v -createdAt -updatedAt' },
        })
        .lean();

      const duplicatedActivity = await Activity.findById(duplicatedActivityId).lean();

      expect(response.statusCode).toBe(200);
      expect(stepUpdated.activities.find(activity => activity.name === 'published activity').status).toBe('draft');
      expect(duplicatedActivity.status).toBe('published');
    });

    it('should return a 400 if duplicated activity with name in payload', async () => {
      const duplicatedActivityId = activitiesList[3]._id;
      const payload = { name: 'new activity', activityId: duplicatedActivityId };
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${step._id}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if duplicated activity with type in payload', async () => {
      const duplicatedActivityId = activitiesList[3]._id;
      const payload = { type: 'video', activityId: duplicatedActivityId };
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${step._id}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 404 if step does not exist', async () => {
      const payload = { name: 'new activity', type: 'video' };
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${new ObjectId()}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if step is not elearning', async () => {
      const duplicatedActivityId = activitiesList[0]._id;
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${stepsList[0]._id}/activities`,
        payload: { activityId: duplicatedActivityId },
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if step is published', async () => {
      const payload = { name: 'new activity', type: 'video' };
      const response = await app.inject({
        method: 'POST',
        url: `/steps/${stepsList[3]._id}/activities`,
        payload,
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
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const payload = { name: 'new activity', type: 'video' };
        const response = await app.inject({
          method: 'POST',
          payload,
          url: `/steps/${step._id}/activities`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('STEPS ROUTES - PUT /steps/{_id}/activities', () => {
  let authToken;
  beforeEach(populateDB);
  const stepId = stepsList[1]._id;

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should push a reused activity', async () => {
      const payload = { activities: activitiesList[1]._id };
      const reusedActivityId = activitiesList[1]._id;
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      const stepUpdated = await Step.findById(stepId)
        .populate({
          path: 'activities',
          select: '-__v -createdAt -updatedAt -status',
          populate: { path: 'cards', select: '-__v -createdAt -updatedAt' },
        })
        .lean();

      expect(response.statusCode).toBe(200);
      expect(stepUpdated.activities.some(act => UtilsHelper.areObjectIdsEquals(act._id, reusedActivityId)))
        .toBeTruthy();
    });

    it('should return a 400 if missing activities in payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}/activities`,
        payload: {},
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 404 if invalid step id', async () => {
      const payload = { activities: activitiesList[0]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${new ObjectId()}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if step is not elearning', async () => {
      const payload = { activities: activitiesList[0]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepsList[0]._id}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if step is published', async () => {
      const payload = { activities: activitiesList[0]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepsList[3]._id}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 404 if invalid activity id', async () => {
      const payload = { activities: (new ObjectId()) };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 400 if reused activity is from the same step', async () => {
      const payload = { activities: activitiesList[0]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/steps/${stepId}/activities`,
        payload,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const payload = { activities: activitiesList[0]._id };
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
          payload,
          url: `/steps/${stepId}/activities`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('STEPS ROUTES - DELETE /steps/{_id}/activities/{activityId}', () => {
  let authToken;
  const step = stepsList[1];
  const activityId = activitiesList[0]._id;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should detach activity from step', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/steps/${step._id}/activities/${activityId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      const stepUpdated = await Step.findById(step._id).lean();
      const detachedActivity = await Activity.countDocuments({ _id: activityId });

      expect(response.statusCode).toBe(200);
      expect(stepUpdated._id).toEqual(step._id);
      expect(stepUpdated.activities.length).toEqual(step.activities.length - 1);
      expect(detachedActivity).toEqual(1);
    });

    it('should return a 404 if step doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/steps/${new ObjectId()}/activities/${activityId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 if step doesn\'t have the specified activities', async () => {
      const invalidActivityId = activitiesList[1]._id;
      const response = await app.inject({
        method: 'DELETE',
        url: `/steps/${step._id}/activities/${invalidActivityId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if step is published', async () => {
      const payload = { activities: activitiesList[0]._id };
      const response = await app.inject({
        method: 'DELETE',
        url: `/steps/${stepsList[3]._id}/activities/${activitiesList[3]._id}`,
        payload,
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
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/steps/${step._id}/activities/${activityId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('STEPS ROUTES - GET /steps', () => {
  let authToken;
  const programId = programsList[0]._id;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get steps linked to program', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/steps?program=${programId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.steps.length).toEqual(3);
      expect(response.result.data.steps).toEqual(expect.arrayContaining([
        { _id: expect.any(Object), name: 'etape 1', type: 'on_site' },
        { _id: expect.any(Object), name: 'etape 2', type: 'e_learning' },
        { _id: expect.any(Object), name: 'etape 3', type: 'e_learning' },
      ]));
    });

    it('should return a 404 if program doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/steps?program=${new ObjectId()}`,
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
          method: 'GET',
          url: `/steps?program=${programId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
