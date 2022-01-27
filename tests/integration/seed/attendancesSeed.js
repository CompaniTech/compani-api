const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Attendance = require('../../../src/models/Attendance');
const Course = require('../../../src/models/Course');
const CourseSlot = require('../../../src/models/CourseSlot');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const { otherCompany, authCompany } = require('../../seed/authCompaniesSeed');
const { WEBAPP } = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/authentication');
const { trainerRoleId, vendorAdminRoleId } = require('../../seed/authRolesSeed');
const { trainer } = require('../../seed/authUsersSeed');

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

const subProgramId = new ObjectId();
const program = { _id: new ObjectId(), name: 'Program 1', subPrograms: [subProgramId] };
const subProgram = { _id: subProgramId, name: 'Subprogram 1', program };

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
    identity: { firstname: 'noCompany', lastname: 'unsubscribed' },
    refreshToken: uuidv4(),
    local: { email: 'trainee2@no-company.fr' },
    origin: WEBAPP,
  },
];

const coursesList = [
  { // 0
    _id: new ObjectId(),
    subProgram: subProgramId,
    company: authCompany._id,
    type: 'intra',
    trainees: [userList[2]._id, traineeList[0]._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    company: authCompany._id,
    type: 'intra',
    trainees: [new ObjectId()],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 2
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    company: otherCompany._id,
    type: 'intra',
    trainees: [new ObjectId()],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 3 interb2b
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    type: 'inter_b2b',
    trainees: [traineeList[2]._id, traineeList[3]._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 4 interb2b with only trainees from otherCompany
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    type: 'inter_b2b',
    trainees: [traineeList[4]._id],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
  },
  { // 5 archived
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    company: authCompany._id,
    type: 'intra',
    trainees: [traineeList[7]._id, new ObjectId()],
    trainer: userList[0]._id,
    salesRepresentative: userList[2]._id,
    archivedAt: '2021-11-17T23:00:00.000Z',
  },
  { // 6 trainer is authTrainer
    _id: new ObjectId(),
    subProgram: subProgramId,
    type: 'inter_b2b',
    trainees: [traineeList[5]._id, traineeList[6]._id],
    trainer,
    salesRepresentative: userList[2]._id,
  },
];

const slotsList = [
  { // 0
    _id: new ObjectId(),
    startDate: '2020-01-23T10:00:00.000Z',
    endDate: '2020-01-23T14:00:00.000Z',
    course: coursesList[0],
    step: new ObjectId(),
  },
  { // 1
    _id: new ObjectId(),
    startDate: '2020-01-23T10:00:00.000Z',
    endDate: '2020-01-23T14:00:00.000Z',
    course: coursesList[0],
    step: new ObjectId(),
  },
  { // 2 - slot from other company's course
    _id: new ObjectId(),
    startDate: '2020-01-23T10:00:00.000Z',
    endDate: '2020-01-23T14:00:00.000Z',
    course: coursesList[2],
    step: new ObjectId(),
  },
  { // 3 - slot for coursesList[3]
    _id: new ObjectId(),
    startDate: '2020-01-23T10:00:00.000Z',
    endDate: '2020-01-23T14:00:00.000Z',
    course: coursesList[3],
    step: new ObjectId(),
  },
  { // 4 - slot for coursesList[4]
    _id: new ObjectId(),
    startDate: '2020-01-23T10:00:00.000Z',
    endDate: '2020-01-23T14:00:00.000Z',
    course: coursesList[4],
    step: new ObjectId(),
  },
  { // 5 - slot for coursesList[5]
    _id: new ObjectId(),
    startDate: '2020-01-23T10:00:00.000Z',
    endDate: '2020-01-23T14:00:00.000Z',
    course: coursesList[5],
    step: new ObjectId(),
  },
];

const attendancesList = [
  { _id: new ObjectId(), courseSlot: slotsList[0], trainee: userList[2]._id },
  { _id: new ObjectId(), courseSlot: slotsList[3], trainee: traineeList[2]._id },
  { _id: new ObjectId(), courseSlot: slotsList[3], trainee: traineeList[3]._id },
  { _id: new ObjectId(), courseSlot: slotsList[5], trainee: traineeList[7]._id },
  { _id: new ObjectId(), courseSlot: slotsList[0], trainee: traineeList[5]._id },
  { _id: new ObjectId(), courseSlot: slotsList[0], trainee: traineeList[6]._id },
];

const userCompanyList = [
  { user: traineeList[0]._id, company: authCompany._id },
  { user: traineeList[2]._id, company: otherCompany._id },
  { user: traineeList[3]._id, company: authCompany._id },
  { user: traineeList[4]._id, company: otherCompany._id },
  { user: traineeList[5]._id, company: authCompany._id },
  { user: traineeList[6]._id, company: otherCompany._id },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Attendance.create(attendancesList),
    Course.create(coursesList),
    CourseSlot.create(slotsList),
    User.create([...userList, ...traineeList]),
    UserCompany.create(userCompanyList),
    Program.create(program),
    SubProgram.create(subProgram),
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
