const { expect } = require('expect');
const sinon = require('sinon');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const {
  populateDB,
  coursesList,
  courseSlotsList,
  stepsList,
  traineeFromOtherCompany,
} = require('./seed/courseSlotsSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { generateFormData, getStream } = require('./utils');
const CourseHistory = require('../../src/models/CourseHistory');
const { SLOT_DELETION, SLOT_EDITION, SLOT_RESTRICTION, SLOT_CREATION } = require('../../src/helpers/constants');
const CourseSlot = require('../../src/models/CourseSlot');
const UtilsHelper = require('../../src/helpers/utils');
const Geocode = require('../../src/models/Geocode');
const {
  holdingAdminFromOtherCompany,
  holdingAdminFromAuthCompany,
  coach,
  auxiliary,
  trainer,
  trainerAndCoach,
} = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COURSE SLOTS ROUTES - GET /courseslots/trainers-billing', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
      process.env.COLLECTIVE_STEP_IDS = new ObjectId();
    });

    it('should return all single course slots on period', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courseslots/trainers-billing?startDate=2020-04-30T22:00:00.000Z&endDate=2020-05-31T21:59:59.999Z',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const result = response.result.data.courseSlots;
      const trainerIds = Object.keys(result);
      const trainerSingleTraineesSlotsByStep = Object.values(result)[0].courses[0].singleTraineeSlots;
      const singleSlots = Object.values(trainerSingleTraineesSlotsByStep)[0].slots;
      expect(trainerIds.length).toBe(1);
      expect(singleSlots.length).toBe(2);
    });

    it('should return 400 if start date is after end date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courseslots/trainers-billing?startDate=2020-04-30T22:00:00.000Z&endDate=2020-03-31T21:59:59.999Z',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if missing date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courseslots/trainers-billing?startDate=2020-04-30T22:00:00.000Z',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if trainerId doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courseslots/trainers-billing?startDate=2020-04-30T22:00:00.000Z&endDate=2020-05-31T21:59:59.999Z'
          + `&trainerId=${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(trainerAndCoach.local);
      process.env.COLLECTIVE_STEP_IDS = new ObjectId();
    });

    it('should return all single course slots on period for trainer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courseslots/trainers-billing?startDate=2020-04-30T22:00:00.000Z&endDate=2020-05-31T21:59:59.999Z'
          + `&trainerId=${trainerAndCoach._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const result = response.result.data.courseSlots;
      const trainerIds = Object.keys(result);
      const trainerSingleTraineesSlotsByStep = Object.values(result)[0].courses[0].singleTraineeSlots;
      const singleSlots = Object.values(trainerSingleTraineesSlotsByStep)[0].slots;
      expect(trainerIds.length).toBe(1);
      expect(singleSlots.length).toBe(2);
    });

    it('should return 400 if no trainerId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courseslots/trainers-billing?startDate=2020-04-30T22:00:00.000Z&endDate=2020-05-31T21:59:59.999Z',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if trainerId is not logged user id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/courseslots/trainers-billing?startDate=2020-04-30T22:00:00.000Z&endDate=2020-05-31T21:59:59.999Z'
          + `&trainerId=${trainer._id}`,
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
    ];
    roles.forEach((role) => {
      it(`should return 403 for role ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/courseslots/trainers-billing?startDate=2020-04-30T22:00:00.000Z&endDate=2020-05-31T21:59:59.999Z',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });
        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE SLOTS ROUTES - POST /courseslots', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create course slot to plan for a specific step', async () => {
      const payload = { course: courseSlotsList[0].course, step: stepsList[0]._id, quantity: 2 };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if course is archived', async () => {
      const payload = { course: courseSlotsList[5].course, step: stepsList[4]._id, quantity: 3 };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if step is eLearning', async () => {
      const payload = { course: coursesList[0]._id, step: stepsList[1]._id };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if step is not from program', async () => {
      const payload = { course: coursesList[0]._id, step: stepsList[3]._id };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    const missingParams = ['course', 'step'];
    missingParams.forEach((param) => {
      it(`should return a 400 error if missing '${param}' parameter`, async () => {
        const payload = { step: stepsList[0]._id, course: coursesList[0]._id };
        const response = await app.inject({
          method: 'POST',
          url: '/courseslots',
          payload: omit({ ...payload }, param),
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    const wrongQuantity = [0, -2, 1.5];
    wrongQuantity.forEach((q) => {
      it('should return 400 if quantity is not a positive integer', async () => {
        const payload = { course: courseSlotsList[0].course, step: stepsList[0]._id, quantity: q };

        const response = await app.inject({
          method: 'POST',
          url: '/courseslots',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should 200 as user is course trainer', async () => {
      const payload = { course: coursesList[0]._id, step: stepsList[0]._id, quantity: 2 };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });
      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is not course trainer', async () => {
      const payload = { course: coursesList[1]._id, step: stepsList[0]._id, quantity: 2 };

      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    it('should return 403 as user is coach from course company', async () => {
      const payload = { course: coursesList[0]._id, step: stepsList[0]._id, quantity: 2 };
      authToken = await getToken('coach');
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        const payload = { course: coursesList[1]._id, step: stepsList[0]._id, quantity: 2 };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/courseslots',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE SLOTS ROUTES - PUT /courseslots/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update on site course slot (intra)', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
        trainers: [trainer._id],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[0].course,
        'update.startDate.to': payload.startDate,
        action: SLOT_EDITION,
      });

      expect(courseHistory).toEqual(1);
    });

    it('should update course slot (intra_holding)', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[10]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 as trainer was course trainer', async () => {
      const payload = {
        startDate: '2020-04-10T09:00:00.000Z',
        endDate: '2020-04-10T11:00:00.000Z',
        trainers: [trainer._id],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[9]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update remote course slot (intra)', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        meetingLink: 'https://meet.ology.com',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[8]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[8].course,
        'update.startDate.to': payload.startDate,
        action: SLOT_EDITION,
      });

      expect(courseHistory).toEqual(1);
    });

    it('should remove dates', async () => {
      const payload = { startDate: '', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[8]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[8].course,
        'slot.startDate': courseSlotsList[8].startDate,
        'slot.endDate': courseSlotsList[8].endDate,
        'slot.meetingLink': courseSlotsList[8].meetingLink,
        action: SLOT_DELETION,
      });

      const slot = await CourseSlot.countDocuments({
        course: courseSlotsList[8].course,
        startDate: courseSlotsList[8].startDate,
        endDate: courseSlotsList[8].endDate,
        meetingLink: courseSlotsList[8].meetingLink,
      });
      const slotListCount = await CourseSlot.countDocuments();

      expect(courseHistory).toEqual(1);
      expect(slot).toBeFalsy();
      expect(slotListCount).toEqual(courseSlotsList.length);
    });

    it('should plan slot', async () => {
      const payload = {
        startDate: '2020-06-14T09:00:00',
        endDate: '2020-06-14T11:00:00',
        trainers: [trainerAndCoach._id],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[6]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should add slot for whole day', async () => {
      const payload = {
        startDate: '2020-03-04T08:00:00.000Z',
        endDate: '2020-03-04T11:30:00.000Z',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
        wholeDay: true,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[1]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const afternoonSlot = await CourseSlot.countDocuments({
        course: courseSlotsList[1].course,
        startDate: '2020-03-04T12:30:00.000Z',
        endDate: '2020-03-04T16:00:00.000Z',
      });
      expect(afternoonSlot).toEqual(1);

      const editionHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[1].course,
        'update.startHour.to': payload.startDate,
        action: SLOT_EDITION,
      });
      expect(editionHistory).toEqual(1);

      const creationHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[1].course,
        'slot.startDate': '2020-03-04T12:30:00.000Z',
        'slot.endDate': '2020-03-04T16:00:00.000Z',
        action: SLOT_CREATION,
      });
      expect(creationHistory).toEqual(1);
    });

    it('should add concerned trainees', async () => {
      const payload = { trainees: [coach._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[0].course,
        'slot.startDate': courseSlotsList[0].startDate,
        'slot.endDate': courseSlotsList[0].endDate,
        action: SLOT_RESTRICTION,
      });

      const slot = await CourseSlot.countDocuments({
        course: courseSlotsList[0].course,
        startDate: courseSlotsList[0].startDate,
        endDate: courseSlotsList[0].endDate,
        trainees: [coach._id],
      });

      expect(courseHistory).toEqual(1);
      expect(slot).toBeTruthy();
    });

    it('should remove concerned trainees', async () => {
      const payload = { trainees: [coach._id, auxiliary._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[1]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[1].course,
        'slot.startDate': courseSlotsList[1].startDate,
        'slot.endDate': courseSlotsList[1].endDate,
        action: SLOT_RESTRICTION,
      });

      const slot = await CourseSlot.countDocuments({
        course: courseSlotsList[1].course,
        startDate: courseSlotsList[1].startDate,
        endDate: courseSlotsList[1].endDate,
        trainees: { $exists: false },
      });

      expect(courseHistory).toEqual(1);
      expect(slot).toBeTruthy();
    });

    it('should return 400 if update dates and trainees', async () => {
      const payload = { trainees: [coach._id], startDate: '', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if trainees are empty', async () => {
      const payload = { trainees: [] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if try to add slot on whole day but start and end hour are incorrect', async () => {
      const payload = {
        startDate: '2020-03-04T08:00:00.000Z',
        endDate: '2020-03-04T12:30:00.000Z',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
        wholeDay: true,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if course is archived', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[5]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try add concerned trainees on single course', async () => {
      const payload = { trainees: [traineeFromOtherCompany._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[3]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if trainee not in course', async () => {
      const payload = { trainees: [traineeFromOtherCompany._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if one trainer is not in course (intra)', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
        trainers: [trainer._id, new ObjectId()],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 as trying to remove dates and course slot has attendances', async () => {
      const payload = { startDate: '', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[7]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual('Impossible: ce créneau de formation est émargé.');
    });

    it('should return 403 as trying to edit dates and course slot has attendances', async () => {
      const payload = { startDate: '2020-05-10T10:00:00', endDate: '2020-05-10T11:00:00' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[7]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual('Impossible: ce créneau de formation est émargé.');
    });

    it('should return 403 as trying to edit trainers and course slot has attendances', async () => {
      const payload = { startDate: '2020-05-13T09:00:00', endDate: '2020-05-13T12:00:00', trainers: [trainer._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[7]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
      expect(response.result.message).toEqual('Impossible: ce créneau de formation est émargé.');
    });

    it('should return 403 as trying to update dates and course slot has attendance sheet', async () => {
      const payload = { startDate: '2020-03-04T09:00:00', endDate: '2020-03-04T11:00:00' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[12]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to remove dates and course slot has attendance sheet', async () => {
      const payload = { startDate: '', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[12]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to add concerned trainees and course slot has attendance sheet', async () => {
      const payload = { trainees: [auxiliary._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[14]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to remove dates and course slot has completion certificate', async () => {
      const payload = { startDate: '', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[13]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to update dates and course slot has completion certificate', async () => {
      const payload = { startDate: '2020-05-10T09:00:00', endDate: '2020-05-10T11:00:00' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[13]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to update dates on completion certificate month', async () => {
      const payload = { startDate: '2020-05-14T09:00:00', endDate: '2020-05-14T11:00:00' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[6]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to add concerned trainees on completion certificate month', async () => {
      const payload = { trainees: [coach._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[15]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if slots conflict', async () => {
      const payload = {
        startDate: courseSlotsList[0].startDate,
        endDate: courseSlotsList[0].endDate,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[1]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 409 if try to create slot on whole day but slot conflict', async () => {
      const payload = {
        startDate: '2020-03-10T08:00:00.000Z',
        endDate: '2020-03-10T11:30:00.000Z',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
        wholeDay: true,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 400 if remove only one date', async () => {
      const payload = { startDate: '2020-03-04T09:00:00', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[8]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if endDate without startDate', async () => {
      const payload = {
        endDate: '2020-03-04T09:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if startDate without endDate', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if startDate is not on same day as endDate', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-05T12:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if startDate after endDate', async () => {
      const payload = {
        startDate: '2020-03-04T15:00:00',
        endDate: '2020-03-04T12:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if slot not found', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if slot is remote but address is in payload', async () => {
      const payload = {
        startDate: '2020-01-04T17:00:00',
        endDate: '2020-01-04T20:00:00',
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[8]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if step is on site but meetingLink is in payload', async () => {
      const payload = {
        startDate: '2020-01-04T17:00:00',
        endDate: '2020-01-04T20:00:00',
        meetingLink: 'meet.google.com',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('HOLDING_ADMIN', () => {
    it('should update course slot (intra)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[9]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update course slot (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[10]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update course slot (intra_holding without companies)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromAuthCompany.local);
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[11]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if try to update course slot and user company is not in holding (intra)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[5]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if user from other holding try to update course slot (intra_holding)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        address: {
          street: '39 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[10]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to update concerned trainees', async () => {
      const payload = { trainees: [coach._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if user try to edit trainers in course slot (intra)', async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
      const payload = {
        startDate: '2020-03-04T09:00:00.000Z',
        endDate: '2020-03-04T11:00:00.000Z',
        trainers: [trainer._id],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[9]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('COACH', () => {
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should update course slot (intra)', async () => {
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update course slot (intra_holding)', async () => {
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[10]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if user from other company try to update course slot (intra)', async () => {
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if user try to update slot from course with good holding but without company (intra_holding)',
      async () => {
        const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
        const response = await app.inject({
          method: 'PUT',
          url: `/courseslots/${courseSlotsList[11]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(403);
      });

    it('should return 403 if user try to edit trainers in course slot (intra)', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00.000Z',
        endDate: '2020-03-04T11:00:00.000Z',
        trainers: [trainer._id],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return 200 as user is course trainer', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00.000Z',
        endDate: '2020-03-04T11:00:00.000Z',
        trainers: [trainer._id],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[2]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is trainer but not course trainer', async () => {
      authToken = await getToken('trainer');
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[3]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should add concerned trainees', async () => {
      const payload = { trainees: [coach._id] };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 as user is course trainer but his credentials are not in trainers', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00.000Z',
        endDate: '2020-03-04T11:00:00.000Z',
        trainers: [trainerAndCoach._id],
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[2]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload,
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
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/courseslots/${courseSlotsList[3]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE SLOTS ROUTES - DELETE /courseslots/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete course slot without dates', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[6]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const deletedSlot = await CourseSlot.countDocuments({ _id: courseSlotsList[6]._id });
      const courseHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[6].course,
        action: SLOT_DELETION,
      });

      expect(deletedSlot).toEqual(0);
      expect(courseHistory).toEqual(0);
    });

    it('should return 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[5]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if only slot in step', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[7]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if slot not found', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if slot has an attendance', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[4]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should return 200 as user is course trainer', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[2]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 as user is not course trainer', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[3]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    it('should return 403 as user is client admin from course company', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courseslots/${courseSlotsList[3]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE SLOTS ROUTES - POST /courseslots/csv', () => {
  let authToken;
  let parseCSV;
  let geocodeSearch;

  beforeEach(populateDB);
  beforeEach(() => {
    parseCSV = sinon.stub(UtilsHelper, 'parseCsv');
    geocodeSearch = sinon.stub(Geocode, 'search');
  });
  afterEach(() => {
    parseCSV.restore();
    geocodeSearch.restore();
  });

  const injectCsv = async (courseId, rows, token) => {
    const form = generateFormData({ course: courseId.toString(), file: 'test' });
    parseCSV.returns(rows);

    return app.inject({
      method: 'POST',
      url: '/courseslots/csv',
      headers: { ...form.getHeaders(), Cookie: `${process.env.ALENVI_TOKEN}=${token}` },
      payload: getStream(form),
    });
  };

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a new course slot from csv', async () => {
      const slotsCountBefore = await CourseSlot.countDocuments({ course: coursesList[0]._id, step: stepsList[0]._id });

      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(200);
      const slotsCountAfter = await CourseSlot.countDocuments({ course: coursesList[0]._id, step: stepsList[0]._id });
      expect(slotsCountAfter).toBe(slotsCountBefore + 1);
    });

    it('should reuse an existing slot to plan and set trainees', async () => {
      const response = await injectCsv(coursesList[1]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainercoach@alenvi.io',
        trainees: 'traineeOtherCompany@alenvi.fr',
      }], authToken);

      expect(response.statusCode).toBe(200);
      const updatedSlot = await CourseSlot.findOne({ _id: courseSlotsList[6]._id }).lean();
      expect(updatedSlot.startDate).toBeDefined();
    });

    it('should geocode address for an on site slot', async () => {
      geocodeSearch.resolves({
        data: {
          features: [{
            properties: {
              label: '37 rue de Ponthieu 75008 Paris',
              name: '37 rue de Ponthieu',
              postcode: '75008',
              city: 'Paris',
              score: 0.9,
            },
            geometry: { type: 'Point', coordinates: [2.31, 48.87] },
          }],
        },
      });

      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '37 rue de Ponthieu 75008 Paris',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(200);
      const newSlot = await CourseSlot
        .findOne({ course: coursesList[0]._id, step: stepsList[0]._id, startDate: '2021-01-12T08:00:00.000Z' })
        .lean();
      expect(newSlot.address.fullAddress).toBe('37 rue de Ponthieu 75008 Paris');
    });

    it('should return 400 if csv columns are wrong', async () => {
      const response = await injectCsv(
        coursesList[0]._id,
        [{ step: stepsList[0].name, startDate: '2021-01-12T09:00:00' }],
        authToken
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if too many slots in file', async () => {
      const slotList = [];
      for (let i = 0; i <= process.env.MAX_CSV_COURSE_SIZE; i++) {
        slotList.push({
          step: stepsList[0].name,
          startDate: '2021-01-12T09:00:00',
          endDate: '2021-01-12T11:00:00',
          address: '',
          meetingLink: '',
          trainers: 'trainer@alenvi.io',
          trainees: '',
        });
      }

      const response = await injectCsv(coursesList[0]._id, slotList, authToken);

      expect(response.statusCode).toBe(403);
    });

    it('should return 422 if step doesn\'t exist', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: 'etape inconnue',
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if trainer is not linked to course', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'coach@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if trainee is not registered to course', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: 'traineeOtherCompany@alenvi.fr',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if slot is in conflict with an existing slot', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2020-03-10T10:00:00.000Z',
        endDate: '2020-03-10T11:00:00.000Z',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if address is given for a remote step', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[4].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '37 rue de Ponthieu 75008 Paris',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
      sinon.assert.notCalled(geocodeSearch);
    });

    it('should return 422 if step is eLearning', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[1].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if a date is incorrect', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: 'not-a-date',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if startDate and endDate are not on the same day', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-13T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if startDate is after endDate', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T11:00:00',
        endDate: '2021-01-12T09:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if both address and meetingLink are given', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '37 rue de Ponthieu 75008 Paris',
        meetingLink: 'https://meet.google.com',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if meetingLink is given for an on site step', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: 'https://meet.google.com',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if address is not found by geocoding', async () => {
      geocodeSearch.resolves({ data: { features: [] } });

      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: 'adresse qui n\'existe pas',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if the geocoding service is unreachable', async () => {
      geocodeSearch.rejects(new Error('getaddrinfo ENOTFOUND data.geopf.fr'));

      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '37 rue de Ponthieu 75008 Paris',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if trainers is missing', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: '',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if trainer email is incorrect', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'not-an-email',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if trainer doesn\'t exist', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'ghost@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if trainee email is incorrect', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: 'not-an-email',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 422 if trainee doesn\'t exist', async () => {
      const response = await injectCsv(coursesList[0]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: 'ghost@alenvi.io',
      }], authToken);

      expect(response.statusCode).toBe(422);
      expect(response.result.errorsBySlot['Créneau 1']).toBeDefined();
    });

    it('should return 403 if course is archived', async () => {
      const response = await injectCsv(coursesList[2]._id, [{
        step: stepsList[0].name,
        startDate: '2021-01-12T09:00:00',
        endDate: '2021-01-12T11:00:00',
        address: '',
        meetingLink: '',
        trainers: 'trainer@alenvi.io',
        trainees: '',
      }], authToken);

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
      { name: 'trainer', expectedCode: 200 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);

        const response = await injectCsv(coursesList[0]._id, [{
          step: stepsList[0].name,
          startDate: '2021-01-12T09:00:00',
          endDate: '2021-01-12T11:00:00',
          address: '',
          meetingLink: '',
          trainers: 'trainer@alenvi.io',
          trainees: '',
        }], authToken);

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
