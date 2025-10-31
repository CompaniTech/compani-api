const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const SinonMongoose = require('../sinonMongoose');
const QuestionnaireHistory = require('../../../src/models/QuestionnaireHistory');
const QuestionnaireHistoriesHelper = require('../../../src/helpers/questionnaireHistories');
const Questionnaire = require('../../../src/models/Questionnaire');
const Course = require('../../../src/models/Course');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
const {
  COURSE,
  TRAINEE,
  EXPECTATIONS,
  SELF_POSITIONNING,
  START_COURSE,
  END_COURSE,
  UNKNOWN,
  WEBAPP,
} = require('../../../src/helpers/constants');
const UtilsMock = require('../../utilsMock');

describe('addQuestionnaireHistory', () => {
  let create;
  let getCompanyAtCourseRegistrationList;
  let findOneQuestionnaire;
  let findOneCourse;
  let countDocumentsQH;

  beforeEach(() => {
    create = sinon.stub(QuestionnaireHistory, 'create');
    getCompanyAtCourseRegistrationList = sinon
      .stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
    findOneQuestionnaire = sinon.stub(Questionnaire, 'findOne');
    findOneCourse = sinon.stub(Course, 'findOne');
    countDocumentsQH = sinon.stub(QuestionnaireHistory, 'countDocuments');
    UtilsMock.mockCurrentDate('2021-04-13T10:00:00.000Z');
  });

  afterEach(() => {
    create.restore();
    getCompanyAtCourseRegistrationList.restore();
    findOneQuestionnaire.restore();
    findOneCourse.restore();
    countDocumentsQH.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should create a questionnaireHistory', async () => {
    const questionnaireId = new ObjectId();
    const questionnaire = { _id: questionnaireId, type: EXPECTATIONS };
    const company = new ObjectId();
    const userId = new ObjectId();
    const courseId = new ObjectId();
    const questionnaireAnswersList = [{ card: new ObjectId(), answerList: ['blabla'] }];

    getCompanyAtCourseRegistrationList.returns([{ company }, { company: new ObjectId() }]);
    findOneQuestionnaire.returns(SinonMongoose.stubChainedQueries(questionnaire, ['lean']));
    countDocumentsQH.returns(0);

    await QuestionnaireHistoriesHelper.addQuestionnaireHistory({
      course: courseId,
      user: userId,
      questionnaire: questionnaireId,
      questionnaireAnswersList,
    });

    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [userId] }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneQuestionnaire,
      [{ query: 'findOne', args: [{ _id: questionnaireId }, { type: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      countDocumentsQH,
      [{ query: 'countDocuments', args: [{ course: courseId, user: userId, questionnaire: questionnaireId }] }]
    );
    sinon.assert.calledOnceWithExactly(
      create,
      { course: courseId, user: userId, questionnaire: questionnaireId, questionnaireAnswersList, company }
    );
    sinon.assert.notCalled(findOneCourse);
  });

  it('should create a questionnaireHistory with timeline START_COURSE (SELF_POSITIONNING)', async () => {
    const questionnaireId = new ObjectId();
    const questionnaire = { _id: questionnaireId, type: SELF_POSITIONNING };
    const company = new ObjectId();
    const userId = new ObjectId();
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const questionnaireAnswersList = [{ card: new ObjectId(), answerList: ['blabla'] }];
    const course = {
      _id: courseId,
      slots: [{ startDate: '2021-04-20T09:00:00.000Z', endDate: '2021-04-20T11:00:00.000Z' }],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    getCompanyAtCourseRegistrationList.returns([{ company }, { company: new ObjectId() }]);
    findOneQuestionnaire.returns(SinonMongoose.stubChainedQueries(questionnaire, ['lean']));
    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    countDocumentsQH.returns(0);

    await QuestionnaireHistoriesHelper.addQuestionnaireHistory({
      course: courseId,
      user: userId,
      questionnaire: questionnaireId,
      questionnaireAnswersList,
    });

    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [userId] }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneQuestionnaire,
      [{ query: 'findOne', args: [{ _id: questionnaireId }, { type: 1 }] }, { query: 'lean' }]
    );
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
      countDocumentsQH,
      [
        {
          query: 'countDocuments',
          args: [{ course: courseId, user: userId, questionnaire: questionnaireId, timeline: START_COURSE }],
        },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        course: courseId,
        user: userId,
        questionnaire: questionnaireId,
        questionnaireAnswersList,
        company,
        timeline: START_COURSE,
      }
    );
  });

  it('should create a questionnaireHistory with timeline END_COURSE (SELF_POSITIONNING)', async () => {
    const questionnaireId = new ObjectId();
    const questionnaire = { _id: questionnaireId, type: SELF_POSITIONNING };
    const company = new ObjectId();
    const userId = new ObjectId();
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const questionnaireAnswersList = [{ card: new ObjectId(), answerList: ['blabla'] }];
    const course = {
      _id: courseId,
      slots: [
        { startDate: '2021-04-10T09:00:00.000Z', endDate: '2021-04-10T11:00:00.000Z' },
        { startDate: '2021-04-13T08:00:00.000Z', endDate: '2021-04-13T09:30:00.000Z' },
        { startDate: '2021-04-13T15:00:00.000Z', endDate: '2021-04-13T17:00:00.000Z' },
      ],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    getCompanyAtCourseRegistrationList.returns([{ company }, { company: new ObjectId() }]);
    findOneQuestionnaire.returns(SinonMongoose.stubChainedQueries(questionnaire, ['lean']));
    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    countDocumentsQH.returns(0);

    await QuestionnaireHistoriesHelper.addQuestionnaireHistory({
      course: courseId,
      user: userId,
      questionnaire: questionnaireId,
      questionnaireAnswersList,
    });

    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [userId] }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneQuestionnaire,
      [{ query: 'findOne', args: [{ _id: questionnaireId }, { type: 1 }] }, { query: 'lean' }]
    );
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
      countDocumentsQH,
      [
        {
          query: 'countDocuments',
          args: [{ course: courseId, user: userId, questionnaire: questionnaireId, timeline: END_COURSE }],
        },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        course: courseId,
        user: userId,
        questionnaire: questionnaireId,
        questionnaireAnswersList,
        company,
        timeline: END_COURSE,
      }
    );
  });

  it('should create a questionnaireHistory with timeline UNKNOWN (SELF_POSITIONNING)', async () => {
    const questionnaireId = new ObjectId();
    const questionnaire = { _id: questionnaireId, type: SELF_POSITIONNING };
    const company = new ObjectId();
    const userId = new ObjectId();
    const courseId = new ObjectId();
    const programId = new ObjectId();
    const questionnaireAnswersList = [{ card: new ObjectId(), answerList: ['blabla'] }];
    const course = {
      _id: courseId,
      slots: [
        { startDate: '2021-04-10T09:00:00.000Z', endDate: '2021-04-10T11:00:00.000Z' },
        { startDate: '2021-04-12T08:00:00.000Z', endDate: '2021-04-12T09:30:00.000Z' },
        { startDate: '2021-04-14T15:00:00.000Z', endDate: '2021-04-14T17:00:00.000Z' },
      ],
      slotsToPlan: [],
      subProgram: { program: { _id: programId } },
    };

    getCompanyAtCourseRegistrationList.returns([{ company }, { company: new ObjectId() }]);
    findOneQuestionnaire.returns(SinonMongoose.stubChainedQueries(questionnaire, ['lean']));
    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    countDocumentsQH.returns(0);

    await QuestionnaireHistoriesHelper.addQuestionnaireHistory({
      course: courseId,
      user: userId,
      questionnaire: questionnaireId,
      questionnaireAnswersList,
    });

    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [userId] }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneQuestionnaire,
      [{ query: 'findOne', args: [{ _id: questionnaireId }, { type: 1 }] }, { query: 'lean' }]
    );
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
      countDocumentsQH,
      [
        {
          query: 'countDocuments',
          args: [{ course: courseId, user: userId, questionnaire: questionnaireId, timeline: UNKNOWN }],
        }]
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        course: courseId,
        user: userId,
        questionnaire: questionnaireId,
        questionnaireAnswersList,
        company,
        timeline: UNKNOWN,
      }
    );
  });

  it('should create a questionnaireHistory with timeline in payload (SELF_POSITIONNING)', async () => {
    const questionnaireId = new ObjectId();
    const questionnaire = { _id: questionnaireId, type: SELF_POSITIONNING };
    const company = new ObjectId();
    const userId = new ObjectId();
    const courseId = new ObjectId();
    const questionnaireAnswersList = [{ card: new ObjectId(), answerList: ['blabla'] }];

    getCompanyAtCourseRegistrationList.returns([{ company }, { company: new ObjectId() }]);
    findOneQuestionnaire.returns(SinonMongoose.stubChainedQueries(questionnaire, ['lean']));
    countDocumentsQH.returns(0);

    await QuestionnaireHistoriesHelper.addQuestionnaireHistory({
      course: courseId,
      user: userId,
      questionnaire: questionnaireId,
      questionnaireAnswersList,
      timeline: START_COURSE,
      origin: WEBAPP,
    });

    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: [userId] }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneQuestionnaire,
      [{ query: 'findOne', args: [{ _id: questionnaireId }, { type: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      countDocumentsQH,
      [
        {
          query: 'countDocuments',
          args: [{ course: courseId, user: userId, questionnaire: questionnaireId, timeline: START_COURSE }],
        },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      create,
      {
        course: courseId,
        user: userId,
        questionnaire: questionnaireId,
        questionnaireAnswersList,
        company,
        timeline: START_COURSE,
        origin: WEBAPP,
      }
    );
    sinon.assert.notCalled(findOneCourse);
  });
});

describe('updateQuestionnaireHistory', () => {
  const questionnaireHistoryId = new ObjectId();
  let updateOne;
  let findOne;

  beforeEach(() => {
    updateOne = sinon.stub(QuestionnaireHistory, 'updateOne');
    findOne = sinon.stub(QuestionnaireHistory, 'findOne');
  });

  afterEach(() => {
    updateOne.restore();
    findOne.restore();
  });

  it('should update questionnaireHistory', async () => {
    const payload = { trainerAnswers: [{ card: new ObjectId() }], trainerComment: '' };

    await QuestionnaireHistoriesHelper.updateQuestionnaireHistory(questionnaireHistoryId, payload);

    sinon.assert.notCalled(findOne);
    sinon.assert.calledWithExactly(updateOne, { _id: questionnaireHistoryId }, { $set: { isValidated: true } });
  });

  it('should update questionnaireHistory with trainer comment', async () => {
    const payload = { trainerAnswers: [{ card: new ObjectId() }], trainerComment: 'Test avec un commentaire' };

    await QuestionnaireHistoriesHelper.updateQuestionnaireHistory(questionnaireHistoryId, payload);

    sinon.assert.notCalled(findOne);
    sinon.assert.calledWithExactly(
      updateOne,
      { _id: questionnaireHistoryId },
      { $set: { isValidated: true, trainerComment: payload.trainerComment } }
    );
  });

  it('should update questionnaireHistory with trainer answers', async () => {
    const cardIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const payload = {
      trainerAnswers: [
        { card: cardIds[0], answer: '4' },
        { card: cardIds[1] },
        { card: cardIds[2], answer: '5' },
      ],
    };
    const questionnaireHistory = {
      _id: questionnaireHistoryId,
      questionnaire: new ObjectId(),
      user: new ObjectId(),
      timeline: END_COURSE,
      questionnaireAnswersList: [
        { card: cardIds[0], answerList: ['3'] },
        { card: cardIds[1], answerList: ['4'] },
        { card: cardIds[2], answerList: ['4'] },
      ],
    };
    findOne.returns(SinonMongoose.stubChainedQueries(questionnaireHistory, ['lean']));

    await QuestionnaireHistoriesHelper.updateQuestionnaireHistory(questionnaireHistoryId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: questionnaireHistoryId }, { questionnaireAnswersList: 1 }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(
      updateOne,
      { _id: questionnaireHistoryId },
      {
        $set: {
          isValidated: true,
          questionnaireAnswersList: [
            { card: cardIds[0], answerList: ['3'], trainerAnswerList: ['4'] },
            { card: cardIds[1], answerList: ['4'] },
            { card: cardIds[2], answerList: ['4'], trainerAnswerList: ['5'] },
          ],
        },
      }
    );
  });
});
