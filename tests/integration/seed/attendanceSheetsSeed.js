const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const Course = require('../../../src/models/Course');
const CourseSlot = require('../../../src/models/CourseSlot');
const { authCompany, otherCompany } = require('../../seed/authCompaniesSeed');
const { WEBAPP, INTRA, INTER_B2B } = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/authentication');
const UserCompany = require('../../../src/models/UserCompany');
const User = require('../../../src/models/User');
const { vendorAdminRoleId } = require('../../seed/authRolesSeed');

const userList = [
  {
    _id: new ObjectId(),
    identity: { firstname: 'sales', lastname: 'representative' },
    refreshToken: uuidv4(),
    local: { email: 'salesrep@compani.fr' },
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
  {
    _id: new ObjectId(),
    identity: { firstname: 'traineeFromINTERB2B', lastname: 'withOtherCompany' },
    local: { email: 'traineeFromINTERB2B@alenvi.io' },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'trainer', lastname: 'FromOtherCompany' },
    local: { email: 'trainerFromOtherCompany@compani.fr' },
    origin: WEBAPP,
  },
];

const userCompaniesList = [
  { _id: new ObjectId(), user: userList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), user: userList[1]._id, company: authCompany._id },
  { _id: new ObjectId(), user: userList[2]._id, company: otherCompany._id },
  { _id: new ObjectId(), user: userList[3]._id, company: otherCompany._id },
];

const coursesList = [
  { // 0
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    companies: [authCompany._id],
    type: INTRA,
    maxTrainees: 8,
    trainees: [userList[1]._id],
    salesRepresentative: userList[0]._id,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    type: INTER_B2B,
    trainees: [userList[1]._id],
    salesRepresentative: userList[0]._id,
  },
  { // 2
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    companies: [otherCompany._id],
    trainees: [userList[1]._id],
    trainer: userList[3]._id,
    salesRepresentative: userList[0]._id,
  },
  { // 3 - archived
    _id: new ObjectId(),
    subProgram: new ObjectId(),
    type: INTER_B2B,
    archivedAt: new Date(),
    trainees: [userList[1]._id],
    salesRepresentative: userList[0]._id,
  },
];

const attendanceSheetsList = [
  {
    _id: new ObjectId(),
    course: coursesList[0],
    file: { publicId: 'mon upload', link: 'www.test.com' },
    date: '2020-04-03T10:00:00',
  },
  {
    _id: new ObjectId(),
    course: coursesList[0],
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[1]._id,
  },
  {
    _id: new ObjectId(),
    course: coursesList[1],
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[1]._id,
  },
  {
    _id: new ObjectId(),
    course: coursesList[1],
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[2]._id,
  },
  {
    _id: new ObjectId(),
    course: coursesList[3],
    file: { publicId: 'mon upload', link: 'www.test.com' },
    trainee: userList[1]._id,
  },
];

const slotsList = [
  { startDate: '2020-01-23T09:00:00', endDate: '2020-01-23T11:00:00', course: coursesList[0], step: new ObjectId() },
  { startDate: '2020-01-25T09:00:00', endDate: '2020-01-25T11:00:00', course: coursesList[2], step: new ObjectId() },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    AttendanceSheet.create(attendanceSheetsList),
    Course.create(coursesList),
    CourseSlot.create(slotsList),
    User.create(userList),
    UserCompany.create(userCompaniesList),
  ]);
};

module.exports = {
  populateDB,
  attendanceSheetsList,
  coursesList,
  slotsList,
};
