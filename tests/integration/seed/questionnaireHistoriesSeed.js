const { ObjectId } = require('mongodb');
const Questionnaire = require('../../../src/models/Questionnaire');
const Course = require('../../../src/models/Course');
const CourseHistory = require('../../../src/models/CourseHistory');
const Card = require('../../../src/models/Card');
const QuestionnaireHistory = require('../../../src/models/QuestionnaireHistory');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const CourseSlot = require('../../../src/models/CourseSlot');
const Program = require('../../../src/models/Program');
const {
  userList,
  trainerOrganisationManager,
  vendorAdmin,
  trainer,
  trainerAndCoach,
} = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const {
  INTER_B2B,
  TRAINEE_ADDITION,
  COMPANY_ADDITION,
  PUBLISHED,
  SURVEY,
  OPEN_QUESTION,
  QUESTION_ANSWER,
  EXPECTATIONS,
  SELF_POSITIONNING,
  ON_SITE,
  END_COURSE,
  START_COURSE,
  MULTIPLE_CHOICE_QUESTION,
  GLOBAL,
} = require('../../../src/helpers/constants');
const { authCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');

const questionnaireHistoriesUsersList = [userList[6]._id, userList[5]._id, userList[4]._id];

const cardsList = [
  { _id: new ObjectId(), template: SURVEY, question: 'test?', labels: { 1: 'first', 5: 'last' } },
  { _id: new ObjectId(), template: SURVEY, question: 'test2?', labels: { 1: 'Premier niveau', 5: 'Dernier niveau' } },
  { _id: new ObjectId(), template: MULTIPLE_CHOICE_QUESTION, question: 'test3?' },
  { _id: new ObjectId(), template: OPEN_QUESTION, question: 'test4?' },
  { _id: new ObjectId(), template: QUESTION_ANSWER, question: 'test5?', isQuestionAnswerMultipleChoiced: true },
  { _id: new ObjectId(), template: QUESTION_ANSWER, question: 'test6?', isQuestionAnswerMultipleChoiced: false },
];

const stepsList = [
  { _id: new ObjectId(), type: ON_SITE, name: 'étape', status: PUBLISHED, theoreticalDuration: 60 },
  { _id: new ObjectId(), type: ON_SITE, name: 'etape 2', status: PUBLISHED, theoreticalDuration: 60 },
];

const subProgramsList = [
  {
    _id: new ObjectId(),
    name: 'Subprogram 1',
    steps: [stepsList[0]._id, stepsList[1]._id],
    status: PUBLISHED,
  },
  {
    _id: new ObjectId(),
    name: 'Subprogram 2',
    steps: [stepsList[0]._id],
    status: PUBLISHED,
  },
];

const programsList = [
  { _id: new ObjectId(), name: 'program 1', subPrograms: [subProgramsList[0]._id] },
  { _id: new ObjectId(), name: 'program 2', subPrograms: [subProgramsList[1]._id] },
];

const questionnairesList = [
  {
    _id: new ObjectId(),
    name: 'test',
    status: PUBLISHED,
    type: EXPECTATIONS,
    cards: [cardsList[0]._id, cardsList[3]._id],
  },
  {
    _id: new ObjectId(),
    name: 'test auto-positionnement',
    status: PUBLISHED,
    type: SELF_POSITIONNING,
    program: programsList[0]._id,
    cards: [cardsList[0]._id, cardsList[1]._id],
  },
  {
    _id: new ObjectId(),
    name: 'test auto-positionnement',
    status: PUBLISHED,
    type: SELF_POSITIONNING,
    program: programsList[1]._id,
    cards: [cardsList[1]._id, cardsList[3]._id],
  },
];

const coursesList = [
  {
    _id: new ObjectId(),
    format: 'blended',
    subProgram: subProgramsList[0]._id,
    type: INTER_B2B,
    operationsRepresentative: vendorAdmin._id,
    trainees: [questionnaireHistoriesUsersList[0], questionnaireHistoriesUsersList[2]],
    companies: [authCompany._id],
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    format: 'blended',
    subProgram: subProgramsList[1]._id,
    trainers: [trainer._id, trainerAndCoach._id],
    type: INTER_B2B,
    operationsRepresentative: vendorAdmin._id,
    trainees: [questionnaireHistoriesUsersList[1]],
    companies: [authCompany._id],
    certificateGenerationMode: GLOBAL,
  },
];

const questionnaireHistoriesList = [
  {
    _id: new ObjectId(),
    course: coursesList[0]._id,
    user: questionnaireHistoriesUsersList[2],
    questionnaire: questionnairesList[0]._id,
    company: authCompany._id,
    questionnaireAnswersList: [{ card: cardsList[3]._id, answerList: ['blabla'] }],
  },
  {
    _id: new ObjectId(),
    course: coursesList[1]._id,
    user: questionnaireHistoriesUsersList[1],
    questionnaire: questionnairesList[2]._id,
    company: authCompany._id,
    timeline: END_COURSE,
    questionnaireAnswersList: [{ card: cardsList[1]._id, answerList: ['2'] }],
  },
  {
    _id: new ObjectId(),
    course: coursesList[1]._id,
    user: questionnaireHistoriesUsersList[1],
    questionnaire: questionnairesList[2]._id,
    company: authCompany._id,
    timeline: START_COURSE,
    questionnaireAnswersList: [{ card: cardsList[1]._id, answerList: ['1'] }],
  },
];

const courseHistoriesList = [
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: questionnaireHistoriesUsersList[0],
    company: companyWithoutSubscription._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-01T23:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[1]._id,
    trainee: questionnaireHistoriesUsersList[1],
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-01T23:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: questionnaireHistoriesUsersList[2],
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-01T23:00:00.000Z',
  },
  {
    action: COMPANY_ADDITION,
    course: coursesList[0]._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-01T23:00:00.000Z',
  },
  {
    action: COMPANY_ADDITION,
    course: coursesList[1]._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-04T23:00:00.000Z',
  },
];

const slots = [
  {
    startDate: '2021-04-20T09:00:00.000Z',
    endDate: '2021-04-20T11:00:00.000Z',
    course: coursesList[0]._id,
    step: stepsList[0]._id,
  },
  {
    startDate: '2021-04-22T14:00:00.000Z',
    endDate: '2021-04-22T18:00:00.000Z',
    course: coursesList[0]._id,
    step: stepsList[1]._id,
  },
  {
    startDate: '2021-04-22T14:00:00.000Z',
    endDate: '2021-04-22T18:00:00.000Z',
    course: coursesList[1]._id,
    step: stepsList[0]._id,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Questionnaire.create(questionnairesList),
    QuestionnaireHistory.create(questionnaireHistoriesList),
    Course.create(coursesList),
    CourseSlot.create(slots),
    Card.create(cardsList),
    CourseHistory.create(courseHistoriesList),
    Program.create(programsList),
    Step.create(stepsList),
    SubProgram.create(subProgramsList),
  ]);
};

module.exports = {
  populateDB,
  questionnairesList,
  coursesList,
  questionnaireHistoriesUsersList,
  cardsList,
  questionnaireHistoriesList,
};
