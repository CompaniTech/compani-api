const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Course = require('../../../src/models/Course');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const { WEBAPP, INTER_B2B, PUBLISHED, MONTHLY } = require('../../../src/helpers/constants');
const UserCompany = require('../../../src/models/UserCompany');
const User = require('../../../src/models/User');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { vendorAdminRoleId, trainerRoleId } = require('../../seed/authRolesSeed');
const { trainer, trainerAndCoach } = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const userList = [
  { // 0
    _id: new ObjectId(),
    identity: { firstname: 'representative', lastname: 'operations' },
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
  },
  { // 3
    _id: new ObjectId(),
    identity: { firstname: 'trainer', lastname: 'OtherCompany' },
    local: { email: 'trainerFromOtherCompany@compani.fr' },
    role: { vendor: trainerRoleId },
    origin: WEBAPP,
  },
];

const userCompanyList = [
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
];

const stepList = [
  { _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 },
  { _id: new ObjectId(), type: 'on_site', name: 'autre étape', status: PUBLISHED, theoreticalDuration: 60 },
];

const subProgramList = [
  { _id: new ObjectId(), name: 'Subprogram 1', steps: [stepList[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'Subprogram 2', steps: [stepList[1]._id], status: PUBLISHED },
];

const courseList = [
  { // 0 Course with monthly certificateGenerationMode
    _id: new ObjectId(),
    subProgram: subProgramList[1]._id,
    type: INTER_B2B,
    trainees: [userList[1]._id],
    companies: [authCompany._id],
    operationsRepresentative: userList[0]._id,
    trainers: [trainer._id, trainerAndCoach._id],
    certificateGenerationMode: MONTHLY,
  },
  { // 1 Course with monthly certificateGenerationMode
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTER_B2B,
    trainees: [userList[2]._id],
    companies: [otherCompany._id],
    operationsRepresentative: userList[0]._id,
    trainers: [userList[3]._id],
    certificateGenerationMode: MONTHLY,
  },
];

const completionCertificateList = [
  { _id: new ObjectId(), course: courseList[0]._id, trainee: userList[1]._id, month: '12-2024' },
  { _id: new ObjectId(), course: courseList[0]._id, trainee: userList[1]._id, month: '01-2025' },
  { _id: new ObjectId(), course: courseList[0]._id, trainee: userList[1]._id, month: '02-2025' },
  { _id: new ObjectId(), course: courseList[1]._id, trainee: userList[2]._id, month: '01-2025' },
  { _id: new ObjectId(), course: courseList[1]._id, trainee: userList[2]._id, month: '02-2025' },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Course.create(courseList),
    CompletionCertificate.create(completionCertificateList),
    Step.create(stepList),
    SubProgram.create(subProgramList),
    User.create(userList),
    UserCompany.create(userCompanyList),
  ]);
};

module.exports = { populateDB };
