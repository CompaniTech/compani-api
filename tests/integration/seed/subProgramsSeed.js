const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const Step = require('../../../src/models/Step');
const Activity = require('../../../src/models/Activity');
const Course = require('../../../src/models/Course');
const Card = require('../../../src/models/Card');
const CourseSlot = require('../../../src/models/CourseSlot');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const { vendorAdmin } = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { WEBAPP, INTRA, PUBLISHED, DRAFT, GLOBAL } = require('../../../src/helpers/constants');
const { authCompany } = require('../../seed/authCompaniesSeed');

const tester = {
  _id: new ObjectId(),
  identity: { firstname: 'tester', lastname: 'without role' },
  refreshToken: uuidv4(),
  local: { email: 'tester.withoutrole@compani.fr', password: 'zxcvbnm' },
  contact: { phone: '0798640728', countryCode: '+33' },
  origin: WEBAPP,
};

const userFromAuthCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'user', lastname: 'fromAuth' },
  refreshToken: uuidv4(),
  local: { email: 'user.fromAuth@authuserseed.fr', password: 'fdsf5P56D' },
  origin: WEBAPP,
  formationExpoTokenList: ['ExponentPushToken[1234]'],
};

const userCompany = {
  _id: new ObjectId(),
  user: userFromAuthCompany._id,
  company: authCompany._id,
  startDate: '2025-01-31T09:00:00.000Z',
};

const cardsList = [
  { _id: new ObjectId(), template: 'transition', title: 'ceci est un titre' },
  { _id: new ObjectId(), template: 'transition', title: 'ceci est un titre' },
  { _id: new ObjectId(), template: 'transition', title: 'ceci est un titre' },
];

const activitiesList = [
  {
    _id: new ObjectId(),
    type: 'sharing_experience',
    name: 'activite',
    cards: [cardsList[0]._id, cardsList[1]._id, cardsList[2]._id],
    status: PUBLISHED,
  },
  {
    _id: new ObjectId(),
    type: 'sharing_experience',
    name: 'activite',
    cards: [],
  },
];

const stepsList = [
  { _id: new ObjectId(), name: 'step 0', type: 'on_site', theoreticalDuration: 9000, status: PUBLISHED },
  {
    _id: new ObjectId(),
    name: 'step 1',
    type: 'e_learning',
    activities: [activitiesList[0]._id],
    theoreticalDuration: 9000,
  },
  {
    _id: new ObjectId(),
    name: 'step 2',
    type: 'e_learning',
    activities: [activitiesList[0]._id],
    theoreticalDuration: 9000,
    status: PUBLISHED,
  },
  { _id: new ObjectId(), name: 'step 3', type: 'e_learning', theoreticalDuration: 9000 },
  {
    _id: new ObjectId(),
    name: 'step 4',
    type: 'e_learning',
    activities: [activitiesList[1]._id],
    theoreticalDuration: 9000,
  },
  { _id: new ObjectId(), name: 'step 5 - linked to courseSlot', type: 'on_site', theoreticalDuration: 9000 },
  { // 6 - on site without theoreticalDuration
    _id: new ObjectId(),
    name: 'step 6',
    type: 'on_site',
  },
  { // 7 - elearning without theoreticalDuration
    _id: new ObjectId(),
    name: 'step 7',
    type: 'e_learning',
    activities: [activitiesList[0]._id],
  },
];

const subProgramsList = [
  { _id: new ObjectId(), name: 'subProgram 0', status: DRAFT, steps: [stepsList[0]._id, stepsList[1]._id] },
  { _id: new ObjectId(), name: 'subProgram 1', status: DRAFT, steps: [stepsList[1]._id] },
  { _id: new ObjectId(), name: 'subProgram 2', status: PUBLISHED, steps: [stepsList[0]._id] },
  { _id: new ObjectId(), name: 'subProgram 3', status: DRAFT, steps: [stepsList[1]._id] },
  { _id: new ObjectId(), name: 'subProgram 4', status: PUBLISHED, steps: [stepsList[2]._id] },
  { _id: new ObjectId(), name: 'subProgram 5', status: DRAFT, steps: [stepsList[3]._id] },
  { _id: new ObjectId(), name: 'subProgram 6', status: DRAFT, steps: [stepsList[4]._id, stepsList[5]._id] },
  { _id: new ObjectId(), name: 'subProgram 7', status: DRAFT, steps: [stepsList[0]._id, stepsList[5]._id] },
  { // 8 on site without theoreticalDuration
    _id: new ObjectId(),
    name: 'subProgram 8',
    status: DRAFT,
    steps: [stepsList[6]._id],
  },
  { // 9 eLearning without theoreticalDuration
    _id: new ObjectId(),
    name: 'subProgram 9',
    status: DRAFT,
    steps: [stepsList[7]._id],
  },
];

const programsList = [
  { _id: new ObjectId(), name: 'program 1', subPrograms: [subProgramsList[0]._id, subProgramsList[1]._id] },
  {
    _id: new ObjectId(),
    name: 'program 2',
    subPrograms: [subProgramsList[3]._id, subProgramsList[4]._id],
    image: { publicId: '234', link: 'link' },
    testers: [tester._id],
  },
];

const coursesList = [{
  _id: new ObjectId(),
  format: 'blended',
  subProgram: subProgramsList[2]._id,
  type: INTRA,
  maxTrainees: 8,
  trainees: [],
  companies: [authCompany._id],
  operationsRepresentative: vendorAdmin._id,
  certificateGenerationMode: GLOBAL,
}];

const courseSlotsList = [
  {
    _id: new ObjectId(),
    startDate: '2020-03-10T09:00:00.000Z',
    endDate: '2020-03-10T12:00:00.000Z',
    course: coursesList[0]._id,
    step: stepsList[0]._id,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activitiesList),
    Card.create(cardsList),
    Course.create(coursesList),
    CourseSlot.create(courseSlotsList),
    Program.create(programsList),
    Step.create(stepsList),
    SubProgram.create(subProgramsList),
    User.create([tester, userFromAuthCompany]),
    UserCompany.create(userCompany),
  ]);
};

module.exports = {
  populateDB,
  subProgramsList,
  stepsList,
  activitiesList,
  cardsList,
  tester,
};
