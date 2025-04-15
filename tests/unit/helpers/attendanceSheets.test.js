const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const get = require('lodash/get');
const User = require('../../../src/models/User');
const Course = require('../../../src/models/Course');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const attendanceSheetHelper = require('../../../src/helpers/attendanceSheets');
const CoursesHelper = require('../../../src/helpers/courses');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
const NotificationHelper = require('../../../src/helpers/notifications');
const SinonMongoose = require('../sinonMongoose');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const InterAttendanceSheet = require('../../../src/data/pdf/attendanceSheet/interAttendanceSheet');
const UtilsHelper = require('../../../src/helpers/utils');
const { VENDOR_ADMIN, COACH, COURSE, TRAINEE, HOLDING_ADMIN, INTER_B2B } = require('../../../src/helpers/constants');

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(AttendanceSheet, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return course attendance sheets as vendor role', async () => {
    const credentials = { role: { vendor: { name: VENDOR_ADMIN } } };
    const courseId = new ObjectId();
    const attendanceSheets = [{
      course: courseId,
      file: { publicId: 'mon premier upload', link: 'www.test.com' },
      date: '2020-04-03T10:00:00.000Z',
      companies: [new ObjectId()],
    }];

    find.returns(SinonMongoose.stubChainedQueries(attendanceSheets, ['populate', 'setOptions', 'lean']));

    const result = await attendanceSheetHelper.list({ course: courseId }, credentials);

    expect(result).toMatchObject(attendanceSheets);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId }] },
        { query: 'populate', args: [{ path: 'trainee', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate step' }] },
        { query: 'setOptions', args: [{ isVendorUser: !!get(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return course attendance sheets as client user with company', async () => {
    const authCompanyId = new ObjectId();
    const credentials = { company: { _id: authCompanyId }, role: { client: { name: COACH } } };

    const courseId = new ObjectId();
    const attendanceSheets = [
      {
        course: courseId,
        file: { publicId: 'mon upload avec un trainne de authCompany', link: 'www.test.com' },
        trainee: { _id: new ObjectId(), identity: { firstname: 'Helo', name: 'World' } },
        companies: [authCompanyId],

      },
      {
        course: courseId,
        file: { publicId: 'mon upload avec un trainne de otherCompany', link: 'www.test.com' },
        trainee: { _id: new ObjectId(), identity: { firstname: 'Aline', name: 'Opiné' } },
        companies: [authCompanyId],
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(attendanceSheets, ['populate', 'setOptions', 'lean']));

    const result = await attendanceSheetHelper.list({ course: courseId, company: authCompanyId }, credentials);

    expect(result).toMatchObject(attendanceSheets);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId, companies: { $in: [authCompanyId] } }] },
        { query: 'populate', args: [{ path: 'trainee', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate step' }] },
        { query: 'setOptions', args: [{ isVendorUser: !!get(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return course attendance sheets as holding user', async () => {
    const authCompanyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const holdingId = new ObjectId();
    const credentials = {
      company: { _id: authCompanyId },
      holding: { _id: holdingId, companies: [authCompanyId, otherCompanyId] },
      role: { client: { name: COACH }, holding: { name: HOLDING_ADMIN } },
    };

    const courseId = new ObjectId();
    const attendanceSheets = [
      {
        course: courseId,
        file: { publicId: 'mon upload avec un trainne de authCompany', link: 'www.test.com' },
        trainee: { _id: new ObjectId(), identity: { firstname: 'Helo', name: 'World' } },
        companies: [authCompanyId],
      },
      {
        course: courseId,
        file: { publicId: 'mon upload avec un trainne de otherCompany', link: 'www.test.com' },
        trainee: { _id: new ObjectId(), identity: { firstname: 'Aline', name: 'Opiné' } },
        companies: [otherCompanyId],
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(attendanceSheets, ['populate', 'setOptions', 'lean']));

    const result = await attendanceSheetHelper.list({ course: courseId, holding: holdingId }, credentials);

    expect(result).toMatchObject(attendanceSheets);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId, companies: { $in: [authCompanyId, otherCompanyId] } }] },
        { query: 'populate', args: [{ path: 'trainee', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate step' }] },
        { query: 'setOptions', args: [{ isVendorUser: !!get(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('create', () => {
  let uploadCourseFile;
  let userFindOne;
  let formatIdentity;
  let create;
  let courseFindOne;
  let getCompanyAtCourseRegistrationList;
  let sendAttendanceSheetSignatureRequestNotification;

  beforeEach(() => {
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    userFindOne = sinon.stub(User, 'findOne');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    create = sinon.stub(AttendanceSheet, 'create');
    courseFindOne = sinon.stub(Course, 'findOne');
    getCompanyAtCourseRegistrationList = sinon
      .stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
    sendAttendanceSheetSignatureRequestNotification = sinon.stub(
      NotificationHelper,
      'sendAttendanceSheetSignatureRequestNotification'
    );
  });

  afterEach(() => {
    uploadCourseFile.restore();
    userFindOne.restore();
    formatIdentity.restore();
    create.restore();
    courseFindOne.restore();
    getCompanyAtCourseRegistrationList.restore();
    sendAttendanceSheetSignatureRequestNotification.restore();
  });

  it('should create an attendance sheet for INTRA course', async () => {
    const courseId = new ObjectId();
    const attendanceSheetId = new ObjectId();
    const course = { _id: courseId, companies: [new ObjectId()] };
    const payload = { date: '2020-04-03T10:00:00.000Z', course: courseId, file: 'test.pdf' };
    const credentials = { _id: new ObjectId() };

    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['lean']));
    create.returns({ _id: attendanceSheetId });

    await attendanceSheetHelper.create(payload, credentials);

    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'emargement_3 avril 2020', file: 'test.pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        course: courseId,
        date: '2020-04-03T10:00:00.000Z',
        file: { publicId: 'yo', link: 'yo' },
        companies: course.companies,
      }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }, { companies: 1 }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(userFindOne);
    sinon.assert.notCalled(formatIdentity);
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
    sinon.assert.notCalled(sendAttendanceSheetSignatureRequestNotification);
  });

  it('should create an attendance sheet for INTER course', async () => {
    const courseId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const attendanceSheetId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = { _id: courseId, companies: [new ObjectId()] };
    const payload = { trainee: traineeId, course: courseId, file: 'test.pdf' };
    const user = {
      _id: traineeId,
      identity: { firstName: 'monsieur', lastname: 'patate' },
      formationExpoTokenList: [],
    };

    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['lean']));
    userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    formatIdentity.returns('monsieur PATATE');
    getCompanyAtCourseRegistrationList.returns([{ trainee: traineeId, company: companyId }]);
    create.returns({ _id: attendanceSheetId });

    await attendanceSheetHelper.create(payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }, { companies: 1 }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [
        { query: 'findOne', args: [{ _id: traineeId }, { identity: 1, formationExpoTokenList: 1 }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      formatIdentity,
      { firstName: 'monsieur', lastname: 'patate' },
      'FL'
    );
    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'emargement_monsieur PATATE', file: 'test.pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        course: courseId,
        trainee: traineeId,
        file: { publicId: 'yo', link: 'yo' },
        companies: [companyId],
      }
    );
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [traineeId] }
    );
    sinon.assert.notCalled(sendAttendanceSheetSignatureRequestNotification);
  });

  it('should create an attendance sheet with one slot for single course', async () => {
    const courseId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const slotId = new ObjectId();
    const attendanceSheetId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = { _id: courseId, companies: [new ObjectId()] };
    const payload = { trainee: traineeId, course: courseId, file: 'test.pdf', slots: slotId };
    const user = { _id: traineeId, identity: { firstName: 'Eren', lastname: 'JÄGER' }, formationExpoTokenList: [] };

    uploadCourseFile.returns({ publicId: 'test', link: 'test' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['lean']));
    userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    formatIdentity.returns('Eren JÄGER');
    getCompanyAtCourseRegistrationList.returns([{ trainee: traineeId, company: companyId }]);
    create.returns({ _id: attendanceSheetId });

    await attendanceSheetHelper.create(payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { companies: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [{ query: 'findOne', args: [{ _id: traineeId }, { identity: 1, formationExpoTokenList: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstName: 'Eren', lastname: 'JÄGER' }, 'FL');
    sinon.assert.calledOnceWithExactly(uploadCourseFile, { fileName: 'emargement_Eren JÄGER', file: 'test.pdf' });
    sinon.assert.calledOnceWithExactly(
      create,
      {
        trainee: traineeId,
        course: courseId,
        slots: [slotId],
        companies: [companyId],
        file: { publicId: 'test', link: 'test' },
      }
    );
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [traineeId] }
    );
    sinon.assert.notCalled(sendAttendanceSheetSignatureRequestNotification);
  });

  it('should create an attendance sheet with multiple slots for single course', async () => {
    const courseId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const attendanceSheetId = new ObjectId();
    const slots = [new ObjectId(), new ObjectId()];
    const credentials = { _id: new ObjectId() };

    const course = { _id: courseId, companies: [new ObjectId()] };
    const payload = { trainee: traineeId, course: courseId, file: 'test.pdf', slots };
    const user = {
      _id: traineeId,
      identity: { firstName: 'Mikasa', lastname: 'ACKERMAN' },
    };

    uploadCourseFile.returns({ publicId: 'test', link: 'test' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['lean']));
    userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    formatIdentity.returns('Mikasa ACKERMAN');
    getCompanyAtCourseRegistrationList.returns([{ trainee: traineeId, company: companyId }]);
    create.returns({ _id: attendanceSheetId });

    await attendanceSheetHelper.create(payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { companies: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [{ query: 'findOne', args: [{ _id: traineeId }, { identity: 1, formationExpoTokenList: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstName: 'Mikasa', lastname: 'ACKERMAN' }, 'FL');
    sinon.assert.calledOnceWithExactly(uploadCourseFile, { fileName: 'emargement_Mikasa ACKERMAN', file: 'test.pdf' });
    sinon.assert.calledOnceWithExactly(
      create,
      {
        trainee: traineeId,
        course: courseId,
        slots,
        companies: [companyId],
        file: { publicId: 'test', link: 'test' },
      }
    );
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [traineeId] }
    );
    sinon.assert.notCalled(sendAttendanceSheetSignatureRequestNotification);
  });

  it('should upload trainer signature and create an attendance sheet', async () => {
    const courseId = new ObjectId();
    const traineeId = new ObjectId();
    const companyId = new ObjectId();
    const attendanceSheetId = new ObjectId();
    const slots = [new ObjectId(), new ObjectId()];
    const credentials = { _id: new ObjectId() };

    const course = { _id: courseId, companies: [new ObjectId()] };
    const payload = { trainee: traineeId, course: courseId, signature: 'signature.png', slots };
    const user = {
      _id: traineeId,
      identity: { firstName: 'Mikasa', lastname: 'ACKERMAN' },
      formationExpoTokenList: ['ExponentPushToken[jeSuisUnTokenExpo]', 'ExponentPushToken[jeSuisUnAutreTokenExpo]'],
    };

    uploadCourseFile.returns({ publicId: '123', link: 'http://signature' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['lean']));
    userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    formatIdentity.returns('Mikasa ACKERMAN');
    getCompanyAtCourseRegistrationList.returns([{ trainee: traineeId, company: companyId }]);
    create.returns({ _id: attendanceSheetId, signatures: { trainer: 'http://signature' } });

    await attendanceSheetHelper.create(payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { companies: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [{ query: 'findOne', args: [{ _id: traineeId }, { identity: 1, formationExpoTokenList: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(formatIdentity, { firstName: 'Mikasa', lastname: 'ACKERMAN' }, 'FL');
    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: `trainer_signature_${credentials._id}_course_${courseId}`, file: 'signature.png' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        trainee: traineeId,
        course: courseId,
        slots,
        companies: [companyId],
        signatures: { trainer: 'http://signature' },
      }
    );
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [traineeId] }
    );
    sinon.assert.calledOnceWithExactly(
      sendAttendanceSheetSignatureRequestNotification,
      attendanceSheetId,
      ['ExponentPushToken[jeSuisUnTokenExpo]', 'ExponentPushToken[jeSuisUnAutreTokenExpo]']
    );
  });
});

describe('update', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(AttendanceSheet, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should update an attendance sheet', async () => {
    const slotId = new ObjectId();
    const attendanceSheetId = new ObjectId();
    const payload = { slots: [slotId] };
    await attendanceSheetHelper.update(attendanceSheetId, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: attendanceSheetId }, { $set: payload });
  });
});

describe('sign', () => {
  let uploadCourseFile;
  let updateOne;

  beforeEach(() => {
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    updateOne = sinon.stub(AttendanceSheet, 'updateOne');
  });
  afterEach(() => {
    uploadCourseFile.restore();
    updateOne.restore();
  });

  it('should add trainee signature in attendance sheet', async () => {
    const credentials = { _id: new ObjectId() };
    const attendanceSheetId = new ObjectId();
    const payload = { signature: 'test.png' };

    uploadCourseFile.returns({ publicId: 'id', link: 'link' });

    await attendanceSheetHelper.sign(attendanceSheetId, payload, credentials);

    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: `trainee_signature_${credentials._id}`, file: 'test.png' }
    );

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: attendanceSheetId },
      { $set: { 'signatures.trainee': 'link' } }
    );
  });
});

describe('generate', () => {
  let findOne;
  let formatInterCourseForPdf;
  let getPdf;
  let uploadCourseFile;
  let updateOne;
  beforeEach(() => {
    findOne = sinon.stub(AttendanceSheet, 'findOne');
    formatInterCourseForPdf = sinon.stub(CoursesHelper, 'formatInterCourseForPdf');
    getPdf = sinon.stub(InterAttendanceSheet, 'getPdf');
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    updateOne = sinon.stub(AttendanceSheet, 'updateOne');
  });
  afterEach(() => {
    findOne.restore();
    formatInterCourseForPdf.restore();
    getPdf.restore();
    uploadCourseFile.restore();
    updateOne.restore();
  });

  it('should generate attendance sheet', async () => {
    const attendanceSheetId = new ObjectId();
    const traineeId = new ObjectId();
    const attendanceSheet = {
      _id: attendanceSheetId,
      misc: 'misc',
      trainee: { _id: traineeId, identity: { lastname: 'Sainz', firstname: 'Carlos' } },
      signatures: { trainer: 'https://trainer.com', trainee: 'https://trainee.com' },
      trainer: { identity: { lastname: 'Hamilton', firstname: 'Lewis' } },
      slots: [{ startDate: '2020-03-04T09:00:00', endDate: '2020-03-04T11:00:00', step: { type: 'on_site' } }],
      course: {
        type: INTER_B2B,
        misc: 'misc',
        companies: [{ name: 'Alenvi' }],
        subProgram: { program: { name: 'Program 1' } },
      },
    };

    const formattedCourse = {
      type: INTER_B2B,
      misc: 'misc',
      companies: [{ name: 'Alenvi' }],
      slots: [{ startDate: '2020-03-04T09:00:00', endDate: '2020-03-04T11:00:00', step: { type: 'on_site' } }],
      trainees: [{ _id: traineeId, identity: { lastname: 'Sainz', firstname: 'Carlos' } }],
      trainers: [{ identity: { lastname: 'Hamilton', firstname: 'Lewis' } }],
      subProgram: { program: { name: 'Program 1' } },
    };

    findOne.returns(SinonMongoose.stubChainedQueries(attendanceSheet));
    formatInterCourseForPdf.returns({
      trainees: [{ traineeName: 'Carlos SAINZ', course: { slots: [{ date: '04/03/2020' }] } }],
    });

    getPdf.returns('pdf');
    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    await attendanceSheetHelper.generate(attendanceSheetId);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: attendanceSheetId }] },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'step startDate endDate address',
            populate: { path: 'step', select: 'type' },
          }],
        },
        { query: 'populate', args: [{ path: 'trainee', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'trainer', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'type misc companies subProgram',
            populate: [
              { path: 'companies', select: 'name' },
              { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
            ],
          }],
        },
        { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(formatInterCourseForPdf, formattedCourse);
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        trainees: [{ traineeName: 'Carlos SAINZ', course: { slots: [{ date: '04/03/2020' }] } }],
        signatures: { trainer: 'https://trainer.com', trainee: 'https://trainee.com' },
      });
    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'emargements_Carlos_SAINZ_04/03/2020', file: 'pdf', contentType: 'application/pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: attendanceSheetId },
      { $set: { file: { publicId: 'yo', link: 'yo' } } }
    );
  });
});

describe('delete', () => {
  let findOne;
  let deleteOne;
  let deleteCourseFile;
  beforeEach(() => {
    findOne = sinon.stub(AttendanceSheet, 'findOne');
    deleteOne = sinon.stub(AttendanceSheet, 'deleteOne');
    deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
  });
  afterEach(() => {
    findOne.restore();
    deleteOne.restore();
    deleteCourseFile.restore();
  });

  it('should remove an attendance sheet (without signatures)', async () => {
    const attendanceSheetId = new ObjectId();
    const attendanceSheet = { _id: attendanceSheetId, file: { publicId: 'yo' } };

    findOne.returns(SinonMongoose.stubChainedQueries(attendanceSheet, ['lean']));

    await attendanceSheetHelper.delete(attendanceSheetId);

    sinon.assert.calledOnceWithExactly(deleteCourseFile, 'yo');
    sinon.assert.calledOnceWithExactly(deleteOne, { _id: attendanceSheetId });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: attendanceSheetId }] }, { query: 'lean' }]
    );
  });

  it('should remove an attendance sheet (with one signature)', async () => {
    const attendanceSheetId = new ObjectId();
    const attendanceSheet = {
      _id: attendanceSheetId,
      signatures: {
        trainer: 'gcs.com/bucket/media-trainer_signature_abcde_course_67890',
      },
    };

    findOne.returns(SinonMongoose.stubChainedQueries(attendanceSheet, ['lean']));

    await attendanceSheetHelper.delete(attendanceSheetId);

    sinon.assert.calledOnceWithExactly(deleteCourseFile, 'media-trainer_signature_abcde_course_67890');
    sinon.assert.calledOnceWithExactly(deleteOne, { _id: attendanceSheetId });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: attendanceSheetId }] }, { query: 'lean' }]
    );
  });

  it('should remove an attendance sheet (with both signatures and file)', async () => {
    const attendanceSheetId = new ObjectId();
    const attendanceSheet = {
      _id: attendanceSheetId,
      file: { publicId: 'yo' },
      signatures: {
        trainer: 'gcs.com/bucket/media-trainer_signature_abcde_course_67890',
        trainee: 'gcs.com/bucket/media-trainee_signature_12345_course_67890',
      },
    };

    findOne.returns(SinonMongoose.stubChainedQueries(attendanceSheet, ['lean']));

    await attendanceSheetHelper.delete(attendanceSheetId);

    sinon.assert.calledWithExactly(deleteCourseFile.getCall(0), 'media-trainer_signature_abcde_course_67890');
    sinon.assert.calledWithExactly(deleteCourseFile.getCall(1), 'media-trainee_signature_12345_course_67890');
    sinon.assert.calledWithExactly(deleteCourseFile.getCall(2), 'yo');
    sinon.assert.calledOnceWithExactly(deleteOne, { _id: attendanceSheetId });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: attendanceSheetId }] }, { query: 'lean' }]
    );
  });
});
