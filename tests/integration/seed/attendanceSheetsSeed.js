const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const Course = require('../../../src/models/Course');
const CourseHistory = require('../../../src/models/CourseHistory');
const CourseSlot = require('../../../src/models/CourseSlot');
const Step = require('../../../src/models/Step');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const { authCompany, otherCompany, companyWithoutSubscription, otherHolding } = require('../../seed/authCompaniesSeed');
const {
  WEBAPP,
  INTRA,
  INTER_B2B,
  TRAINEE_ADDITION,
  MOBILE,
  PUBLISHED,
  INTRA_HOLDING,
  GLOBAL,
  MONTHLY,
  SINGLE,
} = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const UserCompany = require('../../../src/models/UserCompany');
const User = require('../../../src/models/User');
const { vendorAdminRoleId, trainerRoleId } = require('../../seed/authRolesSeed');
const { trainerOrganisationManager, trainer, trainerAndCoach } = require('../../seed/authUsersSeed');

const userList = [
  { // 0
    _id: new ObjectId(),
    identity: { firstname: 'operations', lastname: 'representative' },
    refreshToken: uuidv4(),
    local: { email: 'operationsrep@compani.fr', password: '123456!eR' },
    role: { vendor: vendorAdminRoleId },
    origin: WEBAPP,
  },
  { // 1
    _id: new ObjectId(),
    identity: { firstname: 'learner', lastname: 'from AuthCompany' },
    refreshToken: uuidv4(),
    local: { email: 'learnerfromauthcompany@compani.fr', password: '123456!eR' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnTokenExpo]', 'ExponentPushToken[jeSuisUnAutreTokenExpo]'],
  },
  { // 2
    _id: new ObjectId(),
    identity: { firstname: 'traineeFromINTERB2B', lastname: 'withOtherCompany' },
    local: { email: 'traineeFromINTERB2B@alenvi.io' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnNouveauTokenExpo]'],
  },
  { // 3
    _id: new ObjectId(),
    identity: { firstname: 'trainer', lastname: 'FromOtherCompany' },
    local: { email: 'trainerFromOtherCompany@compani.fr' },
    role: { vendor: trainerRoleId },
    origin: WEBAPP,
  },
  { // 4
    _id: new ObjectId(),
    identity: { firstname: 'thirdCompany', lastname: 'User' },
    local: { email: 'trainerFromThirdCompany@compani.fr' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[0]', 'ExponentPushToken[1]'],
  },
];

const userCompaniesList = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: userList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: userList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), user: userList[1]._id, company: authCompany._id },
  { _id: new ObjectId(), user: userList[2]._id, company: otherCompany._id },
  { _id: new ObjectId(), user: userList[3]._id, company: otherCompany._id },
  { _id: new ObjectId(), user: userList[4]._id, company: companyWithoutSubscription._id },
];

const steps = [{ _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 }];

const subProgramList = [
  { _id: new ObjectId(), name: 'Subprogram 1', steps: [steps[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'Subprogram 2', steps: [steps[0]._id], status: PUBLISHED },
];

const programsList = [
  { _id: new ObjectId(), name: 'Program 1', subPrograms: [subProgramList[0]._id, subProgramList[1]._id] },
];

const coursesList = [
  { // 0
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTRA,
    maxTrainees: 8,
    trainees: [userList[1]._id],
    companies: [authCompany._id],
    operationsRepresentative: userList[0]._id,
    trainers: [trainer._id, trainerAndCoach._id],
    certificateGenerationMode: GLOBAL,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTER_B2B,
    trainees: [userList[1]._id, userList[2]._id, userList[4]._id],
    companies: [authCompany._id, otherCompany._id, companyWithoutSubscription._id],
    operationsRepresentative: userList[0]._id,
    trainers: [trainer._id, trainerAndCoach._id],
    certificateGenerationMode: GLOBAL,
  },
  { // 2
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTRA,
    maxTrainees: 8,
    trainees: [userList[1]._id],
    companies: [authCompany._id],
    trainers: [userList[3]._id],
    operationsRepresentative: userList[0]._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 3 - archived
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTER_B2B,
    archivedAt: new Date(),
    trainees: [userList[1]._id],
    companies: [authCompany._id],
    operationsRepresentative: userList[0]._id,
    trainers: [trainer._id],
    certificateGenerationMode: GLOBAL,
  },
  { // 4
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTRA,
    maxTrainees: 8,
    trainees: [userList[2]._id],
    companies: [otherCompany._id],
    trainers: [userList[3]._id],
    operationsRepresentative: userList[0]._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 5
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTRA_HOLDING,
    maxTrainees: 8,
    trainees: [userList[2]._id],
    companies: [otherCompany._id],
    holding: otherHolding._id,
    trainers: [trainer._id],
    operationsRepresentative: userList[0]._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 6
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTRA_HOLDING,
    maxTrainees: 8,
    trainees: [],
    trainers: [trainer._id],
    companies: [],
    holding: otherHolding._id,
    operationsRepresentative: userList[0]._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 7 Single course
    _id: new ObjectId(),
    subProgram: subProgramList[1]._id,
    type: SINGLE,
    trainees: [userList[1]._id],
    companies: [authCompany._id],
    operationsRepresentative: userList[0]._id,
    trainers: [trainer._id, trainerAndCoach._id],
    certificateGenerationMode: MONTHLY,
  },
  { // 8 Single course
    _id: new ObjectId(),
    subProgram: subProgramList[1]._id,
    type: SINGLE,
    trainees: [userList[1]._id],
    companies: [authCompany._id],
    operationsRepresentative: userList[0]._id,
    trainers: [userList[3]._id],
    certificateGenerationMode: MONTHLY,
  },
];

const courseHistoriesList = [
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: userList[1]._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[1]._id,
    trainee: userList[1]._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[1]._id,
    trainee: userList[2]._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[3]._id,
    trainee: userList[1]._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[4]._id,
    trainee: userList[2]._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
  },
];

const slotsList = [
  { // 0
    _id: new ObjectId(),
    startDate: '2020-01-23T09:00:00.000Z',
    endDate: '2020-01-23T11:00:00.000Z',
    course: coursesList[0]._id,
    step: steps[0]._id,
  },
  { // 1
    _id: new ObjectId(),
    startDate: '2020-01-25T09:00:00.000Z',
    endDate: '2020-01-25T11:00:00.000Z',
    course: coursesList[2]._id,
    step: steps[0]._id,
  },
  { // 2
    _id: new ObjectId(),
    startDate: '2020-01-25T09:00:00.000Z',
    endDate: '2020-01-25T11:00:00.000Z',
    course: coursesList[5]._id,
    step: steps[0]._id,
  },
  { // 3
    _id: new ObjectId(),
    startDate: '2020-01-25T09:00:00.000Z',
    endDate: '2020-01-25T11:00:00.000Z',
    course: coursesList[6]._id,
    step: steps[0]._id,
  },
  { // 4
    _id: new ObjectId(),
    startDate: '2020-01-25T09:00:00.000Z',
    endDate: '2020-01-25T11:00:00.000Z',
    course: coursesList[7]._id,
    step: steps[0]._id,
  },
  { // 5
    _id: new ObjectId(),
    startDate: '2020-01-26T09:00:00.000Z',
    endDate: '2020-01-26T11:00:00.000Z',
    course: coursesList[7]._id,
    step: steps[0]._id,
  },
  { // 6
    _id: new ObjectId(),
    startDate: '2020-01-27T09:00:00.000Z',
    endDate: '2020-01-27T11:00:00.000Z',
    course: coursesList[7]._id,
    step: steps[0]._id,
  },
  { // 7
    _id: new ObjectId(),
    startDate: '2020-01-26T09:00:00.000Z',
    endDate: '2020-01-26T11:00:00.000Z',
    course: coursesList[7]._id,
    step: steps[0]._id,
  },
  { // 8
    _id: new ObjectId(),
    startDate: '2020-01-26T09:00:00.000Z',
    endDate: '2020-01-26T11:00:00.000Z',
    course: coursesList[8]._id,
    step: steps[0]._id,
  },
  { // 9
    _id: new ObjectId(),
    startDate: '2020-02-26T09:00:00.000Z',
    endDate: '2020-02-26T11:00:00.000Z',
    course: coursesList[8]._id,
    step: steps[0]._id,
  },
  { // 10
    _id: new ObjectId(),
    startDate: '2020-03-26T09:00:00.000Z',
    endDate: '2020-03-26T11:00:00.000Z',
    course: coursesList[7]._id,
    step: steps[0]._id,
  },
  { // 11
    _id: new ObjectId(),
    startDate: '2021-03-26T09:00:00.000Z',
    endDate: '2021-03-26T11:00:00.000Z',
    course: coursesList[7]._id,
    step: steps[0]._id,
  },
  { // 12
    _id: new ObjectId(),
    startDate: '2021-03-26T09:00:00.000Z',
    endDate: '2021-03-26T11:00:00.000Z',
    course: coursesList[1]._id,
    step: steps[0]._id,
  },
  { // 13
    _id: new ObjectId(),
    startDate: '2021-03-27T09:00:00.000Z',
    endDate: '2021-03-27T11:00:00.000Z',
    course: coursesList[1]._id,
    step: steps[0]._id,
  },
  { // 14
    _id: new ObjectId(),
    startDate: '2021-03-28T09:00:00.000Z',
    endDate: '2021-03-28T11:00:00.000Z',
    course: coursesList[1]._id,
    step: steps[0]._id,
  },
];

const attendanceSheetList = [
  { // 0
    _id: new ObjectId(),
    course: coursesList[0]._id,
    file: { publicId: 'mon upload', link: 'www.test.com' },
    date: '2020-01-23T09:00:00.000Z',
    companies: [authCompany._id],
    origin: WEBAPP,
    trainer: trainer._id,
  },
  { // 1
    _id: new ObjectId(),
    course: coursesList[1]._id,
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[1]._id,
    companies: [authCompany._id],
    origin: WEBAPP,
    trainer: trainer._id,
  },
  { // 2
    _id: new ObjectId(),
    course: coursesList[3]._id,
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[1]._id,
    companies: [authCompany._id],
    origin: MOBILE,
    trainer: trainer._id,
  },
  { // 3
    _id: new ObjectId(),
    course: coursesList[2]._id,
    file: { publicId: 'fromOtherCompany', link: 'www.test.com' },
    date: '2020-01-25T09:00:00.000Z',
    companies: [authCompany._id],
    origin: MOBILE,
    trainer: userList[3]._id,
  },
  { // 4
    _id: new ObjectId(),
    course: coursesList[1]._id,
    file: { publicId: 'fromThirdCompany', link: 'www.test.com' },
    trainee: userList[4]._id,
    companies: [companyWithoutSubscription._id],
    origin: MOBILE,
    trainer: trainer._id,
  },
  { // 5
    _id: new ObjectId(),
    course: coursesList[7]._id,
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[1]._id,
    companies: [authCompany._id],
    slots: [{ slotId: slotsList[5]._id }],
    origin: WEBAPP,
    trainer: trainer._id,
  },
  { // 6
    _id: new ObjectId(),
    course: coursesList[7]._id,
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[1]._id,
    companies: [authCompany._id],
    slots: [{ slotId: slotsList[6]._id }],
    origin: WEBAPP,
    trainer: trainer._id,
  },
  { // 7
    _id: new ObjectId(),
    course: coursesList[8]._id,
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[1]._id,
    companies: [authCompany._id],
    slots: [{ slotId: slotsList[8]._id }],
    origin: WEBAPP,
    trainer: userList[3]._id,
  },
  { // 8
    _id: new ObjectId(),
    course: coursesList[8]._id,
    trainee: userList[1]._id,
    companies: [authCompany._id],
    slots: [{ slotId: slotsList[9]._id, trainerSignature: { trainerId: userList[3]._id, signature: 'www.test.com' } }],
    origin: MOBILE,
    trainer: userList[3]._id,
  },
  { // 9
    _id: new ObjectId(),
    course: coursesList[7]._id,
    trainee: userList[1]._id,
    companies: [authCompany._id],
    slots: [{
      slotId: slotsList[10]._id,
      trainerSignature: {
        trainerId: trainer._id,
        signature: 'https://storage.googleapis.com/compani-main/aux-prisededecision.png',
      },
      traineesSignature: [{
        traineeId: userList[1]._id,
        signature: 'https://storage.googleapis.com/compani-main/aux-conscience-eclairee.png',
      }],
    }],
    origin: MOBILE,
    trainer: trainer._id,
  },
  { // 10
    _id: new ObjectId(),
    course: coursesList[7]._id,
    trainee: userList[1]._id,
    companies: [authCompany._id],
    slots: [{
      slotId: slotsList[11]._id,
      trainerSignature: {
        trainerId: trainer._id,
        signature: 'https://storage.googleapis.com/compani-main/aux-prisededecision.png',
      },
      traineesSignature: [{
        traineeId: userList[1]._id,
        signature: 'https://storage.googleapis.com/compani-main/aux-conscience-eclairee.png',
      }],
    }],
    file: { publicId: 'yo', link: 'www.test.com' },
    origin: MOBILE,
    trainer: trainer._id,
  },
  { // 11
    _id: new ObjectId(),
    course: coursesList[1]._id,
    trainee: userList[2]._id,
    companies: [otherCompany._id],
    slots: [
      {
        slotId: slotsList[12]._id,
        trainerSignature: {
          trainerId: trainer._id,
          signature: 'https://storage.googleapis.com/compani-main/aux-prisededecision.png',
        },
        traineesSignature: [{
          traineeId: userList[2]._id,
          signature: 'https://storage.googleapis.com/compani-main/aux-conscience-eclairee.png',
        }],
      },
      {
        slotId: slotsList[13]._id,
        trainerSignature: {
          trainerId: trainer._id,
          signature: 'https://storage.googleapis.com/compani-main/aux-prisededecision.png',
        },
        traineesSignature: [{
          traineeId: userList[2]._id,
          signature: 'https://storage.googleapis.com/compani-main/aux-conscience-eclairee.png',
        }],
      },
    ],
    origin: MOBILE,
    trainer: trainer._id,
  },
  { // 12
    _id: new ObjectId(),
    course: coursesList[1]._id,
    trainee: userList[1]._id,
    companies: [authCompany._id],
    slots: [
      {
        slotId: slotsList[12]._id,
        trainerSignature: {
          trainerId: trainer._id,
          signature: 'https://storage.googleapis.com/compani-main/aux-prisededecision.png',
        },
        traineesSignature: [{
          traineeId: userList[1]._id,
          signature: 'https://storage.googleapis.com/compani-main/aux-conscience-eclairee.png',
        }],
      },
      {
        slotId: slotsList[13]._id,
        trainerSignature: {
          trainerId: trainer._id,
          signature: 'https://storage.googleapis.com/compani-main/aux-prisededecision.png',
        },
      },
    ],
    origin: MOBILE,
    trainer: trainer._id,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    AttendanceSheet.create(attendanceSheetList),
    Course.create(coursesList),
    CourseSlot.create(slotsList),
    User.create(userList),
    UserCompany.create(userCompaniesList),
    CourseHistory.create(courseHistoriesList),
    Step.create(steps),
    SubProgram.create(subProgramList),
    Program.create(programsList),
  ]);
};

module.exports = {
  populateDB,
  attendanceSheetList,
  coursesList,
  slotsList,
  userList,
};
