const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Activity = require('../../../src/models/Activity');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const Course = require('../../../src/models/Course');
const Card = require('../../../src/models/Card');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const {
  STRICTLY_E_LEARNING,
  WEBAPP,
  INTER_B2C,
  PUBLISHED,
  SURVEY,
  SINGLE_CHOICE_QUESTION,
  QUESTION_ANSWER,
  LESSON,
  MULTIPLE_CHOICE_QUESTION,
  ORDER_THE_SEQUENCE,
  FILL_THE_GAPS,
  INTER_B2B,
  GLOBAL,
} = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { noRole } = require('../../seed/authUsersSeed');
const { vendorAdminRoleId } = require('../../seed/authRolesSeed');
const { authCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');

const userList = [
  {
    _id: new ObjectId(),
    identity: { firstname: 'operations', lastname: 'representative' },
    refreshToken: uuidv4(),
    local: { email: 'operationsrep@compani.fr', password: '654321!eR' },
    role: { vendor: vendorAdminRoleId },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'learner', lastname: 'nocompany' },
    refreshToken: uuidv4(),
    local: { email: 'learner@compani.fr', password: '123456!eR' },
    origin: WEBAPP,
  },
];

const userCompaniesList = [
  // old inactive user company
  {
    user: userList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { user: userList[0]._id, company: authCompany._id },
  { user: userList[1]._id, company: authCompany._id },
];

const cardsList = [
  // 0
  { _id: new ObjectId(), template: SURVEY, labels: { 1: 'first', 5: 'last' }, question: 'question ?' },
  // 1
  { _id: new ObjectId(), template: SURVEY, question: 'test2?' },
  { // 2
    _id: new ObjectId(),
    template: SINGLE_CHOICE_QUESTION,
    question: 'test3?',
    qcAnswers: [
      { _id: new ObjectId(), text: 'test', isCorrect: true },
      { _id: new ObjectId(), text: 'test2', isCorrect: false },
      { _id: new ObjectId(), text: 'test3', isCorrect: false },
    ],
    explanation: 'test',
  },
  // 3
  { _id: new ObjectId(), template: 'open_question', question: 'test4?' },
  { // 4
    _id: new ObjectId(),
    template: QUESTION_ANSWER,
    question: 'test5?',
    isQuestionAnswerMultipleChoiced: true,
    qcAnswers: [{ _id: new ObjectId(), text: 'test2' }, { _id: new ObjectId(), text: 'test3' }],
  },
  { // 5
    _id: new ObjectId(),
    template: QUESTION_ANSWER,
    question: 'test6?',
    isQuestionAnswerMultipleChoiced: false,
    qcAnswers: [{ _id: new ObjectId(), text: 'test2' }, { _id: new ObjectId(), text: 'test3' }],
  },
  { // 6
    _id: new ObjectId(),
    template: MULTIPLE_CHOICE_QUESTION,
    question: 'test7?',
    qcAnswers: [
      { _id: new ObjectId(), text: 'test7', isCorrect: false },
      { _id: new ObjectId(), text: 'test7 good', isCorrect: true },
    ],
    explanation: 'test',
  },
  // 7
  { _id: new ObjectId(), template: 'transition', title: 'test8' },
  { // 8
    _id: new ObjectId(),
    template: ORDER_THE_SEQUENCE,
    question: 'question ?',
    explanation: 'explanation',
    orderedAnswers: [
      { _id: new ObjectId(), text: 'rien' },
      { _id: new ObjectId(), text: 'des trucs' },
      { _id: new ObjectId(), text: 'encore des trucs' },
    ],
  },
  { // 9
    _id: new ObjectId(),
    template: FILL_THE_GAPS,
    gappedText: 'texte à <trou>',
    explanation: 'explanation',
    gapAnswers: [
      { _id: new ObjectId(), text: 'vide', isCorrect: false },
      { _id: new ObjectId(), text: 'trou', isCorrect: true },
      { _id: new ObjectId(), text: 'texte', isCorrect: false },
    ],
  },
];

const activitiesList = [
  {
    _id: new ObjectId(),
    name: 'bouger',
    type: LESSON,
    cards: [
      cardsList[0]._id,
      cardsList[2]._id,
      cardsList[3]._id,
      cardsList[4]._id,
      cardsList[5]._id,
      cardsList[6]._id,
      cardsList[8]._id,
      cardsList[9]._id,
    ],
    status: PUBLISHED,
  },
];

const stepsList = [{
  _id: new ObjectId(),
  type: 'e_learning',
  name: 'c\'est une étape',
  activities: [activitiesList[0]._id],
  status: PUBLISHED,
  theoreticalDuration: 60,
}];

const subProgramsList = [{
  _id: new ObjectId(),
  name: 'sous-programme A',
  steps: [stepsList[0]._id],
  status: PUBLISHED,
}];

const coursesList = [
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    type: INTER_B2C,
    trainees: [userList[1]._id],
    format: STRICTLY_E_LEARNING,
  },
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    type: INTER_B2B,
    tutors: [noRole._id],
    companies: [authCompany._id],
    trainees: [],
    certificateGenerationMode: GLOBAL,
    operationsRepresentative: userList[0]._id,
  },
];

const activityHistories = [
  {
    _id: new ObjectId(),
    user: userList[1]._id,
    activity: activitiesList[0]._id,
    date: new Date('2020-12-15T23:00:00'),
    score: 1,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activitiesList),
    ActivityHistory.create(activityHistories),
    Card.create(cardsList),
    Course.create(coursesList),
    Step.create(stepsList),
    SubProgram.create(subProgramsList),
    User.create(userList),
    UserCompany.create(userCompaniesList),
  ]);
};

module.exports = {
  populateDB,
  activitiesList,
  activityHistories,
  cardsList,
  userList,
};
