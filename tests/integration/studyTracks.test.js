const { expect } = require('expect');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const StudyTrack = require('../../src/models/StudyTrack');
const { populateDB, stepsList, subProgramsList } = require('./seed/studyTracksSeed');
const { getToken } = require('./helpers/authentication');
const { TRAINEE, VAEI_COACH, TUTOR, ARCHITECT } = require('../../src/helpers/constants');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('STUDY TRACKS ROUTES - POST /studytracks', () => {
  let authToken;
  beforeEach(populateDB);
  const payload = {
    name: 'Nouveau parcours',
    subProgram: subProgramsList[0]._id,
    detailsPerStep: [
      { step: stepsList[0]._id, durations: [3600, 16200], targets: [VAEI_COACH, TUTOR] },
      { step: stepsList[1]._id, durations: [0, 7200] },
    ],
    eLearningDurations: [1800, 1800],
    milestones: [
      { month: 0, label: 'Lancement', targets: [TRAINEE, VAEI_COACH] },
      { month: 0, label: 'Point d\'étape', targets: [TUTOR] },
      { month: 1, label: 'Bilan', targets: [TRAINEE, ARCHITECT] },
    ],
  };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create the default study track of a sub-program', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const studyTrack = await StudyTrack.countDocuments({ ...payload, isDefault: true });
      expect(studyTrack).toBe(1);
    });

    it('should return a 400 if subProgram is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: omit(payload, 'subProgram'),
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if a milestone target is not allowed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: {
          ...payload,
          milestones: [{ month: 0, label: 'Lancement', targets: ['cible inconnue'] }],
        },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if a step target is not allowed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: {
          ...payload,
          detailsPerStep: [{ ...payload.detailsPerStep[0], targets: [TRAINEE] }, payload.detailsPerStep[1]],
        },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if a duration is negative', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: { ...payload, eLearningDurations: [-1, 1800] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if durations do not have the same number of months', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: { ...payload, eLearningDurations: [1800] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if a step has no duration greater than 0', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: { ...payload, eLearningDurations: [0, 0] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if a milestone month exceeds the number of months', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: {
          ...payload,
          milestones: [{ month: 2, label: 'Trop tard', targets: [VAEI_COACH] }],
        },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 404 if sub-program does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: { ...payload, subProgram: new ObjectId() },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if sub-program is not published', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: {
          ...payload,
          subProgram: subProgramsList[2]._id,
          detailsPerStep: [{ step: stepsList[0]._id, durations: [3600, 16200] }],
          eLearningDurations: undefined,
        },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 409 if name already exists for this sub-program', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: {
          name: 'PARCOURS TYPE',
          subProgram: subProgramsList[1]._id,
          detailsPerStep: [{ step: stepsList[3]._id, durations: [3600] }],
        },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 409 if sub-program already has a default study track', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: {
          name: 'Un autre nom',
          subProgram: subProgramsList[1]._id,
          detailsPerStep: [{ step: stepsList[3]._id, durations: [3600] }],
        },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 403 if a step of the sub-program is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: { ...payload, detailsPerStep: [payload.detailsPerStep[0]] },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if a step is not in the sub-program', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: {
          ...payload,
          detailsPerStep: [payload.detailsPerStep[0], { step: stepsList[3]._id, durations: [0, 7200] }],
        },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if e-learning durations are defined but sub-program has no e-learning step', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: {
          ...payload,
          subProgram: subProgramsList[3]._id,
          detailsPerStep: [payload.detailsPerStep[0]],
        },
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if e-learning durations are missing but sub-program has an e-learning step', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/studytracks',
        payload: omit(payload, 'eLearningDurations'),
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
      { name: 'trainer', expectedCode: 200 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/studytracks',
          payload,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
