const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Course = require('../../../src/models/Course');
const TrainerMission = require('../../../src/models/TrainerMission');
const trainerMissionsHelper = require('../../../src/helpers/trainerMissions');
const SinonMongoose = require('../sinonMongoose');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const { UPLOAD, GENERATION, INTRA } = require('../../../src/helpers/constants');
const TrainerMissionPdf = require('../../../src/data/pdf/trainerMission');

describe('upload', () => {
  let uploadCourseFile;
  let courseFindOne;
  let create;

  beforeEach(() => {
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    create = sinon.stub(TrainerMission, 'create');
    courseFindOne = sinon.stub(Course, 'findOne');
  });

  afterEach(() => {
    uploadCourseFile.restore();
    create.restore();
    courseFindOne.restore();
  });

  it('should create a trainer mission for a single course', async () => {
    const credentials = { _id: new ObjectId() };
    const courseId = new ObjectId();
    const trainerId = new ObjectId();
    const course = {
      _id: courseId,
      trainers: [
        { _id: trainerId, identity: { lastname: 'For', firstname: 'Matrice' } },
        { _id: new ObjectId(), identity: { lastname: 'Vador', firstname: 'Dark' } },
      ],
      subProgram: { program: { name: 'program' } },
    };
    const payload = { courses: courseId, file: 'test.pdf', fee: 1200, trainer: trainerId };

    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    await trainerMissionsHelper.upload(payload, credentials);

    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'ordre mission program Matrice FOR', file: 'test.pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        courses: [courseId],
        fee: 1200,
        trainer: trainerId,
        file: { publicId: 'yo', link: 'yo' },
        createdBy: credentials._id,
        creationMethod: UPLOAD,
      }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }, { trainers: 1, subProgram: 1 }] },
        {
          query: 'populate',
          args: [[
            { path: 'trainers', select: 'identity' },
            { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
          ]],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should create a trainer mission for several courses', async () => {
    const credentials = { _id: new ObjectId() };
    const courseIds = [new ObjectId(), new ObjectId()];
    const trainerId = new ObjectId();
    const course = {
      _id: courseIds[0],
      trainers: [{ _id: trainerId, identity: { lastname: 'For', firstname: 'Matrice' } }],
      subProgram: { program: { name: 'program' } },
    };
    const payload = { courses: courseIds, file: 'test.pdf', fee: 1200, trainer: trainerId };

    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    await trainerMissionsHelper.upload(payload, credentials);

    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'ordre mission program Matrice FOR', file: 'test.pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        courses: courseIds,
        fee: 1200,
        trainer: trainerId,
        file: { publicId: 'yo', link: 'yo' },
        createdBy: credentials._id,
        creationMethod: UPLOAD,
      }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseIds[0] }, { trainers: 1, subProgram: 1 }] },
        {
          query: 'populate',
          args: [[
            { path: 'trainers', select: 'identity' },
            { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
          ]],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(TrainerMission, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return trainer missions', async () => {
    const trainerId = new ObjectId();
    const trainerMissions = [{
      trainer: trainerId,
      file: { publicId: 'mon premier upload', link: 'www.test.com' },
      date: '2023-12-10T23:00:00.000Z',
      courses: [{ _id: new ObjectId(), subProgram: { program: { name: 'name' } }, companies: [{ name: 'Alenvi' }] }],
      fee: 12,
      createdBy: new ObjectId(),
    }];

    find.returns(SinonMongoose.stubChainedQueries(trainerMissions, ['populate', 'sort', 'lean']));

    const result = await trainerMissionsHelper.list({ trainer: trainerId });

    expect(result).toMatchObject(trainerMissions);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ trainer: trainerId }] },
        {
          query: 'populate',
          args: [{
            path: 'courses',
            select: 'misc type companies subProgram tradeName',
            populate: [
              { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              { path: 'companies', select: 'name' },
            ],
          }],
        },
        { query: 'sort', args: [{ createdAt: -1 }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('generate', () => {
  let uploadCourseFile;
  let courseFind;
  let trainerMissionGetPdf;
  let create;

  beforeEach(() => {
    uploadCourseFile = sinon.stub(GCloudStorageHelper, 'uploadCourseFile');
    create = sinon.stub(TrainerMission, 'create');
    courseFind = sinon.stub(Course, 'find');
    trainerMissionGetPdf = sinon.stub(TrainerMissionPdf, 'getPdf');
  });

  afterEach(() => {
    uploadCourseFile.restore();
    create.restore();
    courseFind.restore();
    trainerMissionGetPdf.restore();
  });

  it('should generate a trainer mission for a single course', async () => {
    const credentials = { _id: new ObjectId(), identity: { lastname: 'Doe', firstname: 'John' } };
    const courseId = new ObjectId();
    const trainerId = new ObjectId();
    const courses = [{
      _id: courseId,
      misc: 'test',
      type: INTRA,
      hasCertifyingTest: false,
      companies: [{ name: 'Alenvi' }],
      trainers: [{ _id: trainerId, identity: { lastname: 'For', firstname: 'Matrice' } }],
      tradeName: 'program 1',
      subProgram: {
        program: { name: 'program' },
        steps: [
          { theoreticalDuration: 'PT7200S', type: 'on_site' },
          { theoreticalDuration: 'PT7200S', type: 'on_site' },
          { theoreticalDuration: 'PT9000S', type: 'on_site' },
        ],
      },
      slots: [
        {
          startDate: '2023-12-12T10:00:00.000Z',
          endDate: '2023-12-12T12:00:00.000Z',
          address: { fullAddress: '3 rue du château' },
        },
        {
          startDate: '2023-12-13T10:00:00.000Z',
          endDate: '2023-12-13T12:00:00.000Z',
          address: { fullAddress: '6 rue du château' },
        },
      ],
      slotsToPlan: [{ _id: new ObjectId() }],
    }];
    const payload = { courses: courseId, fee: 1200, trainer: trainerId };

    const data = {
      trainerIdentity: { lastname: 'For', firstname: 'Matrice' },
      program: 'program',
      slotsCount: 3,
      liveDuration: '6h30',
      groupCount: 1,
      companies: 'Alenvi',
      addressList: ['3 rue du château', '6 rue du château'],
      dates: ['12/12/2023', '13/12/2023'],
      slotsToPlan: 1,
      certification: [],
      fee: 1200,
      createdBy: 'John DOE',
    };

    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFind.returns(SinonMongoose.stubChainedQueries(courses));
    trainerMissionGetPdf.returns('test.pdf');

    await trainerMissionsHelper.generate(payload, credentials);

    sinon.assert.calledOnceWithExactly(trainerMissionGetPdf, data);

    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'ordre mission program Matrice FOR', file: 'test.pdf', contentType: 'application/pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        courses: [courseId],
        fee: 1200,
        trainer: trainerId,
        file: { publicId: 'yo', link: 'yo' },
        createdBy: credentials._id,
        creationMethod: GENERATION,
      }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [{ _id: { $in: [courseId] } }, { hasCertifyingTest: 1, misc: 1, type: 1, tradeName: 1 }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        {
          query: 'populate',
          args: [
            {
              path: 'subProgram',
              select: 'program steps',
              populate: [{ path: 'program', select: 'name' }, { path: 'steps', select: 'theoreticalDuration type' }],
            },
          ],
        },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate address' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        { query: 'lean' },
      ]
    );
  });

  it('should generate a trainer mission for several courses', async () => {
    const credentials = { _id: new ObjectId(), identity: { lastname: 'Doe', firstname: 'John' } };
    const courseIds = [new ObjectId(), new ObjectId()];
    const trainerId = new ObjectId();
    const courses = [
      {
        _id: courseIds[0],
        misc: 'test',
        type: INTRA,
        hasCertifyingTest: false,
        companies: [{ name: 'Alenvi' }],
        trainers: [{ _id: trainerId, identity: { lastname: 'For', firstname: 'Matrice' } }],
        tradeName: 'program 1',
        subProgram: {
          program: { name: 'program' },
          steps: [
            { theoreticalDuration: 'PT7200S', type: 'on_site' },
            { theoreticalDuration: 'PT7200S', type: 'on_site' },
            { theoreticalDuration: 'PT9000S', type: 'on_site' },
          ],
        },
        slots: [
          {
            startDate: '2023-12-12T10:00:00.000Z',
            endDate: '2023-12-12T12:00:00.000Z',
            address: { fullAddress: '3 rue du château', city: 'Paris' },
          },
          {
            startDate: '2023-12-13T10:00:00.000Z',
            endDate: '2023-12-13T12:00:00.000Z',
            address: { fullAddress: '6 rue du château', city: 'Paris' },
          },
        ],
        slotsToPlan: [{ _id: new ObjectId() }],
      },
      {
        _id: courseIds[1],
        misc: 'test 2',
        type: INTRA,
        hasCertifyingTest: true,
        companies: [{ name: 'ASAPAD' }],
        trainer: { _id: trainerId, identity: { lastname: 'For', firstname: 'Matrice' } },
        tradeName: 'program 2',
        subProgram: {
          program: { name: 'program' },
          steps: [
            { theoreticalDuration: 'PT7200S', type: 'on_site' },
            { theoreticalDuration: 'PT7200S', type: 'on_site' },
            { theoreticalDuration: 'PT9000S', type: 'on_site' },
          ],
        },
        slots: [
          {
            startDate: '2023-12-14T10:00:00.000Z',
            endDate: '2023-12-14T12:00:00.000Z',
            address: { fullAddress: '3 rue du château', city: 'Paris' },
          },
          {
            startDate: '2023-12-15T10:00:00.000Z',
            endDate: '2023-12-15T12:00:00.000Z',
            address: { fullAddress: '6 rue du château', city: 'Paris' },
          },
          {
            startDate: '2023-12-16T10:00:00.000Z',
            endDate: '2023-12-16T12:00:00.000Z',
            address: { fullAddress: '7 rue du château', city: 'Paris' },
          },
        ],
        slotsToPlan: [],
      },
    ];
    const payload = { courses: courseIds, fee: 1200, trainer: trainerId };

    const data = {
      trainerIdentity: { lastname: 'For', firstname: 'Matrice' },
      program: 'program',
      slotsCount: 3,
      liveDuration: '6h30',
      groupCount: 2,
      companies: 'Alenvi, ASAPAD',
      addressList: ['Paris'],
      dates: ['12/12/2023', '13/12/2023', '14/12/2023', '15/12/2023', '16/12/2023'],
      slotsToPlan: 1,
      certification: [courses[1]],
      fee: 1200,
      createdBy: 'John DOE',
    };

    uploadCourseFile.returns({ publicId: 'yo', link: 'yo' });
    courseFind.returns(SinonMongoose.stubChainedQueries(courses));
    trainerMissionGetPdf.returns('test.pdf');

    await trainerMissionsHelper.generate(payload, credentials);

    sinon.assert.calledOnceWithExactly(trainerMissionGetPdf, data);

    sinon.assert.calledOnceWithExactly(
      uploadCourseFile,
      { fileName: 'ordre mission program Matrice FOR', file: 'test.pdf', contentType: 'application/pdf' }
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        courses: courseIds,
        fee: 1200,
        trainer: trainerId,
        file: { publicId: 'yo', link: 'yo' },
        createdBy: credentials._id,
        creationMethod: GENERATION,
      }
    );
    SinonMongoose.calledOnceWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [{ _id: { $in: courseIds } }, { hasCertifyingTest: 1, misc: 1, type: 1, tradeName: 1 }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        {
          query: 'populate',
          args: [
            {
              path: 'subProgram',
              select: 'program steps',
              populate: [{ path: 'program', select: 'name' }, { path: 'steps', select: 'theoreticalDuration type' }],
            },
          ],
        },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate address' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('update', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(TrainerMission, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should cancel a trainer mission', async () => {
    const trainerMission = { _id: new ObjectId() };
    const payload = { cancelledAt: '2023-01-05T23:00:00.000Z' };

    await trainerMissionsHelper.update(trainerMission._id, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: trainerMission._id }, { $set: payload });
  });
});
