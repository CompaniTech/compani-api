const sinon = require('sinon');
const flat = require('flat');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Program = require('../../../src/models/Program');
const User = require('../../../src/models/User');
const Course = require('../../../src/models/Course');
const ProgramHelper = require('../../../src/helpers/programs');
const UserHelper = require('../../../src/helpers/users');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const SinonMongoose = require('../sinonMongoose');

describe('createProgram', () => {
  let create;
  beforeEach(() => {
    create = sinon.stub(Program, 'create');
  });
  afterEach(() => {
    create.restore();
  });

  it('should create program', async () => {
    const newProgram = { name: 'name', categories: [new ObjectId()] };
    await ProgramHelper.createProgram(newProgram);

    sinon.assert.calledOnceWithExactly(create, newProgram);
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(Program, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return programs', async () => {
    const programsList = [{ name: 'name' }, { name: 'program' }];

    find.returns(SinonMongoose.stubChainedQueries(programsList));

    const result = await ProgramHelper.list();
    expect(result).toMatchObject(programsList);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{}] },
        { query: 'populate', args: [{ path: 'subPrograms', populate: { path: 'steps', select: 'type' } }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });
});

describe('listELearning', () => {
  let programFind;
  let courseFind;
  beforeEach(() => {
    programFind = sinon.stub(Program, 'find');
    courseFind = sinon.stub(Course, 'find');
  });
  afterEach(() => {
    programFind.restore();
    courseFind.restore();
  });

  it('should return programs with elearning subprograms', async () => {
    const programsList = [{ name: 'name' }, { name: 'program' }];
    const subPrograms = [new ObjectId()];
    const companyId = new ObjectId();
    const credentials = { _id: new ObjectId(), company: { _id: companyId } };

    courseFind.returns(SinonMongoose.stubChainedQueries([{ subProgram: subPrograms[0] }], ['lean']));
    programFind.returns(SinonMongoose.stubChainedQueries(programsList));

    const result = await ProgramHelper.listELearning(credentials);
    expect(result).toMatchObject([{ name: 'name' }, { name: 'program' }]);

    SinonMongoose.calledOnceWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [
            { format: 'strictly_e_learning', $or: [{ accessRules: [] }, { accessRules: companyId }] },
            'subProgram',
          ],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      programFind,
      [
        { query: 'find', args: [{ subPrograms: { $in: subPrograms } }] },
        {
          query: 'populate',
          args: [{
            path: 'subPrograms',
            select: 'name',
            match: { _id: { $in: subPrograms } },
            populate: [
              { path: 'courses', select: '_id trainees', match: { format: 'strictly_e_learning' } },
              {
                path: 'steps',
                select: 'activities theoreticalDuration',
                populate: {
                  path: 'activities',
                  select: 'activityHistories',
                  populate: { path: 'activityHistories', match: { user: credentials._id } },
                },
              },
            ],
          }],
        },
        { query: 'populate', args: ['categories'] },
        { query: 'lean' },
      ]
    );
  });

  it('should return a specific program with elearning subprogram', async () => {
    const programId = new ObjectId();
    const programsList = [{ _id: programId, name: 'name' }];
    const subPrograms = [new ObjectId()];
    const companyId = new ObjectId();
    const credentials = { _id: new ObjectId(), company: { _id: companyId } };

    courseFind.returns(SinonMongoose.stubChainedQueries([{ subProgram: subPrograms[0] }], ['lean']));
    programFind.returns(SinonMongoose.stubChainedQueries(programsList));

    const result = await ProgramHelper.listELearning(credentials, { _id: programId });
    expect(result).toMatchObject([{ _id: programId, name: 'name' }]);

    SinonMongoose.calledOnceWithExactly(
      courseFind,
      [
        {
          query: 'find',
          args: [
            { format: 'strictly_e_learning', $or: [{ accessRules: [] }, { accessRules: companyId }] },
            'subProgram',
          ],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      programFind,
      [
        { query: 'find', args: [{ _id: programId, subPrograms: { $in: subPrograms } }] },
        {
          query: 'populate',
          args: [{
            path: 'subPrograms',
            select: 'name',
            match: { _id: { $in: subPrograms } },
            populate: [
              { path: 'courses', select: '_id trainees', match: { format: 'strictly_e_learning' } },
              {
                path: 'steps',
                select: 'activities theoreticalDuration',
                populate: {
                  path: 'activities',
                  select: 'activityHistories',
                  populate: { path: 'activityHistories', match: { user: credentials._id } },
                },
              },
            ],
          }],
        },
        { query: 'populate', args: ['categories'] },
        { query: 'lean' },
      ]
    );
  });
});

describe('getProgram', () => {
  let programFindOne;
  beforeEach(() => {
    programFindOne = sinon.stub(Program, 'findOne');
  });
  afterEach(() => {
    programFindOne.restore();
  });

  it('should return the requested program', async () => {
    const programId = new ObjectId();
    const otherProgramId = new ObjectId();
    const subProgramId = new ObjectId();
    const otherSubProgramId = new ObjectId();
    const stepId = new ObjectId();
    const activityId = new ObjectId();
    const cardsIds = [new ObjectId(), new ObjectId()];

    const program = {
      _id: programId,
      subPrograms: [{
        _id: subProgramId,
        steps: [{
          _id: stepId,
          activities: [{
            _id: activityId,
            cards: [{ _id: cardsIds[0], text: 'oui' }, { _id: cardsIds[1], text: 'non' }],
          }],
          subPrograms: [
            { _id: subProgramId, name: 'sp 1', program: { _id: programId, name: 'prog 1' } },
            { _id: otherSubProgramId, name: 'sp 2', program: { _id: otherProgramId, name: 'prog 2' } },
          ],
        }],
      }],
    };

    programFindOne.returns(SinonMongoose.stubChainedQueries(program));

    const result = await ProgramHelper.getProgram(program._id);

    expect(result).toMatchObject({
      _id: programId,
      subPrograms: [{
        _id: subProgramId,
        steps: [{
          _id: stepId,
          activities: [{
            _id: activityId,
            cards: cardsIds,
          }],
          subPrograms: [
            { _id: subProgramId, name: 'sp 1', program: { _id: programId, name: 'prog 1' } },
            { _id: otherSubProgramId, name: 'sp 2', program: { _id: otherProgramId, name: 'prog 2' } },
          ],
        }],
      }],
    });
    SinonMongoose.calledOnceWithExactly(
      programFindOne,
      [
        { query: 'findOne', args: [{ _id: program._id }] },
        {
          query: 'populate',
          args: [{
            path: 'subPrograms',
            populate: {
              path: 'steps',
              populate: [
                { path: 'activities', populate: 'cards' },
                {
                  path: 'subPrograms',
                  select: 'name -steps',
                  populate: { path: 'program', select: 'name -subPrograms' },
                },
              ],
            },
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'testers', select: 'identity.firstname identity.lastname local.email contact' }],
        },
        { query: 'populate', args: ['categories'] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });
});

describe('update', () => {
  let programUpdateOne;
  beforeEach(() => {
    programUpdateOne = sinon.stub(Program, 'updateOne');
  });
  afterEach(() => {
    programUpdateOne.restore();
  });

  it('should update name', async () => {
    const programId = new ObjectId();
    const payload = { name: 'toto' };

    programUpdateOne.returns({ _id: programId, name: 'toto' });

    await ProgramHelper.updateProgram(programId, payload);

    programUpdateOne.calledOnceWithExactly({ _id: programId }, { $set: payload });
  });
});

describe('uploadImage', () => {
  let updateOne;
  let uploadMedia;
  beforeEach(() => {
    updateOne = sinon.stub(Program, 'updateOne');
    uploadMedia = sinon.stub(GCloudStorageHelper, 'uploadProgramMedia');
  });
  afterEach(() => {
    updateOne.restore();
    uploadMedia.restore();
  });

  it('should upload image', async () => {
    uploadMedia.returns({
      publicId: 'jesuisunsupernomdefichier',
      link: 'https://storage.googleapis.com/BucketKFC/myMedia',
    });

    const programId = new ObjectId();
    const payload = { file: new ArrayBuffer(32), fileName: 'illustration' };

    await ProgramHelper.uploadImage(programId, payload);

    sinon.assert.calledOnceWithExactly(uploadMedia, { file: new ArrayBuffer(32), fileName: 'illustration' });
    sinon.assert.calledWithExactly(
      updateOne,
      { _id: programId },
      {
        $set: flat({
          image: { publicId: 'jesuisunsupernomdefichier', link: 'https://storage.googleapis.com/BucketKFC/myMedia' },
        }),
      }
    );
  });
});

describe('deleteImage', () => {
  let updateOne;
  let deleteMedia;
  beforeEach(() => {
    updateOne = sinon.stub(Program, 'updateOne');
    deleteMedia = sinon.stub(GCloudStorageHelper, 'deleteProgramMedia');
  });
  afterEach(() => {
    updateOne.restore();
    deleteMedia.restore();
  });

  it('should do nothing as publicId is not set', async () => {
    const programId = new ObjectId();
    await ProgramHelper.deleteImage(programId, '');

    sinon.assert.notCalled(updateOne);
    sinon.assert.notCalled(deleteMedia);
  });

  it('should update card and delete media', async () => {
    const programId = new ObjectId();
    await ProgramHelper.deleteImage(programId, 'publicId');

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: programId },
      { $unset: { image: '' } }
    );
    sinon.assert.calledOnceWithExactly(deleteMedia, 'publicId');
  });
});

describe('addCategory', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Program, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should add category', async () => {
    const programId = new ObjectId();
    const payload = { categoryId: new ObjectId() };
    await ProgramHelper.addCategory(programId, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: programId }, { $push: { categories: payload.categoryId } });
  });
});

describe('removeCategory', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Program, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should remove category', async () => {
    const programId = new ObjectId();
    const categoryId = new ObjectId();
    await ProgramHelper.removeCategory(programId, categoryId);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: programId }, { $pull: { categories: categoryId } });
  });
});

describe('addTester', () => {
  let findOne;
  let findOneAndUpdate;
  let createUser;

  beforeEach(() => {
    findOne = sinon.stub(User, 'findOne');
    findOneAndUpdate = sinon.stub(Program, 'findOneAndUpdate');
    createUser = sinon.stub(UserHelper, 'createUser');
  });

  afterEach(() => {
    findOne.restore();
    findOneAndUpdate.restore();
    createUser.restore();
  });

  it('should add existing user to program as tester', async () => {
    const programId = new ObjectId();
    const user = { _id: new ObjectId(), local: { email: 'test@test.fr' } };
    findOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries({ _id: programId }, ['lean']));

    await ProgramHelper.addTester(programId, user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ 'local.email': 'test@test.fr' }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: programId }, { $addToSet: { testers: user._id } }, { new: true }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(createUser);
  });

  it('should create a user and add it to program as tester', async () => {
    const programId = new ObjectId();
    const userId = new ObjectId();
    const payload = { local: { email: 'test@test.fr' } };

    findOne.returns(SinonMongoose.stubChainedQueries(null, ['lean']));
    createUser.returns({ ...payload, _id: userId });
    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries({ _id: programId }, ['lean']));

    await ProgramHelper.addTester(programId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ 'local.email': 'test@test.fr' }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: programId }, { $addToSet: { testers: userId } }, { new: true }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(createUser, { ...payload, origin: 'webapp' });
  });
});

describe('removeTester', () => {
  let updateOne;

  beforeEach(() => {
    updateOne = sinon.stub(Program, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should remove tester', async () => {
    const programId = new ObjectId();
    const testerId = new ObjectId();
    updateOne.returns({ _id: programId });

    await ProgramHelper.removeTester(programId, testerId);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: programId }, { $pull: { testers: testerId } });
  });
});
