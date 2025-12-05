const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Course = require('../../../src/models/Course');
const CourseHistory = require('../../../src/models/CourseHistory');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const User = require('../../../src/models/User');
const { authCompany, companyWithoutSubscription, authHolding } = require('../../seed/authCompaniesSeed');
const { trainerOrganisationManager, auxiliary } = require('../../seed/authUsersSeed');
const {
  SLOT_CREATION,
  WEBAPP,
  INTRA,
  INTER_B2B,
  PUBLISHED,
  INTRA_HOLDING,
  GLOBAL,
  SINGLE,
} = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { vendorAdminRoleId, trainerRoleId } = require('../../seed/authRolesSeed');

const userList = [
  {
    _id: new ObjectId(),
    identity: { firstname: 'course', lastname: 'Trainer' },
    refreshToken: uuidv4(),
    local: { email: 'trainerCourseHistories@alenvi.io', password: '123456!eR' },
    role: { vendor: trainerRoleId },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'operationsrep', lastname: 'noCourse' },
    refreshToken: uuidv4(),
    local: { email: 'operationsrep@compani.fr' },
    role: { vendor: vendorAdminRoleId },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'otherTrainer', lastname: 'otherTrainers' },
    refreshToken: uuidv4(),
    local: { email: 'otherTrainer@compani.fr', password: '123456!eR' },
    role: { vendor: trainerRoleId },
    origin: WEBAPP,
  },
];

const steps = [{ _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 }];

const subProgramsList = [{ _id: new ObjectId(), name: 'sous-programme A', steps: [steps[0]._id], status: PUBLISHED }];

const coursesList = [
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'first session',
    type: INTRA,
    maxTrainees: 8,
    trainers: [userList[0]._id, userList[2]._id],
    trainees: [],
    companies: [authCompany._id],
    operationsRepresentative: userList[1]._id,
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'first session',
    type: INTRA,
    maxTrainees: 8,
    trainers: [userList[0]._id],
    trainees: [],
    companies: [companyWithoutSubscription._id],
    operationsRepresentative: userList[1]._id,
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'inter b2b session',
    type: INTER_B2B,
    format: 'blended',
    trainers: [userList[0]._id],
    trainees: [],
    companies: [],
    operationsRepresentative: userList[1]._id,
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'intra holding session',
    type: INTRA_HOLDING,
    format: 'blended',
    trainers: [userList[0]._id],
    trainees: [],
    companies: [authCompany._id],
    holding: authHolding._id,
    maxTrainees: 8,
    operationsRepresentative: userList[1]._id,
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'first session',
    type: SINGLE,
    trainers: [userList[0]._id, userList[2]._id],
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    operationsRepresentative: userList[1]._id,
    certificateGenerationMode: GLOBAL,
    folderId: 'folderId',
    gSheetId: 'gSheetId',
  },
];

const courseHistoriesList = [{
  createdBy: trainerOrganisationManager._id,
  action: SLOT_CREATION,
  course: coursesList[0]._id,
  slot: {
    startDate: '2020-06-25T05:00:00',
    endDate: '2020-06-25T07:00:00',
    address: {
      fullAddress: '4 rue du test 92240 Malakoff',
      street: '4 rue du test',
      zipCode: '92240',
      city: 'Malakoff',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
},
{
  createdBy: trainerOrganisationManager._id,
  action: SLOT_CREATION,
  course: coursesList[1]._id,
  slot: {
    startDate: '2020-06-26T05:00:00',
    endDate: '2020-06-26T07:00:00',
    address: {
      fullAddress: '4 rue du test 92240 Malakoff',
      street: '4 rue du test',
      zipCode: '92240',
      city: 'Malakoff',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
},
{
  createdBy: trainerOrganisationManager._id,
  action: SLOT_CREATION,
  course: coursesList[2]._id,
  slot: {
    startDate: '2020-06-25T05:00:00',
    endDate: '2020-06-25T07:00:00',
    address: {
      fullAddress: '4 rue du test 92240 Malakoff',
      street: '4 rue du test',
      zipCode: '92240',
      city: 'Malakoff',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
  createdAt: '2020-06-26T05:00:00',
},
{
  createdBy: trainerOrganisationManager._id,
  action: SLOT_CREATION,
  course: coursesList[2]._id,
  slot: {
    startDate: '2020-06-25T05:00:00',
    endDate: '2020-06-25T07:00:00',
    address: {
      fullAddress: '4 rue du test 92240 Malakoff',
      street: '4 rue du test',
      zipCode: '92240',
      city: 'Malakoff',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
  createdAt: '2020-06-25T05:00:00',
}];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Course.create(coursesList),
    CourseHistory.create(courseHistoriesList),
    Step.create(steps),
    SubProgram.create(subProgramsList),
    User.create(userList),
  ]);
};

module.exports = {
  populateDB,
  coursesList,
  courseHistoriesList,
  userList,
};
