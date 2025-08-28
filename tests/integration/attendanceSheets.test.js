const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const GCloudStorageHelper = require('../../src/helpers/gCloudStorage');
const NotificationHelper = require('../../src/helpers/notifications');
const UtilsHelper = require('../../src/helpers/utils');
const app = require('../../server');
const { populateDB, coursesList, attendanceSheetList, slotsList, userList } = require('./seed/attendanceSheetsSeed');
const { getToken, getTokenByCredentials } = require('./helpers/authentication');
const { generateFormData, getStream } = require('./utils');
const { WEBAPP, MOBILE, GENERATION } = require('../../src/helpers/constants');
const { CompaniDate } = require('../../src/helpers/dates/companiDates');
const AttendanceSheet = require('../../src/models/AttendanceSheet');
const { holdingAdminFromOtherCompany, trainerAndCoach, trainer } = require('../seed/authUsersSeed');
const { authCompany, otherCompany, otherHolding, authHolding } = require('../seed/authCompaniesSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('ATTENDANCE SHEETS ROUTES - POST /attendancesheets', () => {
  let authToken;
  let uploadCourseFile;
  let sendNotificationToUser;

  describe('TRAINER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('trainer');
      uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
      sendNotificationToUser = sinon.stub(NotificationHelper, 'sendNotificationToUser');
    });
    afterEach(() => {
      uploadCourseFile.restore();
      sendNotificationToUser.restore();
    });

    it('should upload attendance sheet to intra course (webapp)', async () => {
      const formData = {
        course: coursesList[0]._id.toHexString(),
        file: 'test',
        date: new Date('2020-01-23').toISOString(),
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      const attendanceSheetsLengthBefore = await AttendanceSheet
        .countDocuments({ course: coursesList[0]._id, origin: WEBAPP });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet
        .countDocuments({ course: coursesList[0]._id, origin: WEBAPP });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should upload attendance sheet with origin mobile if no info in payload', async () => {
      const formData = {
        course: coursesList[0]._id.toHexString(),
        file: 'test',
        date: new Date('2020-01-23').toISOString(),
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      const attendanceSheetsLengthBefore = await AttendanceSheet
        .countDocuments({ course: coursesList[0]._id, origin: MOBILE });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet
        .countDocuments({ course: coursesList[0]._id, origin: MOBILE });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should upload attendance sheet to inter course (mobile)', async () => {
      const formData = {
        course: coursesList[1]._id.toHexString(),
        file: 'test',
        trainees: coursesList[1].trainees[0].toHexString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      const attendanceSheetsLengthBefore = await AttendanceSheet
        .countDocuments({ course: coursesList[1]._id, origin: MOBILE });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet
        .countDocuments({ course: coursesList[1]._id, origin: MOBILE });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should upload attendance sheet to intra_holding course', async () => {
      const formData = {
        course: coursesList[5]._id.toHexString(),
        file: 'test',
        date: new Date('2020-01-25').toISOString(),
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      const attendanceSheetsLengthBefore = await AttendanceSheet
        .countDocuments({ course: coursesList[5]._id, origin: WEBAPP });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet
        .countDocuments({ course: coursesList[5]._id, origin: WEBAPP });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should upload attendance sheet to single course with only one slot (webapp)', async () => {
      const attendanceSheetsLengthBefore = await AttendanceSheet.countDocuments({ course: coursesList[7]._id });
      const formData = {
        slots: slotsList[4]._id.toHexString(),
        course: coursesList[7]._id.toHexString(),
        file: 'test',
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments({ course: coursesList[7]._id });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should upload attendance sheet to single course with several slots (webapp)', async () => {
      const slots = [slotsList[4]._id.toHexString(), slotsList[7]._id.toHexString()];
      const attendanceSheetsLengthBefore = await AttendanceSheet.countDocuments({ course: coursesList[7]._id });
      const formData = {
        course: coursesList[7]._id.toHexString(),
        file: 'test',
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/file.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments({ course: coursesList[7]._id });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should upload trainer signature and create attendance sheet for single course (mobile)', async () => {
      const slots = [slotsList[4]._id.toHexString(), slotsList[7]._id.toHexString()];
      const attendanceSheetsLengthBefore = await AttendanceSheet.countDocuments({ course: coursesList[7]._id });
      const formData = {
        course: coursesList[7]._id.toHexString(),
        signature: 'test',
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments({ course: coursesList[7]._id });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
      sinon.assert.calledTwice(sendNotificationToUser);
    });

    it('should upload trainer signature and create attendance sheet for inter course (mobile)', async () => {
      const slots = [slotsList[12]._id.toHexString(), slotsList[13]._id.toHexString()];
      const attendanceSheetsLengthBefore = await AttendanceSheet.countDocuments({ course: coursesList[1]._id });
      const formData = {
        course: coursesList[1]._id.toHexString(),
        signature: 'test',
        trainees: coursesList[1].trainees[2].toHexString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments({ course: coursesList[1]._id });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
      sinon.assert.calledTwice(sendNotificationToUser);
    });

    it('should get existing trainer signature and update attendance sheet for inter course (mobile)', async () => {
      const slots = [slotsList[14]._id.toHexString()];
      const attendanceSheetsLengthBefore = await AttendanceSheet.countDocuments({ course: coursesList[1]._id });
      const formData = {
        course: coursesList[1]._id.toHexString(),
        signature: 'test',
        trainees: coursesList[1].trainees[1].toHexString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments({ course: coursesList[1]._id });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore);
      sinon.assert.notCalled(uploadCourseFile);
      sinon.assert.calledOnce(sendNotificationToUser);
    });

    it('should upload trainer signature and create attendance sheet for intra course (several slots and trainees)'
      + '(mobile)', async () => {
      const slots = [
        {
          slotId: slotsList[15]._id.toHexString(),
          trainees: [userList[0]._id.toHexString(), userList[1]._id.toHexString()],
        },
        {
          slotId: slotsList[16]._id.toHexString(),
          trainees: [userList[0]._id.toHexString(), userList[1]._id.toHexString()],
        },
      ];
      const attendanceSheetsLengthBefore = await AttendanceSheet.countDocuments({ course: coursesList[0]._id });
      const formData = {
        course: coursesList[0]._id.toHexString(),
        signature: 'test',
        date: new Date('2021-01-23').toISOString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments({ course: coursesList[0]._id });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
      sinon.assert.calledTwice(sendNotificationToUser);
    });

    it('should upload trainer signature and create attendance sheet for intra course (single slot and trainee)'
      + '(mobile)', async () => {
      const slots = [{ slotId: slotsList[15]._id.toHexString(), trainees: [userList[1]._id.toHexString()] }];
      const attendanceSheetsLengthBefore = await AttendanceSheet.countDocuments({ course: coursesList[0]._id });
      const formData = {
        course: coursesList[0]._id.toHexString(),
        signature: 'test',
        date: new Date('2021-01-23').toISOString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments({ course: coursesList[0]._id });
      expect(attendanceSheetsLengthAfter).toBe(attendanceSheetsLengthBefore + 1);
      sinon.assert.calledOnce(uploadCourseFile);
      sinon.assert.calledTwice(sendNotificationToUser);
    });

    it('should  return 400 if single course but slots is missing', async () => {
      const formData = {
        course: coursesList[7]._id.toHexString(),
        file: 'test',
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should  return 400 if single course but trainees is missing', async () => {
      const formData = {
        slots: slotsList[4]._id.toHexString(),
        course: coursesList[7]._id.toHexString(),
        file: 'test',
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should  return 400 if slots in payload but course is not a single or inter course', async () => {
      const formData = {
        slots: slotsList[2]._id.toHexString(),
        course: coursesList[5]._id.toHexString(),
        file: 'test',
        trainees: coursesList[5].trainees[0].toHexString(),
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should  return 404 if a slot is not in course', async () => {
      const slots = [slotsList[4]._id.toHexString(), slotsList[2]._id.toHexString()];
      const formData = {
        course: coursesList[7]._id.toHexString(),
        file: 'test',
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if a slot is already in existing attendance sheet for this trainee', async () => {
      const slots = [slotsList[4]._id.toHexString(), slotsList[6]._id.toHexString()];
      const formData = {
        course: coursesList[7]._id.toHexString(),
        file: 'test',
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: WEBAPP,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 400 trying to pass trainees for intra course', async () => {
      const formData = {
        course: coursesList[0]._id.toHexString(),
        file: 'test',
        trainees: coursesList[0].trainees[0].toHexString(),
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 trying to pass trainees for intra_holding course', async () => {
      const formData = {
        course: coursesList[5]._id.toHexString(),
        file: 'test',
        trainees: coursesList[5].trainees[0].toHexString(),
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 trying to pass date for inter course', async () => {
      const formData = {
        course: coursesList[1]._id.toHexString(),
        file: 'test',
        date: new Date('2020-01-23').toISOString(),
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if both date and trainees are missing in payload', async () => {
      const formData = {
        course: coursesList[2]._id.toHexString(),
        file: 'test',
        trainer: userList[3]._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if trying to pass signature without slots', async () => {
      const formData = {
        course: coursesList[7]._id.toHexString(),
        signature: 'test',
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if trying to pass signature and file', async () => {
      const slots = [slotsList[4]._id.toHexString(), slotsList[7]._id.toHexString()];
      const formData = {
        course: coursesList[7]._id.toHexString(),
        signature: 'test',
        file: 'test2',
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if trying to pass neither signature or file', async () => {
      const slots = [slotsList[4]._id.toHexString(), slotsList[7]._id.toHexString()];
      const formData = {
        course: coursesList[7]._id.toHexString(),
        trainees: coursesList[7].trainees[0].toHexString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if origin is neither webapp nor mobile', async () => {
      const formData = {
        course: coursesList[0]._id.toHexString(),
        file: 'test',
        date: new Date('2020-01-23').toISOString(),
        origin: 'poiuytr',
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if sign intra attendance sheet but slots have wrong format (mobile)', async () => {
      const slots = [slotsList[15]._id.toHexString(), slotsList[16]._id.toHexString()];
      const formData = {
        course: coursesList[0]._id.toHexString(),
        signature: 'test',
        date: new Date('2021-01-23').toISOString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
    it('should return 400 if sign inter attendance sheet but slots have wrong format'
      + '(mobile)', async () => {
      const slots = [{ slotId: slotsList[12]._id.toHexString(), trainees: [coursesList[1].trainees[2].toHexString()] }];
      const formData = {
        course: coursesList[1]._id.toHexString(),
        signature: 'test',
        trainees: coursesList[1].trainees[2].toHexString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if slots without signature in intra attendance sheet (mobile)', async () => {
      const slots = [{ slotId: slotsList[15]._id.toHexString(), trainees: [userList[1]._id.toHexString()] }];
      const formData = {
        course: coursesList[0]._id.toHexString(),
        date: new Date('2021-01-23').toISOString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if trainees in slots are not in course (mobile)', async () => {
      const slots = [{ slotId: slotsList[15]._id.toHexString(), trainees: [userList[2]._id.toHexString()] }];
      const formData = {
        course: coursesList[0]._id.toHexString(),
        signature: 'test',
        date: new Date('2021-01-23').toISOString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if slotId in slots are not in course (mobile)', async () => {
      const slots = [{ slotId: slotsList[12]._id.toHexString(), trainees: [userList[1]._id.toHexString()] }];
      const formData = {
        course: coursesList[0]._id.toHexString(),
        signature: 'test',
        date: new Date('2021-01-23').toISOString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if slots don\'t match with date on intra (mobile)', async () => {
      const slots = [{ slotId: slotsList[16]._id.toHexString(), trainees: [userList[1]._id.toHexString()] }];
      const formData = {
        course: coursesList[0]._id.toHexString(),
        signature: 'test',
        date: new Date('2021-01-24').toISOString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if there is already an attendance sheet for payload slots on intra (mobile)', async () => {
      const slots = [{ slotId: slotsList[17]._id.toHexString(), trainees: [userList[1]._id.toHexString()] }];
      const formData = {
        course: coursesList[0]._id.toHexString(),
        signature: 'test',
        date: new Date('2021-01-24').toISOString(),
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach((slot) => { form.append('slots', JSON.stringify(slot)); });
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return a 403 if trainer is from an other company', async () => {
      const formData = {
        course: coursesList[2]._id.toHexString(),
        file: 'test',
        date: '2020-01-25T09:00:00.000Z',
        trainer: userList[3]._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if trainer in payload is not course trainer', async () => {
      const formData = {
        course: coursesList[5]._id.toHexString(),
        file: 'test',
        date: '2020-01-25T09:00:00.000Z',
        trainer: trainerAndCoach._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 trying to pass an unknowned trainee', async () => {
      const formData = {
        course: coursesList[1]._id.toHexString(),
        file: 'test',
        trainees: new ObjectId().toHexString(),
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 trying to pass date outside course dates', async () => {
      const formData = {
        course: coursesList[0]._id.toHexString(),
        file: 'test',
        date: new Date('2018-01-23').toISOString(),
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if course is archived', async () => {
      const course = coursesList[3];
      const formData = {
        course: course._id.toHexString(),
        file: 'test',
        trainees: course.trainees[0].toHexString(),
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if course has no companies', async () => {
      const formData = {
        course: coursesList[6]._id.toHexString(),
        file: 'test',
        date: new Date('2020-01-25').toISOString(),
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return  400 if course is single and more than one trainee', async () => {
      const slots = [slotsList[4]._id.toHexString(), slotsList[7]._id.toHexString()];
      const trainees = [coursesList[7].trainees[0].toHexString(), userList[2]._id.toHexString()];
      const formData = {
        course: coursesList[7]._id.toHexString(),
        signature: 'test',
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));
      trainees.forEach(trainee => form.append('trainees', trainee));

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if more than one trainee but no signature', async () => {
      const slots = [slotsList[12]._id.toHexString(), slotsList[13]._id.toHexString()];
      const trainees = coursesList[1].trainees.map(t => t.toHexString());
      const formData = {
        course: coursesList[1]._id.toHexString(),
        file: 'test',
        origin: MOBILE,
        trainer: trainer._id.toHexString(),
      };

      const form = generateFormData(formData);
      slots.forEach(slot => form.append('slots', slot));
      trainees.forEach(trainee => form.append('trainees', trainee));

      const response = await app.inject({
        method: 'POST',
        url: '/attendancesheets',
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    });
    afterEach(() => {
      uploadCourseFile.restore();
    });
    const roles = [
      { name: 'client_admin', expectedCode: 403 },
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const formData = {
          course: coursesList[0]._id.toHexString(),
          file: 'test',
          date: new Date('2020-01-23').toISOString(),
          trainer: trainer._id.toHexString(),
        };
        const form = generateFormData(formData);

        const response = await app.inject({
          method: 'POST',
          url: '/attendancesheets',
          payload: getStream(form),
          headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('ATTENDANCE SHEETS ROUTES - GET /attendancesheets', () => {
  let authToken;

  describe('TRAINER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('trainer');
    });

    it('should get course\'s attendance sheets', async () => {
      const attendanceSheetsLength = await AttendanceSheet.countDocuments({ course: coursesList[0]._id });

      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.attendanceSheets.length).toEqual(attendanceSheetsLength);
    });

    it('should return a 404 if course doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if trainer is from an other company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('COACH', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('coach');
    });

    it('should get only authCompany\'s attendance sheets for interB2B course if user does not have vendor role',
      async () => {
        authToken = await getToken('coach');

        const response = await app.inject({
          method: 'GET',
          url: `/attendancesheets?course=${coursesList[1]._id}&company=${authCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.attendanceSheets.length).toEqual(2);
      });

    it('should get attendance sheets if user is trainer but not course trainer but is coach from course company',
      async () => {
        authToken = await getTokenByCredentials(trainerAndCoach.local);

        const response = await app.inject({
          method: 'GET',
          url: `/attendancesheets?course=${coursesList[1]._id}&company=${authCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);
      });

    it('should return a 403 if company is not in course', async () => {
      authToken = await getToken('coach');
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[4]._id}&company=${authCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if user is not in company', async () => {
      authToken = await getToken('coach');
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[4]._id}&company=${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if company doesn\'t exist', async () => {
      authToken = await getToken('coach');
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[4]._id}&company=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('HOLDING_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getTokenByCredentials(holdingAdminFromOtherCompany.local);
    });

    it('should get holding\'s attendance sheets for interB2B course', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[1]._id}&holding=${otherHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.attendanceSheets.length).toEqual(2);
    });

    it('should return 200 even if no company in course (intra_holding)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[6]._id}&holding=${otherHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 403 if course company is not in holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[0]._id}&holding=${otherHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if user is not in holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[0]._id}&holding=${authHolding._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if holding doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[0]._id}&holding=${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if no vendor role and no holding or company query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[1]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if holding and company query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/attendancesheets?course=${coursesList[1]._id}&holding=${otherHolding._id}&company=${otherCompany._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/attendancesheets?course=${coursesList[0]._id}&company=${authCompany._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('ATTENDANCE SHEETS ROUTES - PUT /attendancesheets/{_id}', () => {
  let authToken;
  let uploadCourseFile;

  beforeEach(populateDB);

  describe('TRAINER', () => {
    beforeEach(async () => {
      authToken = await getToken('trainer');
      uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    });
    afterEach(() => {
      uploadCourseFile.restore();
    });

    it('should update attendance sheet slots for a single course', async () => {
      const attendanceSheetId = attendanceSheetList[5]._id;
      const payload = { slots: [slotsList[4]._id] };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const attendanceSheetUpdated = await AttendanceSheet
        .countDocuments({ _id: attendanceSheetId, 'slots.slotId': slotsList[4]._id });
      expect(attendanceSheetUpdated).toEqual(1);
      sinon.assert.notCalled(uploadCourseFile);
    });

    it('should generate attendance sheet file for a single course', async () => {
      const attendanceSheetId = attendanceSheetList[9]._id;
      const payload = { action: GENERATION };
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const attendanceSheetUpdated = await AttendanceSheet
        .countDocuments({ _id: attendanceSheetId, file: { $exists: true } });
      expect(attendanceSheetUpdated).toEqual(1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should generate attendance sheet file for inter course', async () => {
      const attendanceSheetId = attendanceSheetList[11]._id;
      const payload = { action: GENERATION };
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const attendanceSheetUpdated = await AttendanceSheet
        .countDocuments({ _id: attendanceSheetId, file: { $exists: true } });
      expect(attendanceSheetUpdated).toEqual(1);
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should return 404 if attendance sheet doesn\'t exist', async () => {
      const payload = { slots: [slotsList[4]._id] };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if slots and action in payload', async () => {
      const attendanceSheetId = attendanceSheetList[5]._id;
      const payload = { action: GENERATION, slots: [slotsList[4]._id] };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if neither slots nor action in payload', async () => {
      const attendanceSheetId = attendanceSheetList[5]._id;

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if course is inter and not finished yet', async () => {
      const attendanceSheetId = attendanceSheetList[11]._id;
      const payload = { action: GENERATION };

      await app.inject({
        method: 'PUT',
        url: `/courseslots/${slotsList[14]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload: { startDate: CompaniDate().add('P1D').toISO(), endDate: CompaniDate().add('P1DT2H').toISO() },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if try to add slot and course is not single', async () => {
      const attendanceSheetId = attendanceSheetList[11]._id;
      const payload = { slots: [slotsList[1]._id] };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if attendance sheet already has file', async () => {
      const attendanceSheetId = attendanceSheetList[10]._id;
      const payload = { action: GENERATION };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 if generation and trainer or trainee signature missing', async () => {
      const attendanceSheetId = attendanceSheetList[8]._id;
      const payload = { action: GENERATION };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if a slot is not in course', async () => {
      const attendanceSheetId = attendanceSheetList[5]._id;
      const payload = { slots: [slotsList[3]._id] };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if a slot is already in an existing attendance sheet', async () => {
      const attendanceSheetId = attendanceSheetList[6]._id;
      const payload = { slots: [slotsList[5]._id] };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 403 if trainer is not trainer of course linked to attendance sheet', async () => {
      const attendanceSheetId = attendanceSheetList[7]._id;
      const payload = { slots: [slotsList[8]._id] };

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);

    const roles = [
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const attendanceSheetId = attendanceSheetList[5]._id;
        const payload = { slots: [slotsList[4]._id] };

        const response = await app.inject({
          method: 'PUT',
          url: `/attendancesheets/${attendanceSheetId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('ATTENDANCE SHEETS ROUTES - PUT /attendancesheets/{_id}/signature', () => {
  let authToken;
  let uploadCourseFile;
  beforeEach(populateDB);

  describe('TRAINEE', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(userList[1].local);
      uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    });
    afterEach(() => {
      uploadCourseFile.restore();
    });

    it('should upload trainee signature for single course (mobile)', async () => {
      const formData = { signature: 'test' };

      const form = generateFormData(formData);
      uploadCourseFile.returns({ publicId: '1234567890', link: 'https://test.com/signature.pdf' });
      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetList[8]._id}/signature`,
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheet = await AttendanceSheet.findOne({ _id: attendanceSheetList[8]._id });
      const attendanceSheetHasBothSignatures = attendanceSheet.slots
        .every(s => s.trainerSignature &&
            UtilsHelper.areObjectIdsEquals(s.traineesSignature[0].traineeId, userList[1]._id));
      expect(attendanceSheetHasBothSignatures).toBeTruthy();
      sinon.assert.calledOnce(uploadCourseFile);
    });

    it('should upload trainee signature for inter course with signed slots (mobile)', async () => {
      const formData = { signature: 'test' };

      const form = generateFormData(formData);
      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetList[12]._id}/signature`,
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheet = await AttendanceSheet.findOne({ _id: attendanceSheetList[12]._id });
      const attendanceSheetHasBothSignatures = attendanceSheet.slots
        .every(s => s.trainerSignature &&
            UtilsHelper.areObjectIdsEquals(s.traineesSignature[0].traineeId, userList[1]._id));
      expect(attendanceSheetHasBothSignatures).toBeTruthy();
      sinon.assert.notCalled(uploadCourseFile);
    });

    it('should return 400 if no signature', async () => {
      const formData = {};

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetList[8]._id}/signature`,
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if attendance sheet doesn\'t exist', async () => {
      const formData = { signature: 'test' };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${new ObjectId()}/signature`,
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if attendance sheet has no trainer signature', async () => {
      const formData = { signature: 'test' };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetList[7]._id}/signature`,
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if every slot has already been signed by trainee', async () => {
      const formData = { signature: 'test' };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetList[9]._id}/signature`,
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    it('should return 403 if user is not attendance sheet trainee', async () => {
      authToken = await getTokenByCredentials(userList[0].local);

      const formData = { signature: 'test' };

      const form = generateFormData(formData);

      const response = await app.inject({
        method: 'PUT',
        url: `/attendancesheets/${attendanceSheetList[8]._id}/signature`,
        payload: getStream(form),
        headers: { ...form.getHeaders(), Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('ATTENDANCE SHEETS ROUTES - DELETE /attendancesheets/{_id}', () => {
  let authToken;
  let deleteCourseFile;

  describe('TRAINER', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('trainer');
      deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
    });
    afterEach(() => {
      deleteCourseFile.restore();
    });

    it('should delete an attendance sheet (without signatures)', async () => {
      const attendanceSheetId = attendanceSheetList[0]._id;
      const attendanceSheetsLength = await AttendanceSheet.countDocuments();
      const response = await app.inject({
        method: 'DELETE',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments();
      expect(attendanceSheetsLengthAfter).toEqual(attendanceSheetsLength - 1);
      sinon.assert.calledOnce(deleteCourseFile);
    });

    it('should delete an attendance sheet (with signatures but no file)', async () => {
      const attendanceSheetId = attendanceSheetList[9]._id;
      const attendanceSheetsLength = await AttendanceSheet.countDocuments();
      const response = await app.inject({
        method: 'DELETE',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments();
      expect(attendanceSheetsLengthAfter).toEqual(attendanceSheetsLength - 1);
      sinon.assert.calledTwice(deleteCourseFile);
    });

    it('should delete an attendance sheet (with both signatures and file)', async () => {
      const attendanceSheetId = attendanceSheetList[10]._id;
      const attendanceSheetsLength = await AttendanceSheet.countDocuments();
      const response = await app.inject({
        method: 'DELETE',
        url: `/attendancesheets/${attendanceSheetId}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const attendanceSheetsLengthAfter = await AttendanceSheet.countDocuments();
      expect(attendanceSheetsLengthAfter).toEqual(attendanceSheetsLength - 1);
      sinon.assert.calledThrice(deleteCourseFile);
    });

    it('should return a 404 if attendance sheet does not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/attendancesheets/${new ObjectId()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 403 if trainer is from an other company', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/attendancesheets/${attendanceSheetList[3]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 if course is archived', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/attendancesheets/${attendanceSheetList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
      deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
    });
    afterEach(() => {
      deleteCourseFile.restore();
    });

    const roles = [
      { name: 'client_admin', expectedCode: 403 },
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const attendanceSheetId = attendanceSheetList[0]._id;
        const response = await app.inject({
          method: 'DELETE',
          url: `/attendancesheets/${attendanceSheetId}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
