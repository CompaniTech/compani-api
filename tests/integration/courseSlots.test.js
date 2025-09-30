const { expect } = require('expect');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const app = require('../../server');
const { populateDB, coursesList, courseSlotsList, trainer, stepsList } = require('./seed/courseSlotsSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const CourseHistory = require('../../src/models/CourseHistory');
const { SLOT_DELETION, SLOT_EDITION } = require('../../src/helpers/constants');
const CourseSlot = require('../../src/models/CourseSlot');
const { holdingAdminFromOtherCompany, holdingAdminFromAuthCompany } = require('../seed/authUsersSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
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
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if course is archived', async () => {
      const payload = { course: courseSlotsList[5].course, step: stepsList[4]._id, quantity: 3 };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if step is eLearning', async () => {
      const payload = { course: coursesList[0]._id, step: stepsList[1]._id };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if step is not from program', async () => {
      const payload = { course: coursesList[0]._id, step: stepsList[3]._id };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
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
          headers: { Cookie: `alenvi_token=${authToken}` },
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
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    it('should return 403 as user is course trainer', async () => {
      const payload = { course: coursesList[1]._id, step: stepsList[0]._id };
      authToken = await getTokenByCredentials(trainer.local);
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is coach from course company', async () => {
      const payload = { course: coursesList[0]._id, step: stepsList[0]._id };
      authToken = await getToken('coach');
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        const payload = { course: coursesList[1]._id, step: stepsList[0]._id };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/courseslots',
          headers: { Cookie: `alenvi_token=${authToken}` },
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
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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

    it('should return 403 if course is archived', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[5]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to remove dates and course slot has attendances', async () => {
      const payload = { startDate: '', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to update dates and course slot has attendance sheet', async () => {
      const payload = { startDate: '2020-03-04T09:00:00', endDate: '2020-03-04T11:00:00' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[12]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to remove dates and course slot has attendance sheet', async () => {
      const payload = { startDate: '', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[12]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to remove dates and course slot has completion certificate', async () => {
      const payload = { startDate: '', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[13]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to update dates and course slot has completion certificate', async () => {
      const payload = { startDate: '2020-05-10T09:00:00', endDate: '2020-05-10T11:00:00' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[13]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as trying to update dates on completion certificate month', async () => {
      const payload = { startDate: '2020-05-14T09:00:00', endDate: '2020-05-14T11:00:00' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[6]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 400 if remove only one date', async () => {
      const payload = { startDate: '2020-03-04T09:00:00', endDate: '' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[8]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update course slot (intra_holding)', async () => {
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[10]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if user from other company try to update course slot (intra)', async () => {
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
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
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(403);
      });
  });

  describe('TRAINER', () => {
    it('should return 200 as user is course trainer', async () => {
      authToken = await getTokenByCredentials(trainer.local);
      const payload = { startDate: '2020-03-04T09:00:00.000Z', endDate: '2020-03-04T11:00:00.000Z' };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
          headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
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
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if only slot in step', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[7]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if slot not found', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if slot has an attendance', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('Other roles', () => {
    it('should return a 403 as user is course trainer', async () => {
      authToken = await getTokenByCredentials(trainer.local);
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 as user is client admin from course company', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

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
          url: `/courseslots/${courseSlotsList[3]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
