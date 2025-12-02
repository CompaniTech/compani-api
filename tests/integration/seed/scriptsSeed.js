const { ObjectId } = require('mongodb');
const { WEBAPP, PUBLISHED, MONTHLY, GLOBAL, INTRA, VIDEO, SINGLE, PRESENT } = require('../../../src/helpers/constants');
const User = require('../../../src/models/User');
const Course = require('../../../src/models/Course');
const UserCompany = require('../../../src/models/UserCompany');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const { trainerRoleId } = require('../../seed/authRolesSeed');
const { authCompany, otherCompany } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const CourseSlot = require('../../../src/models/CourseSlot');
const Attendance = require('../../../src/models/Attendance');
const { vendorAdmin } = require('../../seed/authUsersSeed');
const Activity = require('../../../src/models/Activity');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const Card = require('../../../src/models/Card');

const userList = [
  { // 0
    _id: new ObjectId(),
    identity: { firstname: 'trainee', lastname: 'toto' },
    local: { email: 'trainee@alenvi.io' },
    origin: WEBAPP,
  },
  { // 1
    _id: new ObjectId(),
    identity: { firstname: 'trainer', lastname: 'FromOtherCompany' },
    local: { email: 'trainerFromOtherCompany@compani.fr' },
    role: { vendor: trainerRoleId },
    origin: WEBAPP,
  },
  { // 2
    _id: new ObjectId(),
    identity: { firstname: 'trainee', lastname: 'otherCompany' },
    local: { email: 'trainee_otherCompany@alenvi.io' },
    origin: WEBAPP,
  },
];

const cardsList = [{ _id: new ObjectId(), template: 'transition', title: 'ceci est un titre' }];

const activityList = [{
  _id: new ObjectId(),
  name: 'une super activité',
  type: VIDEO,
  cards: [cardsList[0]._id],
  status: PUBLISHED,
}];

const stepList = [
  { _id: new ObjectId(), type: 'on_site', name: 'Coaching - reflexivité', status: PUBLISHED, theoreticalDuration: 60 },
  { _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 },
  {
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'Apprentissage',
    status: PUBLISHED,
    theoreticalDuration: 60,
    activities: [activityList[0]._id],
  },
];

const userCompanyList = [
  { _id: new ObjectId(), user: userList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), user: userList[0]._id, company: otherCompany._id },
];

const subProgramList = [
  {
    _id: new ObjectId(),
    name: 'Subprogram 2',
    steps: [stepList[0]._id, stepList[2]._id],
    status: PUBLISHED,
  },
  { _id: new ObjectId(), name: 'Subprogram 1', steps: [stepList[1]._id], status: PUBLISHED },
];

const courseList = [
  { // 0 - single course
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: SINGLE,
    maxTrainees: 8,
    trainees: [userList[0]._id],
    companies: [authCompany._id],
    trainers: [userList[1]._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: MONTHLY,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: subProgramList[1]._id,
    type: INTRA,
    maxTrainees: 8,
    trainees: [userList[0]._id],
    companies: [authCompany._id],
    trainers: [userList[1]._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 2 - single course
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: SINGLE,
    maxTrainees: 8,
    trainees: [userList[2]._id],
    companies: [otherCompany._id],
    trainers: [userList[1]._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: MONTHLY,
  },
];

const slotList = [
  { // 0
    _id: new ObjectId(),
    startDate: '2025-02-23T09:00:00.000Z',
    endDate: '2025-02-23T11:00:00.000Z',
    course: courseList[0]._id,
    step: stepList[0]._id,
  },
  { // 1
    _id: new ObjectId(),
    startDate: '2025-02-25T09:00:00.000Z',
    endDate: '2025-02-25T11:00:00.000Z',
    course: courseList[1]._id,
    step: stepList[0]._id,
  },
];

const attendanceList = [
  {
    _id: new ObjectId(),
    trainee: userList[0]._id,
    courseSlot: slotList[0]._id,
    company: authCompany._id,
    status: PRESENT,
  },
  {
    _id: new ObjectId(),
    trainee: userList[0]._id,
    courseSlot: slotList[1]._id,
    company: authCompany._id,
    status: PRESENT,
  },
];

const activityHistoryList = [
  { _id: new ObjectId(), activity: activityList[0]._id, user: userList[2]._id, date: '2025-02-25T10:05:32.582Z' },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Attendance.create(attendanceList),
    Activity.create(activityList),
    ActivityHistory.create(activityHistoryList),
    Card.create(cardsList),
    Course.create(courseList),
    CourseSlot.create(slotList),
    Step.create(stepList),
    SubProgram.create(subProgramList),
    User.create(userList),
    UserCompany.create(userCompanyList),
  ]);
};

module.exports = { populateDB, courseList, userList };
