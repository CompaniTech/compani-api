const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Activity = require('../../../src/models/Activity');
const Questionnaire = require('../../../src/models/Questionnaire');
const Card = require('../../../src/models/Card');
const CourseHistory = require('../../../src/models/CourseHistory');
const Course = require('../../../src/models/Course');
const CourseSlot = require('../../../src/models/CourseSlot');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const Program = require('../../../src/models/Program');
const UserCompany = require('../../../src/models/UserCompany');
const User = require('../../../src/models/User');
const QuestionnaireHistory = require('../../../src/models/QuestionnaireHistory');
const { userList, vendorAdmin, trainerAndCoach } = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const {
  TRANSITION,
  OPEN_QUESTION,
  INTER_B2B,
  INTER_B2C,
  TRAINEE_ADDITION,
  COMPANY_ADDITION,
  PUBLISHED,
  ON_SITE,
  E_LEARNING,
  STRICTLY_E_LEARNING,
  END_OF_COURSE,
  EXPECTATIONS,
  DRAFT,
  SELF_POSITIONNING,
  START_COURSE,
  INTRA,
  GLOBAL,
} = require('../../../src/helpers/constants');
const { trainerRoleId } = require('../../seed/authRolesSeed');
const { companyWithoutSubscription, authCompany } = require('../../seed/authCompaniesSeed');

const cardsList = [
  { _id: new ObjectId(), template: TRANSITION, title: 'test1' },
  { _id: new ObjectId(), template: OPEN_QUESTION, question: 'question?' },
  { _id: new ObjectId(), template: TRANSITION, title: 'test2' },
  { _id: new ObjectId(), template: OPEN_QUESTION, question: 'question?' },
];

const activityList = [
  { _id: new ObjectId(), name: 'activité 1', type: 'sharing_experience', cards: [cardsList[0]._id], status: PUBLISHED },
];

const stepList = [
  { _id: new ObjectId(), type: ON_SITE, name: 'etape 1', activities: [], status: PUBLISHED, theoreticalDuration: 60 },
  {
    _id: new ObjectId(),
    type: E_LEARNING,
    name: 'etape 2',
    activities: [activityList[0]._id],
    status: PUBLISHED,
    theoreticalDuration: 60,
  },
  { _id: new ObjectId(), type: ON_SITE, name: 'etape 3', activities: [], status: PUBLISHED, theoreticalDuration: 240 },
  { _id: new ObjectId(), type: ON_SITE, name: 'etape 4', activities: [], status: PUBLISHED, theoreticalDuration: 240 },
];

const subProgramsList = [
  {
    _id: new ObjectId(),
    name: 'sous-programme 1',
    steps: [stepList[0]._id, stepList[2]._id, stepList[3]._id],
    status: PUBLISHED,
  },
  { _id: new ObjectId(), name: 'sous-programme 2', steps: [stepList[1]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'sous-programme 3', steps: [stepList[2]._id], status: PUBLISHED },
];

const programsList = [
  { _id: new ObjectId(), name: 'test', subPrograms: [subProgramsList[0]._id] },
  { _id: new ObjectId(), name: 'program', subPrograms: [subProgramsList[1]._id] },
  { _id: new ObjectId(), name: 'third program', subPrograms: [subProgramsList[2]._id] },
];

const questionnairesList = [
  {
    _id: new ObjectId(),
    name: 'test',
    status: DRAFT,
    type: EXPECTATIONS,
    cards: [cardsList[0]._id, cardsList[1]._id],
  },
  {
    _id: new ObjectId(),
    name: 'test',
    status: PUBLISHED,
    type: EXPECTATIONS,
    cards: [cardsList[2]._id, cardsList[3]._id],
  },
  {
    _id: new ObjectId(),
    name: 'test',
    status: PUBLISHED,
    type: END_OF_COURSE,
    cards: [cardsList[2]._id, cardsList[3]._id],
  },
  {
    _id: new ObjectId(),
    name: 'test self',
    status: PUBLISHED,
    type: SELF_POSITIONNING,
    program: programsList[0]._id,
    cards: [cardsList[1]._id, cardsList[3]._id],
  },
  {
    _id: new ObjectId(),
    name: 'test draft self',
    status: DRAFT,
    type: SELF_POSITIONNING,
    program: programsList[0]._id,
    cards: [cardsList[1]._id, cardsList[3]._id],
  },
  {
    _id: new ObjectId(),
    name: 'test draft self',
    status: DRAFT,
    type: SELF_POSITIONNING,
    program: programsList[2]._id,
    cards: [cardsList[1]._id, cardsList[3]._id],
  },
];

const courseTrainer = userList.find(user => user.role.vendor === trainerRoleId);

const traineeList = [{
  _id: new ObjectId(),
  serialNumber: '274124',
  local: { email: 'trainee@email.it', password: '1234567890' },
  identity: { lastname: 'Personne' },
  origin: 'webapp',
  refreshToken: uuidv4(),
}];

const coursesList = [
  {
    _id: new ObjectId(),
    format: 'blended',
    subProgram: subProgramsList[0]._id,
    type: INTER_B2B,
    operationsRepresentative: vendorAdmin._id,
    trainers: [courseTrainer._id],
    trainees: [traineeList[0]._id],
    companies: [authCompany._id],
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    format: STRICTLY_E_LEARNING,
    subProgram: subProgramsList[1]._id,
    type: INTER_B2C,
    trainees: [],
  },
  {
    _id: new ObjectId(),
    format: 'blended',
    subProgram: subProgramsList[0]._id,
    type: INTER_B2B,
    operationsRepresentative: vendorAdmin._id,
    trainers: [trainerAndCoach._id],
    trainees: [traineeList[0]._id],
    companies: [companyWithoutSubscription._id],
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    format: 'blended',
    subProgram: subProgramsList[1]._id,
    type: INTRA,
    operationsRepresentative: vendorAdmin._id,
    trainers: [courseTrainer._id],
    maxTrainees: 4,
    trainees: [traineeList[0]._id],
    companies: [authCompany._id],
    certificateGenerationMode: GLOBAL,
  },
];

const courseHistories = [
  {
    course: coursesList[0]._id,
    company: authCompany._id,
    trainee: traineeList[0]._id,
    action: TRAINEE_ADDITION,
    createdBy: vendorAdmin._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    course: coursesList[2]._id,
    company: companyWithoutSubscription._id,
    trainee: traineeList[0]._id,
    action: TRAINEE_ADDITION,
    createdBy: vendorAdmin._id,
    createdAt: '2022-10-03T14:00:00.000Z',
  },
  {
    action: COMPANY_ADDITION,
    course: coursesList[0]._id,
    company: authCompany._id,
    createdBy: vendorAdmin._id,
    createdAt: '2020-01-01T23:00:00.000Z',
  },
  {
    action: COMPANY_ADDITION,
    course: coursesList[2]._id,
    company: companyWithoutSubscription._id,
    createdBy: vendorAdmin._id,
    createdAt: '2020-01-01T23:00:00.000Z',
  },
];

const traineeCompanyList = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: traineeList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: traineeList[0]._id, company: authCompany._id },
];

const slots = [
  {
    startDate: '2021-04-20T09:00:00.000Z',
    endDate: '2021-04-20T11:00:00.000Z',
    course: coursesList[0]._id,
    step: stepList[0]._id,
  },
  {
    startDate: '2021-04-20T11:00:00.000Z',
    endDate: '2021-04-20T12:00:00.000Z',
    course: coursesList[0]._id,
    step: stepList[0]._id,
  },
  {
    startDate: '2021-04-22T09:00:00.000Z',
    endDate: '2021-04-22T11:00:00.000Z',
    course: coursesList[0]._id,
    step: stepList[2]._id,
  },
  {
    startDate: '2021-04-22T14:00:00.000Z',
    endDate: '2021-04-22T18:00:00.000Z',
    course: coursesList[0]._id,
    step: stepList[2]._id,
  },
  {
    startDate: '2021-04-20T09:00:00.000Z',
    endDate: '2021-04-20T11:00:00.000Z',
    course: coursesList[2]._id,
    step: stepList[0]._id,
  },
  {
    course: coursesList[2]._id,
    step: stepList[2]._id,
  },
  {
    course: coursesList[2]._id,
    step: stepList[3]._id,
  },
];

const questionnaireHistories = [
  {
    course: coursesList[0]._id,
    company: authCompany._id,
    questionnaire: questionnairesList[1]._id,
    user: traineeList[0]._id,
    questionnaireAnswersList: [{ card: cardsList[3]._id, answerList: ['blabla'] }],
  },
  {
    course: coursesList[2]._id,
    company: companyWithoutSubscription._id,
    questionnaire: questionnairesList[1]._id,
    user: traineeList[0]._id,
    questionnaireAnswersList: [{ card: cardsList[3]._id, answerList: ['blabla2'] }],
  },
  {
    course: coursesList[0]._id,
    company: authCompany._id,
    questionnaire: questionnairesList[3]._id,
    user: traineeList[0]._id,
    questionnaireAnswersList: [
      { card: cardsList[1]._id, answerList: ['3'] },
      { card: cardsList[3]._id, answerList: ['4'] },
    ],
    timeline: START_COURSE,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activityList),
    User.create(traineeList),
    UserCompany.create(traineeCompanyList),
    Questionnaire.create(questionnairesList),
    Card.create(cardsList),
    Course.create(coursesList),
    CourseHistory.create(courseHistories),
    CourseSlot.create(slots),
    SubProgram.create(subProgramsList),
    Step.create(stepList),
    Program.create(programsList),
    QuestionnaireHistory.create(questionnaireHistories),
  ]);
};

module.exports = {
  populateDB,
  questionnairesList,
  cardsList,
  coursesList,
  programsList,
  traineeList,
};
