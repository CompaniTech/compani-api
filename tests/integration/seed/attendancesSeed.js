const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Attendance = require('../../../src/models/Attendance');
const Course = require('../../../src/models/Course');
const CourseSlot = require('../../../src/models/CourseSlot');
const Program = require('../../../src/models/Program');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const { otherCompany, authCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { WEBAPP, INTRA, INTER_B2B, TRAINEE_ADDITION, PUBLISHED } = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { trainerRoleId, vendorAdminRoleId } = require('../../seed/authRolesSeed');
const { trainer } = require('../../seed/authUsersSeed');
const CourseHistory = require('../../../src/models/CourseHistory');

const userList = [
  {
    _id: new ObjectId(),
    identity: { firstname: 'course', lastname: 'Trainer' },
    refreshToken: uuidv4(),
    local: { email: 'trainerWithCourse@alenvi.io', password: '123456!eR' },
    role: { vendor: trainerRoleId },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'trainer', lastname: 'noCourse' },
    refreshToken: uuidv4(),
    local: { email: 'trainerNoCourse@alenvi.io', password: '123456!eR' },
    role: { vendor: trainerRoleId },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'salesrep', lastname: 'noCourse' },
    refreshToken: uuidv4(),
    local: { email: 'salerep@compani.fr' },
    role: { vendor: vendorAdminRoleId },
    origin: WEBAPP,
  },
];

const steps = [{ _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 }];

const subProgramIdList = [new ObjectId(), new ObjectId(), new ObjectId()];
const programList = [
  { _id: new ObjectId(), name: 'Program 1', subPrograms: [subProgramIdList[0]] },
  { _id: new ObjectId(), name: 'Program 2', subPrograms: [subProgramIdList[1]] },
  { _id: new ObjectId(), name: 'Program 3', subPrograms: [subProgramIdList[2]] },
];

const subProgramList = [
  { _id: subProgramIdList[0], name: 'Subprogram 1', steps: [steps[0]._id], status: PUBLISHED },
  { _id: subProgramIdList[1], name: 'Subprogram 2', steps: [steps[0]._id], status: PUBLISHED },
  { _id: subProgramIdList[2], name: 'Subprogram 3', steps: [steps[0]._id], status: PUBLISHED },
];

const traineeList = [
  { // 0
    _id: new ObjectId(),
    identity: { firstname: 'Trainee', lastname: 'withCompany' },
    local: { email: 'traineeWithCompany@alenvi.io' },
    origin: WEBAPP,
  },
  { // 1
    _id: new ObjectId(),
    identity: { firstname: 'Player', lastname: 'withoutCompany' },
    local: { email: 'traineeWithoutCompany@alenvi.io' },
    origin: WEBAPP,
  },
  { // 2
    _id: new ObjectId(),
    identity: { firstname: 'traineeFromINTERB2B', lastname: 'otherCompany' },
    local: { email: 'traineeFromINTERB2B@alenvi.io' },
    origin: WEBAPP,
  },
  { // 3
    _id: new ObjectId(),
    identity: { firstname: 'traineeFromINTERB2B', lastname: 'authCompany' },
    local: { email: 'authTraineeFromINTERB2B@alenvi.io' },
    origin: WEBAPP,
  },
  { // 4
    _id: new ObjectId(),
    identity: { firstname: 'interB2Btrainee', lastname: 'withOtherCompany' },
    local: { email: 'otherTraineeFromINTERB2B@alenvi.io' },
    origin: WEBAPP,
  },
  { // 5
    _id: new ObjectId(),
    identity: { firstname: 'authCompanyTrainee', lastname: 'unsubscribed' },
    refreshToken: uuidv4(),
    local: { email: 'trainee@compani.fr' },
    origin: WEBAPP,
  },
  { // 6
    _id: new ObjectId(),
    identity: { firstname: 'otherCompanyTrainee', lastname: 'unsubscribed' },
    refreshToken: uuidv4(),
    local: { email: 'trainee2@compani.fr' },
    origin: WEBAPP,
  },
  { // 7
    _id: new ObjectId(),
    identity: { firstname: 'trainee from other company', lastname: 'unsubscribed' },
    refreshToken: uuidv4(),
    local: { email: 'trainee3@company.fr' },
    origin: WEBAPP,
  },
  { // 8
    _id: new ObjectId(),
    identity: { firstname: 'from auth company', lastname: 'unsubscribed' },
    refreshToken: uuidv4(),
    local: { email: 'trainee4@company.fr' },
    origin: WEBAPP,
  },
  { // 9
    _id: new ObjectId(),
    identity: { firstname: 'from other company', lastname: 'subscribed for 1, unsubscribed for 2' },
    refreshToken: uuidv4(),
    local: { email: 'trainee5@company.fr' },
    origin: WEBAPP,
  },
];

const coursesList = [
  { // 0
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTRA,
    maxTrainees: 8,
    trainees: [traineeList[0]._id, traineeList[3]._id, traineeList[8]._id],
    companies: [authCompany._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTRA,
    maxTrainees: 8,
    trainees: [traineeList[0]._id],
    companies: [authCompany._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 2
    _id: new ObjectId(),
    subProgram: subProgramList[1]._id,
    type: INTRA,
    maxTrainees: 8,
    trainees: [traineeList[9]._id, traineeList[2]._id],
    companies: [otherCompany._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 3 interb2b
    _id: new ObjectId(),
    subProgram: subProgramList[2]._id,
    type: INTER_B2B,
    trainees: [traineeList[2]._id, traineeList[3]._id],
    companies: [otherCompany._id, authCompany._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 4 interb2b with only trainees from otherCompany
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTER_B2B,
    trainees: [traineeList[4]._id],
    companies: [otherCompany._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 5 archived
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTRA,
    maxTrainees: 8,
    trainees: [traineeList[0]._id, traineeList[8]._id],
    companies: [authCompany._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
    archivedAt: '2021-11-17T23:00:00.000Z',
  },
  { // 6 trainer is authTrainer
    _id: new ObjectId(),
    subProgram: subProgramList[0],
    type: INTER_B2B,
    trainees: [traineeList[5]._id, traineeList[0]._id],
    companies: [authCompany._id, companyWithoutSubscription._id],
    trainer: trainer._id,
    salesRepresentative: userList[2]._id,
  },
  { // 7 no company linked
    _id: new ObjectId(),
    subProgram: subProgramList[0],
    type: INTER_B2B,
    trainees: [],
    companies: [],
    trainer: trainer._id,
    salesRepresentative: userList[2]._id,
  },
];

const slotsList = [
  { // 0
    _id: new ObjectId(),
    startDate: '2020-01-20T10:00:00.000Z',
    endDate: '2020-01-20T14:00:00.000Z',
    course: coursesList[0],
    step: steps[0]._id,
  },
  { // 1
    _id: new ObjectId(),
    startDate: '2020-01-21T10:00:00.000Z',
    endDate: '2020-01-21T14:00:00.000Z',
    course: coursesList[0],
    step: steps[0]._id,
  },
  { // 2 - slot from other company's course
    _id: new ObjectId(),
    startDate: '2020-01-22T10:00:00.000Z',
    endDate: '2020-01-22T14:00:00.000Z',
    course: coursesList[2],
    step: steps[0]._id,
  },
  { // 3 - slot for coursesList[3]
    _id: new ObjectId(),
    startDate: '2020-01-23T10:00:00.000Z',
    endDate: '2020-01-23T14:00:00.000Z',
    course: coursesList[3],
    step: steps[0]._id,
  },
  { // 4 - slot for coursesList[4]
    _id: new ObjectId(),
    startDate: '2020-01-24T10:00:00.000Z',
    endDate: '2020-01-24T14:00:00.000Z',
    course: coursesList[4],
    step: steps[0]._id,
  },
  { // 5 - slot for coursesList[5]
    _id: new ObjectId(),
    startDate: '2020-01-25T10:00:00.000Z',
    endDate: '2020-01-25T14:00:00.000Z',
    course: coursesList[5],
    step: steps[0]._id,
  },
  { // 6 - slot for coursesList[6]
    _id: new ObjectId(),
    startDate: '2020-01-25T10:00:00.000Z',
    endDate: '2020-01-25T14:00:00.000Z',
    course: coursesList[6],
    step: steps[0]._id,
  },
  { // 7 - slot for coursesList[7]
    _id: new ObjectId(),
    startDate: '2020-01-25T10:00:00.000Z',
    endDate: '2020-01-25T14:00:00.000Z',
    course: coursesList[7],
    step: steps[0]._id,
  },
];

const attendancesList = [
  { _id: new ObjectId(), courseSlot: slotsList[3]._id, trainee: traineeList[2]._id, company: otherCompany._id },
  { _id: new ObjectId(), courseSlot: slotsList[3]._id, trainee: traineeList[3]._id, company: authCompany._id },
  { _id: new ObjectId(), courseSlot: slotsList[5]._id, trainee: traineeList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), courseSlot: slotsList[0]._id, trainee: traineeList[5]._id, company: authCompany._id },
  { _id: new ObjectId(), courseSlot: slotsList[0]._id, trainee: traineeList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), courseSlot: slotsList[1]._id, trainee: traineeList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), courseSlot: slotsList[2]._id, trainee: traineeList[9]._id, company: otherCompany._id },
  { _id: new ObjectId(), courseSlot: slotsList[3]._id, trainee: traineeList[9]._id, company: otherCompany._id },
  {
    _id: new ObjectId(),
    courseSlot: slotsList[6]._id,
    trainee: traineeList[7]._id,
    company: companyWithoutSubscription._id,
  },
];

const userCompanyList = [
  // old inactive user company
  {
    user: traineeList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { user: traineeList[0]._id, company: authCompany._id, startDate: '2023-01-01T23:00:00.000Z' },
  { user: traineeList[2]._id, company: otherCompany._id, startDate: '2023-01-01T23:00:00.000Z' },
  { user: traineeList[3]._id, company: authCompany._id, startDate: '2023-01-01T23:00:00.000Z' },
  { user: traineeList[4]._id, company: otherCompany._id, startDate: '2023-01-01T23:00:00.000Z' },
  { user: traineeList[5]._id, company: authCompany._id, startDate: '2023-01-01T23:00:00.000Z' },
  { user: traineeList[6]._id, company: otherCompany._id, startDate: '2023-01-01T23:00:00.000Z' },
  { user: traineeList[7]._id, company: companyWithoutSubscription._id, startDate: '2023-01-01T23:00:00.000Z' },
  { user: traineeList[8]._id, company: authCompany._id, startDate: '2023-01-01T23:00:00.000Z' },
  { user: traineeList[9]._id, company: otherCompany._id, startDate: '2023-01-01T23:00:00.000Z' },
];

const courseHistoryList = [
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    company: authCompany._id,
    createdBy: userList[2]._id,
    trainee: traineeList[0]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    company: authCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[3]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    company: authCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[8]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[1]._id,
    company: authCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[0]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[2]._id,
    company: otherCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[9]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[2]._id,
    company: otherCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[2]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[3]._id,
    company: otherCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[2]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[4]._id,
    company: otherCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[4]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[5]._id,
    company: authCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[0]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[5]._id,
    company: authCompany._id,
    createdBy: userList[0]._id,
    trainee: traineeList[8]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[6]._id,
    company: companyWithoutSubscription._id,
    createdBy: trainer._id,
    trainee: traineeList[0]._id,
    createdAt: '2022-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[6]._id,
    company: authCompany._id,
    createdBy: trainer._id,
    trainee: traineeList[5]._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Attendance.create(attendancesList),
    Course.create(coursesList),
    CourseSlot.create(slotsList),
    User.create([...userList, ...traineeList]),
    UserCompany.create(userCompanyList),
    Program.create(programList),
    Step.create(steps),
    SubProgram.create(subProgramList),
    CourseHistory.create(courseHistoryList),
  ]);
};

module.exports = {
  populateDB,
  attendancesList,
  coursesList,
  slotsList,
  userList,
  traineeList,
  userCompanyList,
};
