const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Questionnaire = require('../../../src/models/Questionnaire');
const Course = require('../../../src/models/Course');
const Card = require('../../../src/models/Card');
const QuestionnaireHelper = require('../../../src/helpers/questionnaires');
const CardHelper = require('../../../src/helpers/cards');
const {
  EXPECTATIONS,
  PUBLISHED,
  END_OF_COURSE,
  INTRA,
  TRAINING_ORGANISATION_MANAGER,
  TRAINER,
  SELF_POSITIONNING,
  START_COURSE,
  END_COURSE,
  DRAFT,
  STRICTLY_E_LEARNING,
  OPEN_QUESTION,
  SURVEY,
  REVIEW,
  LIST,
} = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');
const UtilsMock = require('../../utilsMock');

describe('create', () => {
  let create;
  beforeEach(() => {
    create = sinon.stub(Questionnaire, 'create');
  });
  afterEach(() => {
    create.restore();
  });

  it('should create questionnaire', async () => {
    const newQuestionnaire = { name: 'test', type: 'expectations' };
    await QuestionnaireHelper.create(newQuestionnaire);

    sinon.assert.calledOnceWithExactly(create, newQuestionnaire);
  });
});

describe('list', () => {
  let findQuestionnaires;
  let findOneCourse;

  beforeEach(() => {
    findQuestionnaires = sinon.stub(Questionnaire, 'find');
    findOneCourse = sinon.stub(Course, 'findOne');
    UtilsMock.mockCurrentDate('2021-04-13T15:00:00.000Z');
  });
  afterEach(() => {
    findQuestionnaires.restore();
    findOneCourse.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should return all questionnaires (DRAFT OR PUBLISHED)', async () => {
    const credentials = { role: { vendor: { name: TRAINING_ORGANISATION_MANAGER } } };
    const questionnairesList = [
      { name: 'test', type: EXPECTATIONS, status: PUBLISHED },
      { name: 'test2', type: EXPECTATIONS, status: DRAFT },
      { name: 'test2', type: END_OF_COURSE, status: DRAFT },
      { name: 'auto-eval', type: SELF_POSITIONNING, status: PUBLISHED },
    ];

    findQuestionnaires.returns(SinonMongoose.stubChainedQueries(questionnairesList));

    const result = await QuestionnaireHelper.list(credentials);

    expect(result).toMatchObject(questionnairesList);
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        { query: 'find', args: [{}] },
        {
          query: 'populate',
          args: [[{ path: 'historiesCount', options: { isVendorUser: true } }, { path: 'program', select: 'name' }]],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should return an empty array if course is strictly e-learning', async () => {
    const courseId = new ObjectId();
    const credentials = { role: { vendor: { name: TRAINING_ORGANISATION_MANAGER } } };
    const course = { _id: courseId, format: STRICTLY_E_LEARNING };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));

    const result = await QuestionnaireHelper.list(credentials, { course: courseId });

    expect(result).toMatchObject([]);
    sinon.assert.notCalled(findQuestionnaires);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return all published questionnaires', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-20T09:00:00.000Z', endDate: '2021-04-20T11:00:00.000Z' }],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };
    const questionnaires = [
      { _id: new ObjectId(), name: 'test', status: PUBLISHED, type: EXPECTATIONS },
      {
        _id: new ObjectId(),
        name: 'auto-positionnement',
        status: PUBLISHED,
        type: SELF_POSITIONNING,
        program: programId,
      },
      { _id: new ObjectId(), name: 'fin de formation', status: PUBLISHED, type: END_OF_COURSE },
    ];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries(questionnaires));

    const result = await QuestionnaireHelper.list(credentials, { course: courseId });

    expect(result).toMatchObject(questionnaires);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [{ $or: [{ program: { $exists: false } }, { program: programId }], status: PUBLISHED }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('getQuestionnaire', () => {
  let findOne;
  beforeEach(() => {
    findOne = sinon.stub(Questionnaire, 'findOne');
  });
  afterEach(() => {
    findOne.restore();
  });

  it('should return questionnaire', async () => {
    const questionnaireId = new ObjectId();
    const questionnaire = { _id: questionnaireId, name: 'test' };

    findOne.returns(SinonMongoose.stubChainedQueries(questionnaire));

    const result = await QuestionnaireHelper.getQuestionnaire(questionnaireId);

    expect(result).toMatchObject(questionnaire);
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: questionnaireId }] },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });
});

describe('editQuestionnaire', () => {
  let findOneAndUpdate;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(Questionnaire, 'findOneAndUpdate');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
  });

  it('should update questionnaire', async () => {
    const questionnaireId = new ObjectId();
    const cards = [new ObjectId(), new ObjectId()];
    const questionnaire = { _id: questionnaireId, name: 'test2', cards };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(questionnaire, ['lean']));

    const result = await QuestionnaireHelper.update(questionnaireId, { name: 'test2', cards });

    expect(result).toMatchObject(questionnaire);
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: questionnaireId }, { $set: { name: 'test2', cards } }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('addCard', () => {
  let createCard;
  let updateOne;
  beforeEach(() => {
    createCard = sinon.stub(CardHelper, 'createCard');
    updateOne = sinon.stub(Questionnaire, 'updateOne');
  });
  afterEach(() => {
    createCard.restore();
    updateOne.restore();
  });

  it('should add card to questionnaire', async () => {
    const cardId = new ObjectId();
    const payload = { template: 'transition' };
    const questionnaire = { _id: new ObjectId(), name: 'faire du jetski' };

    createCard.returns({ _id: cardId });

    await QuestionnaireHelper.addCard(questionnaire._id, payload);

    sinon.assert.calledOnceWithExactly(createCard, payload);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: questionnaire._id }, { $push: { cards: cardId } });
  });
});

describe('removeCard', () => {
  let findOneAndDeleteCard;
  let updateOne;
  let deleteMedia;
  beforeEach(() => {
    findOneAndDeleteCard = sinon.stub(Card, 'findOneAndDelete');
    updateOne = sinon.stub(Questionnaire, 'updateOne');
    deleteMedia = sinon.stub(CardHelper, 'deleteMedia');
  });
  afterEach(() => {
    findOneAndDeleteCard.restore();
    updateOne.restore();
    deleteMedia.restore();
  });

  it('should remove card without media from questionnaire', async () => {
    const cardId = new ObjectId();

    findOneAndDeleteCard.returns(SinonMongoose.stubChainedQueries(null, ['lean']));

    await QuestionnaireHelper.removeCard(cardId);

    sinon.assert.calledOnceWithExactly(updateOne, { cards: cardId }, { $pull: { cards: cardId } });
    sinon.assert.notCalled(deleteMedia);
    SinonMongoose.calledOnceWithExactly(
      findOneAndDeleteCard,
      [
        { query: 'findOneAndDelete', args: [{ _id: cardId }, { 'media.publicId': 1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should remove card with media from questionnaire', async () => {
    const cardId = new ObjectId();
    const card = { _id: cardId, media: { publicId: 'publicId' } };

    findOneAndDeleteCard.returns(SinonMongoose.stubChainedQueries(card, ['lean']));

    await QuestionnaireHelper.removeCard(cardId);

    sinon.assert.calledOnceWithExactly(updateOne, { cards: cardId }, { $pull: { cards: cardId } });
    sinon.assert.calledOnceWithExactly(deleteMedia, cardId, 'publicId');
    SinonMongoose.calledOnceWithExactly(
      findOneAndDeleteCard,
      [
        { query: 'findOneAndDelete', args: [{ _id: cardId }, { 'media.publicId': 1 }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('getUserQuestionnaires', () => {
  let findQuestionnaires;
  let findOneCourse;
  beforeEach(() => {
    findQuestionnaires = sinon.stub(Questionnaire, 'find');
    UtilsMock.mockCurrentDate('2021-04-13T15:00:00.000Z');
    findOneCourse = sinon.stub(Course, 'findOne');
  });
  afterEach(() => {
    findQuestionnaires.restore();
    UtilsMock.unmockCurrentDate();
    findOneCourse.restore();
  });

  it('should return an empty array if course is strictly e-learning', async () => {
    const courseId = new ObjectId();
    const credentials = { _id: new ObjectId() };
    const course = { _id: courseId, format: STRICTLY_E_LEARNING };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([]);
    sinon.assert.notCalled(findQuestionnaires);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return an empty array if course has not started and there is no questionnaire', async () => {
    const courseId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-20T09:00:00.000Z', endDate: '2021-04-20T11:00:00.000Z' }],
      slotsToPlan: [],
      subProgram: { program: { _id: new ObjectId() } },
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries([]));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([]);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [EXPECTATIONS, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: START_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return an empty array if course has not started and published questionnaires are answered', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-20T09:00:00.000Z', endDate: '2021-04-20T11:00:00.000Z' }],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    const questionnaires = [
      {
        _id: new ObjectId(),
        name: 'Questionnaire de recueil des attentes',
        type: EXPECTATIONS,
        status: PUBLISHED,
        histories: [{ _id: new ObjectId(), course: course._id, user: credentials._id }],
      },
      {
        _id: new ObjectId(),
        name: 'Questionnaire d\'auto-positionnement',
        program: programId,
        type: SELF_POSITIONNING,
        status: PUBLISHED,
        histories: [
          {
            _id: new ObjectId(),
            course: course._id,
            user: credentials._id,
            program: programId,
            timeline: START_COURSE,
          },
        ],
      },
    ];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries(questionnaires));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([]);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [EXPECTATIONS, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: START_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return published questionnaires if course has not started and questionnaires'
    + 'are not answered (EXPECTATION and SELF_POSITIONNING)', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId() };
    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-20T09:00:00.000Z', endDate: '2021-04-20T11:00:00.000Z' }],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };
    const questionnaires = [
      { _id: new ObjectId(), name: 'test', status: PUBLISHED, type: EXPECTATIONS, histories: [] },
      {
        _id: new ObjectId(),
        name: 'brouillon',
        status: DRAFT,
        type: SELF_POSITIONNING,
        program: programId,
        histories: [],
      },
    ];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries([questionnaires[0]]));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([questionnaires[0]]);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [EXPECTATIONS, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: START_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return questionnaires if no slots (EXPECTATIONS and SELF_POSITIONNING)', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();

    const credentials = { _id: new ObjectId() };
    const course = { _id: courseId, slots: [], subProgram: { program: { _id: programId } }, slotsToPlan: [] };
    const questionnaires = [
      { _id: new ObjectId(), name: 'test', type: EXPECTATIONS, status: PUBLISHED, histories: [] },
      {
        _id: new ObjectId(),
        name: 'Auto-positionnement',
        status: PUBLISHED,
        type: SELF_POSITIONNING,
        program: programId,
        histories: [],
      },
    ];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries(questionnaires));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject(questionnaires);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [EXPECTATIONS, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: START_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return questionnaires if course has slots and mid course has to be planned', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-01T09:00:00.000Z', endDate: '2021-04-01T11:00:00.000Z' }],
      slotsToPlan: [{ _id: new ObjectId() }, { _id: new ObjectId() }, { _id: new ObjectId() }],
      subProgram: { program: { _id: programId } },
    };

    const questionnaires = [
      { name: 'test', type: EXPECTATIONS, status: PUBLISHED, histories: [] },
      { name: 'test2', type: SELF_POSITIONNING, status: PUBLISHED, histories: [] },
    ];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries(questionnaires));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject(questionnaires);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [EXPECTATIONS, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: START_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return [] if half of course has been completed and there are still slots to plan', async () => {
    const courseId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-11T09:00:00.000Z', endDate: '2021-04-11T11:00:00.000Z' }],
      slotsToPlan: [{ _id: new ObjectId() }],
      subProgram: { program: { _id: new ObjectId() } },
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([]);
    sinon.assert.notCalled(findQuestionnaires);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return an empty array if course has ended and any questionnaire is published', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-11T09:00:00.000Z', endDate: '2021-04-11T11:00:00.000Z' }],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries([]));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([]);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [END_OF_COURSE, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: END_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return an empty array if course has ended and published questionnaires are already answered', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-11T09:00:00.000Z', endDate: '2021-04-11T11:00:00.000Z' }],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    const questionnaires = [
      {
        _id: new ObjectId(),
        name: 'test',
        type: END_OF_COURSE,
        status: PUBLISHED,
        histories: [{ _id: new ObjectId(), course: course._id, user: credentials._id }],
      },
      {
        _id: new ObjectId(),
        name: 'Questionnaire d\'auto-positionnement',
        program: programId,
        type: SELF_POSITIONNING,
        status: PUBLISHED,
        histories: [
          {
            _id: new ObjectId(),
            course: course._id,
            user: credentials._id,
            program: programId,
            timeline: END_COURSE,
          },
        ],
      },
    ];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    UtilsMock.mockCurrentDate('2021-04-23T15:00:00.000Z');
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries(questionnaires));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([]);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [END_OF_COURSE, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: END_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return questionnaires if course ends today and end_course self-positionning questionnaire'
    + 'are not answered', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      slots: [
        { startDate: '2021-04-10T14:00:00.000Z', endDate: '2021-04-10T16:00:00.000Z' },
        { startDate: '2021-04-10T16:30:00.000Z', endDate: '2021-04-10T18:30:00.000Z' },
        { startDate: '2021-04-13T14:00:00.000Z', endDate: '2021-04-13T16:00:00.000Z' },
        { startDate: '2021-04-13T16:30:00.000Z', endDate: '2021-04-13T18:30:00.000Z' },
      ],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    const questionnaires = [
      {
        _id: new ObjectId(),
        name: 'test',
        type: END_OF_COURSE,
        status: PUBLISHED,
        histories: [],
      },
      {
        _id: new ObjectId(),
        name: 'Questionnaire d\'auto-positionnement',
        program: programId,
        type: SELF_POSITIONNING,
        status: PUBLISHED,
        histories: [],
      },
    ];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries(questionnaires));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject(questionnaires);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [END_OF_COURSE, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: END_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return questionnaires if last slot has started and questionnaires are not answered', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-23T09:00:00.000Z', endDate: '2021-04-23T11:00:00.000Z' }],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    const questionnaires = [
      { _id: new ObjectId(), name: 'test', type: 'end_of_course', histories: [] },
      {
        _id: new ObjectId(),
        name: 'Questionnaire d\'auto-positionnement',
        program: programId,
        type: SELF_POSITIONNING,
        status: PUBLISHED,
        histories: [{ _id: new ObjectId(), course: course._id, user: credentials._id, timeline: END_COURSE }],
      },
    ];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    UtilsMock.mockCurrentDate('2021-04-23T15:00:00.000Z');
    findQuestionnaires.returns(SinonMongoose.stubChainedQueries(questionnaires));

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([questionnaires[0]]);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaires,
      [
        {
          query: 'find',
          args: [
            {
              type: { $in: [END_OF_COURSE, SELF_POSITIONNING] },
              $or: [{ program: { $exists: false } }, { program: course.subProgram.program._id }],
              status: PUBLISHED,
            },
            { type: 1, name: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              course: course._id,
              user: credentials._id,
              $or: [{ timeline: { $exists: false } }, { timeline: END_COURSE }],
            },
            options: { requestingOwnInfos: true },
            select: { _id: 1, timeline: 1 },
          }],
        },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    UtilsMock.unmockCurrentDate();
  });

  it('should return an empty array if half course has been completed and last slot has not started', async () => {
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const credentials = { _id: new ObjectId() };

    const course = {
      _id: courseId,
      format: 'blended',
      slots: [
        { startDate: '2021-04-20T09:00:00.000Z', endDate: '2021-04-20T11:00:00.000Z' },
        { startDate: '2021-04-24T09:00:00.000Z', endDate: '2021-04-24T11:00:00.000Z' },
      ],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    UtilsMock.mockCurrentDate('2021-04-23T15:00:00.000Z');

    const result = await QuestionnaireHelper.getUserQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([]);
    sinon.assert.notCalled(findQuestionnaires);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        {
          query: 'populate',
          args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
    UtilsMock.unmockCurrentDate();
  });
});

describe('getFollowUp', () => {
  let courseFindOne;
  let questionnaireFindOne;
  const credentials = { role: { vendor: { name: TRAINER } } };

  beforeEach(() => {
    courseFindOne = sinon.stub(Course, 'findOne');
    questionnaireFindOne = sinon.stub(Questionnaire, 'findOne');
  });
  afterEach(() => {
    courseFindOne.restore();
    questionnaireFindOne.restore();
  });

  describe('REVIEW', () => {
    it('should return follow up for course', async () => {
      const questionnaireId = new ObjectId();
      const courseId = new ObjectId();
      const companyId = new ObjectId();
      const trainees = [new ObjectId(), new ObjectId()];

      const course = {
        _id: courseId,
        companies: [{ name: 'company' }],
        holding: [{ name: 'société mère' }],
        subProgram: { program: { name: 'test' } },
        misc: 'infos',
        type: INTRA,
        trainees: [
          { identity: { firstname: 'tomTom', lastname: 'Nana' } },
          { identity: { firstname: 'eleve', lastname: 'Ducobu' } },
        ],
      };
      const cardsIds = [new ObjectId(), new ObjectId()];
      const historiesIds = [new ObjectId(), new ObjectId()];
      const questionnaire = {
        _id: questionnaireId,
        type: SELF_POSITIONNING,
        name: 'questionnaire',
        histories: [
          {
            _id: historiesIds[0],
            course: course._id,
            company: companyId,
            user: trainees[0],
            questionnaireAnswersList: [
              {
                card: {
                  _id: cardsIds[0],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'savez-vous cuisiner ?',
                  labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
                },
                answerList: ['3'],
              },
              {
                card: {
                  _id: cardsIds[1],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'aimez vous ce test ?',
                  labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
                },
                answerList: ['3'],
              },
            ],
            timeline: START_COURSE,
          },
          {
            _id: historiesIds[1],
            course: course._id,
            company: companyId,
            user: trainees[1],
            questionnaireAnswersList: [
              {
                card: {
                  _id: cardsIds[0],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'savez-vous cuisiner ?',
                  labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
                },
                answerList: ['5'],
              },
              {
                card: {
                  _id: cardsIds[1],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'aimez vous ce test ?',
                  labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
                },
                answerList: ['2'],
              },
            ],
            timeline: END_COURSE,
            isValidated: true,
            trainerComment: 'commentaire de validation',
          },
        ],
      };

      courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['select', 'populate', 'lean']));
      questionnaireFindOne.returns(SinonMongoose.stubChainedQueries(questionnaire, ['select', 'populate', 'lean']));

      const query = { course: courseId, action: REVIEW };
      const result = await QuestionnaireHelper.getFollowUp(questionnaireId, query, credentials);

      expect(result).toEqual({
        course: {
          _id: courseId,
          subProgram: { program: { name: 'test' } },
          type: INTRA,
          companies: [{ name: 'company' }],
          holding: [{ name: 'société mère' }],
          misc: 'infos',
          trainees: [
            { identity: { firstname: 'tomTom', lastname: 'Nana' } },
            { identity: { firstname: 'eleve', lastname: 'Ducobu' } },
          ],
        },
        followUp: [
          {
            _id: historiesIds[0],
            user: trainees[0],
            timeline: START_COURSE,
            questionnaireAnswersList: [
              {
                card: {
                  _id: cardsIds[0],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'savez-vous cuisiner ?',
                  labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
                },
                answerList: ['3'],
              },
              {
                card: {
                  _id: cardsIds[1],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'aimez vous ce test ?',
                  labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
                },
                answerList: ['3'],
              },
            ],
          },
          {
            _id: historiesIds[1],
            user: trainees[1],
            timeline: END_COURSE,
            isValidated: true,
            trainerComment: 'commentaire de validation',
            questionnaireAnswersList: [
              {
                card: {
                  _id: cardsIds[0],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'savez-vous cuisiner ?',
                  labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
                },
                answerList: ['5'],
              },
              {
                card: {
                  _id: cardsIds[1],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'aimez vous ce test ?',
                  labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
                },
                answerList: ['2'],
              },
            ],
          },
        ],
      });

      SinonMongoose.calledOnceWithExactly(
        questionnaireFindOne,
        [
          { query: 'findOne', args: [{ _id: questionnaireId }] },
          { query: 'select', args: ['type name'] },
          {
            query: 'populate',
            args: [{
              path: 'histories',
              match: { course: courseId },
              options: { isVendorUser: true },
              select: '-__v -updatedAt',
              populate: [
                { path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' },
                {
                  path: 'course',
                  select: 'trainers subProgram misc companies type',
                  populate: [
                    { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id name' } },
                    { path: 'companies', select: 'name' },
                  ],
                },
              ],
            }],
          },
          { query: 'lean' },
        ]
      );
      SinonMongoose.calledOnceWithExactly(
        courseFindOne,
        [
          { query: 'findOne', args: [{ _id: courseId }] },
          { query: 'select', args: ['subProgram companies misc type holding trainees'] },
          {
            query: 'populate',
            args: [{ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] }],
          },
          { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
          { query: 'populate', args: [{ path: 'holding', select: 'name' }] },
          { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
          { query: 'lean' },
        ]
      );
    });

    it('should return an empty array for followUp if histories is empty', async () => {
      const questionnaireId = new ObjectId();
      const courseId = new ObjectId();

      const course = {
        _id: courseId,
        companies: [{ name: 'company' }],
        holding: [{ name: 'société mère' }],
        subProgram: { program: { name: 'test' } },
        misc: 'infos',
        type: INTRA,
        trainees: [
          { identity: { firstname: 'tomTom', lastname: 'Nana' } },
          { identity: { firstname: 'eleve', lastname: 'Ducobu' } },
        ],
      };
      const questionnaire = {
        _id: questionnaireId,
        type: SELF_POSITIONNING,
        name: 'questionnaire',
        histories: [],
      };

      courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['select', 'populate', 'lean']));
      questionnaireFindOne.returns(SinonMongoose.stubChainedQueries(questionnaire, ['select', 'populate', 'lean']));

      const query = { course: courseId, action: REVIEW };
      const result = await QuestionnaireHelper.getFollowUp(questionnaireId, query, credentials);

      expect(result).toEqual({
        course: {
          _id: courseId,
          subProgram: { program: { name: 'test' } },
          type: INTRA,
          companies: [{ name: 'company' }],
          holding: [{ name: 'société mère' }],
          misc: 'infos',
          trainees: [
            { identity: { firstname: 'tomTom', lastname: 'Nana' } },
            { identity: { firstname: 'eleve', lastname: 'Ducobu' } },
          ],
        },
        followUp: [],
      });

      SinonMongoose.calledOnceWithExactly(
        questionnaireFindOne,
        [
          { query: 'findOne', args: [{ _id: questionnaireId }] },
          { query: 'select', args: ['type name'] },
          {
            query: 'populate',
            args: [{
              path: 'histories',
              match: { course: courseId },
              options: { isVendorUser: true },
              select: '-__v -updatedAt',
              populate: [
                { path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' },
                {
                  path: 'course',
                  select: 'trainers subProgram misc companies type',
                  populate: [
                    { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id name' } },
                    { path: 'companies', select: 'name' },
                  ],
                },
              ],
            }],
          },
          { query: 'lean' },
        ]
      );
      SinonMongoose.calledOnceWithExactly(
        courseFindOne,
        [
          { query: 'findOne', args: [{ _id: courseId }] },
          { query: 'select', args: ['subProgram companies misc type holding trainees'] },
          {
            query: 'populate',
            args: [{ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] }],
          },
          { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
          { query: 'populate', args: [{ path: 'holding', select: 'name' }] },
          { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
          { query: 'lean' },
        ]
      );
    });
  });

  describe('LIST', () => {
    it('should return follow up for course', async () => {
      const questionnaireId = new ObjectId();
      const courseId = new ObjectId();
      const companyId = new ObjectId();
      const course = {
        _id: courseId,
        companies: [{ name: 'company' }],
        subProgram: { program: { name: 'test' } },
        misc: 'infos',
        type: INTRA,
      };
      const traineeIds = [new ObjectId(), new ObjectId()];
      const cardsIds = [new ObjectId(), new ObjectId()];
      const historyIds = [new ObjectId(), new ObjectId(), new ObjectId()];
      const questionnaire = {
        _id: questionnaireId,
        type: EXPECTATIONS,
        name: 'questionnaire',
        histories: [
          {
            _id: historyIds[0],
            course: course._id,
            company: companyId,
            questionnaireAnswersList: [
              {
                card: { _id: cardsIds[0], template: OPEN_QUESTION, isMandatory: true, question: 'aimes-tu ce test ?' },
                answerList: ['blabla'],
              },
              {
                card: {
                  _id: cardsIds[1],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'combien aimez vous ce test sur une échelle de 1 à 5 ?',
                  labels: { 1: 'first', 5: 'last' },
                },
                answerList: ['3'],
              },
            ],
            user: traineeIds[0],
            createdAt: '2024-08-01T11:00:00.000Z',
            timeline: START_COURSE,
          },
          {
            _id: historyIds[1],
            course: course._id,
            company: companyId,
            questionnaireAnswersList: [
              {
                card: {
                  _id: cardsIds[0],
                  template: OPEN_QUESTION,
                  isMandatory: true,
                  question: 'aimes-tu ce test ?',
                },
                answerList: ['test test'],
              },
              {
                card: {
                  _id: cardsIds[1],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'combien aimez vous ce test sur une échelle de 1 à 5 ?',
                  labels: { 1: 'first', 5: 'last' },
                },
                answerList: ['2'],
              },
            ],
            user: traineeIds[1],
            createdAt: '2024-08-02T11:00:00.000Z',
            timeline: END_COURSE,
          },
        ],
      };

      courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['select', 'populate', 'lean']));
      questionnaireFindOne.returns(SinonMongoose.stubChainedQueries(questionnaire, ['select', 'populate', 'lean']));

      const query = { course: courseId, action: LIST };
      const result = await QuestionnaireHelper.getFollowUp(questionnaireId, query, credentials);

      expect(result).toEqual({
        course: { programName: 'test', companyName: 'company', misc: 'infos' },
        questionnaire: { type: EXPECTATIONS, name: 'questionnaire' },
        followUp: [
          {
            _id: cardsIds[0],
            answers: [
              {
                answer: 'blabla',
                course: course._id,
                traineeCompany: companyId,
                history: historyIds[0],
                trainee: traineeIds[0],
                createdAt: '2024-08-01T11:00:00.000Z',
                timeline: START_COURSE,
              },
              {
                answer: 'test test',
                course: course._id,
                traineeCompany: companyId,
                history: historyIds[1],
                trainee: traineeIds[1],
                createdAt: '2024-08-02T11:00:00.000Z',
                timeline: END_COURSE,
              },
            ],
            isMandatory: true,
            question: 'aimes-tu ce test ?',
            template: 'open_question',
          },
          {
            _id: cardsIds[1],
            answers: [
              {
                answer: '3',
                course: course._id,
                traineeCompany: companyId,
                history: historyIds[0],
                trainee: traineeIds[0],
                createdAt: '2024-08-01T11:00:00.000Z',
                timeline: START_COURSE,
              },
              {
                answer: '2',
                course: course._id,
                traineeCompany: companyId,
                history: historyIds[1],
                trainee: traineeIds[1],
                createdAt: '2024-08-02T11:00:00.000Z',
                timeline: END_COURSE,
              },
            ],
            isMandatory: true,
            question: 'combien aimez vous ce test sur une échelle de 1 à 5 ?',
            template: 'survey',
            labels: { 1: 'first', 5: 'last' },
          },
        ],
      });
      SinonMongoose.calledOnceWithExactly(
        courseFindOne,
        [
          { query: 'findOne', args: [{ _id: courseId }] },
          { query: 'select', args: ['subProgram companies misc type'] },
          {
            query: 'populate',
            args: [{ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] }],
          },
          { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
          { query: 'lean' },
        ]
      );
      SinonMongoose.calledOnceWithExactly(
        questionnaireFindOne,
        [
          { query: 'findOne', args: [{ _id: questionnaireId }] },
          { query: 'select', args: ['type name'] },
          {
            query: 'populate',
            args: [{
              path: 'histories',
              match: { course: courseId },
              options: { isVendorUser: true },
              select: '-__v -updatedAt',
              populate: [
                { path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' },
                {
                  path: 'course',
                  select: 'trainers subProgram misc companies type',
                  populate: [
                    { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id name' } },
                    { path: 'companies', select: 'name' },
                  ],
                },
              ],
            }],
          },
          { query: 'lean' },
        ]
      );
    });

    it('should return follow up for all courses', async () => {
      const questionnaireId = new ObjectId();
      const cardsIds = [new ObjectId(), new ObjectId()];
      const companyId = new ObjectId();
      const traineeId = new ObjectId();
      const historyIds = [new ObjectId(), new ObjectId()];
      const questionnaire = {
        _id: questionnaireId,
        type: EXPECTATIONS,
        name: 'questionnaire',
        histories: [
          {
            _id: historyIds[0],
            course: new ObjectId(),
            company: companyId,
            questionnaireAnswersList: [
              {
                card: { _id: cardsIds[0], template: OPEN_QUESTION, isMandatory: true, question: 'aimes-tu ce test ?' },
                answerList: ['blabla'],
              },
              {
                card: {
                  _id: cardsIds[1],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'combien aimez vous ce test sur une échelle de 1 à 5 ?',
                  labels: { 1: 'first', 5: 'last' },
                },
                answerList: ['3'],
              },
            ],
            user: traineeId,
            createdAt: '2024-08-01T11:00:00.000Z',
            timeline: START_COURSE,
          },
          {
            _id: historyIds[1],
            course: new ObjectId(),
            company: companyId,
            questionnaireAnswersList: [
              {
                card: { _id: cardsIds[0], template: OPEN_QUESTION, isMandatory: true, question: 'aimes-tu ce test ?' },
                answerList: ['test test'],
              },
              {
                card: {
                  _id: cardsIds[1],
                  template: SURVEY,
                  isMandatory: true,
                  question: 'combien aimez vous ce test sur une échelle de 1 à 5 ?',
                  labels: { 1: 'first', 5: 'last' },
                },
                answerList: ['2'],
              },
            ],
            user: traineeId,
            createdAt: '2024-08-01T13:00:00.000Z',
            timeline: START_COURSE,
          },
        ],
      };

      questionnaireFindOne.returns(SinonMongoose.stubChainedQueries(questionnaire, ['select', 'populate', 'lean']));

      const result = await QuestionnaireHelper.getFollowUp(questionnaireId, { action: LIST }, credentials);

      expect(result).toEqual({
        questionnaire: { type: EXPECTATIONS, name: 'questionnaire' },
        followUp: [
          {
            _id: cardsIds[0],
            answers: [
              {
                answer: 'blabla',
                course: questionnaire.histories[0].course,
                traineeCompany: companyId,
                trainee: traineeId,
                history: historyIds[0],
                createdAt: '2024-08-01T11:00:00.000Z',
                timeline: START_COURSE,
              },
              {
                answer: 'test test',
                course: questionnaire.histories[1].course,
                traineeCompany: companyId,
                trainee: traineeId,
                history: historyIds[1],
                createdAt: '2024-08-01T13:00:00.000Z',
                timeline: START_COURSE,
              },
            ],
            isMandatory: true,
            question: 'aimes-tu ce test ?',
            template: OPEN_QUESTION,
          },
          {
            _id: cardsIds[1],
            answers: [
              {
                answer: '3',
                course: questionnaire.histories[0].course,
                traineeCompany: companyId,
                trainee: traineeId,
                history: historyIds[0],
                createdAt: '2024-08-01T11:00:00.000Z',
                timeline: START_COURSE,
              },
              {
                answer: '2',
                course: questionnaire.histories[1].course,
                traineeCompany: companyId,
                trainee: traineeId,
                history: historyIds[1],
                createdAt: '2024-08-01T13:00:00.000Z',
                timeline: START_COURSE,
              },
            ],
            isMandatory: true,
            question: 'combien aimez vous ce test sur une échelle de 1 à 5 ?',
            template: SURVEY,
            labels: { 1: 'first', 5: 'last' },
          },
        ],
      });
      SinonMongoose.calledOnceWithExactly(
        questionnaireFindOne,
        [
          { query: 'findOne', args: [{ _id: questionnaireId }] },
          { query: 'select', args: ['type name'] },
          {
            query: 'populate',
            args: [{
              path: 'histories',
              match: null,
              options: { isVendorUser: true },
              select: '-__v -updatedAt',
              populate: [
                { path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' },
                {
                  path: 'course',
                  select: 'trainers subProgram misc companies type',
                  populate: [
                    { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id name' } },
                    { path: 'companies', select: 'name' },
                  ],
                },
              ],
            }],
          },
          { query: 'lean' },
        ]
      );
    });

    it('should return an empty array for followUp if answerList is empty', async () => {
      const questionnaireId = new ObjectId();
      const courseId = new ObjectId();
      const companyId = new ObjectId();
      const course = {
        _id: courseId,
        companies: [{ name: 'company' }],
        subProgram: { program: { name: 'test' } },
        misc: 'infos',
        type: INTRA,
      };
      const questionnaire = {
        _id: questionnaireId,
        type: EXPECTATIONS,
        name: 'questionnaire',
        histories: [{
          _id: new ObjectId(),
          course: course._id,
          company: companyId,
          questionnaireAnswersList: [{
            card: { _id: new ObjectId(), template: OPEN_QUESTION, isMandatory: true, question: 'aimes-tu ce test ?' },
            answerList: [''],
          }],
        }],
      };

      courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['select', 'populate', 'lean']));
      questionnaireFindOne.returns(SinonMongoose.stubChainedQueries(questionnaire, ['select', 'populate', 'lean']));

      const query = { course: courseId, action: LIST };
      const result = await QuestionnaireHelper.getFollowUp(questionnaireId, query, credentials);

      expect(result).toMatchObject({
        course: {
          programName: 'test',
          companyName: 'company',
          misc: 'infos',
        },
        questionnaire: { type: EXPECTATIONS, name: 'questionnaire' },
        followUp: [],
      });
      SinonMongoose.calledOnceWithExactly(
        courseFindOne,
        [
          { query: 'findOne', args: [{ _id: courseId }] },
          { query: 'select', args: ['subProgram companies misc type'] },
          {
            query: 'populate',
            args: [{ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] }],
          },
          { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
          { query: 'lean' },
        ]
      );
      SinonMongoose.calledOnceWithExactly(
        questionnaireFindOne,
        [
          { query: 'findOne', args: [{ _id: questionnaireId }] },
          { query: 'select', args: ['type name'] },
          {
            query: 'populate',
            args: [{
              path: 'histories',
              match: { course: courseId },
              options: { isVendorUser: true },
              select: '-__v -updatedAt',
              populate: [
                { path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' },
                {
                  path: 'course',
                  select: 'trainers subProgram misc companies type',
                  populate: [
                    { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id name' } },
                    { path: 'companies', select: 'name' },
                  ],
                },
              ],
            }],
          },
          { query: 'lean' },
        ]
      );
    });

    it('should return an empty array for followUp if histories is empty', async () => {
      const questionnaireId = new ObjectId();
      const courseId = new ObjectId();
      const course = {
        _id: courseId,
        companies: [{ name: 'company' }],
        subProgram: { program: { name: 'test' } },
        misc: 'infos',
        type: INTRA,
      };
      const questionnaire = {
        _id: questionnaireId,
        type: EXPECTATIONS,
        name: 'questionnaire',
        histories: [],
      };

      courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['select', 'populate', 'lean']));
      questionnaireFindOne.returns(SinonMongoose.stubChainedQueries(questionnaire, ['select', 'populate', 'lean']));

      const query = { course: courseId, action: LIST };
      const result = await QuestionnaireHelper.getFollowUp(questionnaireId, query, credentials);

      expect(result).toMatchObject({
        course: {
          programName: 'test',
          companyName: 'company',
          misc: 'infos',
        },
        questionnaire: { type: EXPECTATIONS, name: 'questionnaire' },
        followUp: [],
      });
      SinonMongoose.calledOnceWithExactly(
        courseFindOne,
        [
          { query: 'findOne', args: [{ _id: courseId }] },
          { query: 'select', args: ['subProgram companies misc type'] },
          {
            query: 'populate',
            args: [{ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] }],
          },
          { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
          { query: 'lean' },
        ]
      );
      SinonMongoose.calledOnceWithExactly(
        questionnaireFindOne,
        [
          { query: 'findOne', args: [{ _id: questionnaireId }] },
          { query: 'select', args: ['type name'] },
          {
            query: 'populate',
            args: [{
              path: 'histories',
              match: { course: courseId },
              options: { isVendorUser: true },
              select: '-__v -updatedAt',
              populate: [
                { path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' },
                {
                  path: 'course',
                  select: 'trainers subProgram misc companies type',
                  populate: [
                    { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id name' } },
                    { path: 'companies', select: 'name' },
                  ],
                },
              ],
            }],
          },
          { query: 'lean' },
        ]
      );
    });

    it('should return an empty array for followUp if questionnaireAnswersList is empty', async () => {
      const questionnaireId = new ObjectId();
      const courseId = new ObjectId();
      const companyId = new ObjectId();
      const course = {
        _id: courseId,
        companies: [{ name: 'company' }],
        subProgram: { program: { name: 'test' } },
        misc: 'infos',
        type: INTRA,
      };
      const questionnaire = {
        _id: questionnaireId,
        type: EXPECTATIONS,
        name: 'questionnaire',
        histories: [{
          _id: new ObjectId(),
          course: course._id,
          company: companyId,
          questionnaireAnswersList: [],
        }],
      };

      courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['select', 'populate', 'lean']));
      questionnaireFindOne.returns(SinonMongoose.stubChainedQueries(questionnaire, ['select', 'populate', 'lean']));

      const query = { course: courseId, action: LIST };
      const result = await QuestionnaireHelper.getFollowUp(questionnaireId, query, credentials);

      expect(result).toMatchObject({
        course: {
          programName: 'test',
          companyName: 'company',
          misc: 'infos',
        },
        questionnaire: { type: EXPECTATIONS, name: 'questionnaire' },
        followUp: [],
      });
      SinonMongoose.calledOnceWithExactly(
        courseFindOne,
        [
          { query: 'findOne', args: [{ _id: courseId }] },
          { query: 'select', args: ['subProgram companies misc type'] },
          {
            query: 'populate',
            args: [{ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] }],
          },
          { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
          { query: 'lean' },
        ]
      );
      SinonMongoose.calledOnceWithExactly(
        questionnaireFindOne,
        [
          { query: 'findOne', args: [{ _id: questionnaireId }] },
          { query: 'select', args: ['type name'] },
          {
            query: 'populate',
            args: [{
              path: 'histories',
              match: { course: courseId },
              options: { isVendorUser: true },
              select: '-__v -updatedAt',
              populate: [
                { path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' },
                {
                  path: 'course',
                  select: 'trainers subProgram misc companies type',
                  populate: [
                    { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id name' } },
                    { path: 'companies', select: 'name' },
                  ],
                },
              ],
            }],
          },
          { query: 'lean' },
        ]
      );
    });
  });
});
