const { ObjectId } = require('mongodb');
const {
  WEBAPP,
  PUBLISHED,
  MONTHLY,
  GLOBAL,
  INTRA,
  VIDEO,
  SINGLE,
  PRESENT,
  GROUP,
  TRAINEE,
  START_COURSE,
  RESEND,
} = require('../../../src/helpers/constants');
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
const PendingCourseBill = require('../../../src/models/PendingCourseBill');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const CourseBill = require('../../../src/models/CourseBill');

const userList = [
  { // 0
    _id: new ObjectId(),
    identity: { firstname: 'trainee', lastname: 'toto' },
    local: { email: 'trainee@alenvi.io' },
    contact: { countryCode: '+33', phone: '0987654321' },
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
  { // 3
    _id: new ObjectId(),
    identity: { firstname: 'trainee', lastname: 'coco' },
    local: { email: 'trainee_auth@alenvi.io' },
    contact: { countryCode: '+33', phone: '0987654321' },
    origin: WEBAPP,
  },
  { // 4
    _id: new ObjectId(),
    identity: { firstname: 'trainee', lastname: 'lolo' },
    local: { email: 'trainee_auth2@alenvi.io' },
    contact: { countryCode: '+33', phone: '0987654321' },
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
  { _id: new ObjectId(), type: 'on_site', name: 'Evaluation', status: PUBLISHED, theoreticalDuration: 60 },
  { _id: new ObjectId(), type: 'on_site', name: 'CODEV', status: PUBLISHED, theoreticalDuration: 60 },
  {
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'Apprentissage',
    status: PUBLISHED,
    theoreticalDuration: 60,
    activities: [activityList[0]._id],
  },
  { _id: new ObjectId(), type: 'on_site', name: 'tripartite', status: PUBLISHED, theoreticalDuration: 60 },
];

const userCompanyList = [
  { _id: new ObjectId(), user: userList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), user: userList[2]._id, company: otherCompany._id },
  { _id: new ObjectId(), user: userList[3]._id, company: authCompany._id },
  { _id: new ObjectId(), user: userList[4]._id, company: authCompany._id },
];

const subProgramList = [
  {
    _id: new ObjectId(),
    name: 'Subprogram 2',
    steps: [stepList[0]._id, stepList[1]._id, stepList[2]._id, stepList[3]._id],
    status: PUBLISHED,
  },
  { _id: new ObjectId(), name: 'Subprogram 1', steps: [stepList[0]._id], status: PUBLISHED },
];

const courseList = [
  { // 0 - single course
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: SINGLE,
    maxTrainees: 1,
    trainees: [userList[0]._id],
    tutors: [userList[3]._id],
    companies: [authCompany._id],
    trainers: [userList[1]._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: MONTHLY,
    folderId: 'folderId',
    gSheetId: 'gSheetId',
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
    expectedBillsCount: 1,
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
    folderId: 'folderId',
    gSheetId: 'gSheetId',
  },
  { // 3 - single course
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: SINGLE,
    maxTrainees: 1,
    trainees: [userList[3]._id],
    companies: [authCompany._id],
    trainers: [userList[1]._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: MONTHLY,
    folderId: 'folderId',
    gSheetId: 'gSheetId',
  },
  { // 4 - single course
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: SINGLE,
    maxTrainees: 1,
    trainees: [userList[4]._id],
    companies: [authCompany._id],
    trainers: [userList[1]._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: MONTHLY,
    folderId: 'folderId',
    gSheetId: 'gSheetId',
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
    trainers: [userList[1]._id],
  },
  { // 2
    _id: new ObjectId(),
    startDate: '2023-01-22T09:00:00.000Z',
    endDate: '2023-01-22T11:00:00.000Z',
    course: courseList[0]._id,
    step: stepList[0]._id,
    trainers: [userList[1]._id],
  },
  { // 3
    _id: new ObjectId(),
    startDate: '2023-01-22T09:00:00.000Z',
    endDate: '2023-01-22T11:00:00.000Z',
    course: courseList[2]._id,
    step: stepList[0]._id,
    trainers: [userList[1]._id],
  },
  { // 4
    _id: new ObjectId(),
    startDate: '2023-01-09T09:00:00.000Z',
    endDate: '2023-01-09T11:00:00.000Z',
    course: courseList[0]._id,
    step: stepList[0]._id,
    trainers: [userList[1]._id],
  },
  { // 5
    _id: new ObjectId(),
    startDate: '2023-01-09T09:00:00.000Z',
    endDate: '2023-01-09T11:00:00.000Z',
    course: courseList[2]._id,
    step: stepList[0]._id,
    trainers: [userList[1]._id],
  },
  { // 6
    _id: new ObjectId(),
    startDate: '2023-01-15T09:00:00.000Z',
    endDate: '2023-01-15T11:00:00.000Z',
    course: courseList[0]._id,
    step: stepList[1]._id,
    trainers: [userList[1]._id],
  },
  { // 6
    _id: new ObjectId(),
    startDate: '2023-01-09T09:00:00.000Z',
    endDate: '2023-01-09T11:00:00.000Z',
    course: courseList[0]._id,
    step: stepList[1]._id,
    trainers: [userList[1]._id],
  },
  { // 7
    _id: new ObjectId(),
    startDate: '2023-01-15T09:00:00.000Z',
    endDate: '2023-01-15T11:00:00.000Z',
    course: courseList[3]._id,
    step: stepList[1]._id,
    trainers: [userList[1]._id],
  },
  { // 8
    _id: new ObjectId(),
    course: courseList[3]._id,
    step: stepList[1]._id,
    trainers: [userList[1]._id],
  },
  { // 9
    _id: new ObjectId(),
    startDate: '2023-01-09T13:00:00.000Z',
    endDate: '2023-01-09T14:00:00.000Z',
    course: courseList[0]._id,
    step: stepList[3]._id,
    trainers: [userList[1]._id],
  },
  { // 10
    _id: new ObjectId(),
    startDate: '2022-10-08T13:00:00.000Z',
    endDate: '2022-10-08T14:00:00.000Z',
    course: courseList[0]._id,
    step: stepList[3]._id,
    trainers: [userList[1]._id],
  },
  { // 11
    _id: new ObjectId(),
    startDate: '2022-04-08T13:00:00.000Z',
    endDate: '2022-04-08T14:00:00.000Z',
    course: courseList[2]._id,
    step: stepList[3]._id,
    trainers: [userList[1]._id],
  },
  { // 11
    _id: new ObjectId(),
    startDate: '2021-10-08T13:00:00.000Z',
    endDate: '2021-10-08T14:00:00.000Z',
    course: courseList[3]._id,
    step: stepList[3]._id,
    trainers: [userList[1]._id],
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

const courseBillList = [
  { // 0
    _id: new ObjectId(),
    course: courseList[0]._id,
    companies: [authCompany._id],
    mainFee: { price: 1200.20, count: 1, countUnit: TRAINEE },
    billedAt: '2022-03-06T00:00:00.000Z',
    number: 'FACT-00001',
    payer: { company: authCompany._id },
  },
  { // 1
    _id: new ObjectId(),
    course: courseList[1]._id,
    companies: [authCompany._id],
    billedAt: '2022-03-06T00:00:00.000Z',
    number: 'FACT-00002',
    mainFee: { price: 1200, count: 1, description: 'Accompagnement Mars 2022', countUnit: GROUP },
    payer: { company: authCompany._id },
  },
  { // 2
    _id: new ObjectId(),
    course: courseList[0]._id,
    companies: [authCompany._id],
    mainFee: { price: 1200, count: 1, description: 'Lorem ipsum', countUnit: TRAINEE },
    payer: { company: authCompany._id },
    billedAt: '2022-04-06T00:00:00.000Z',
    number: 'FACT-00003',
    sendingDates: ['2022-04-09T00:00:00.000Z'],
  },
];

const pendingCourseBillList = [
  {
    courseBills: [courseBillList[0]._id, courseBillList[1]._id],
    sendingDate: '2023-01-07T23:00:00.000Z',
    recipientEmails: ['test@compani.fr'],
    content: 'Bonjour, ceci est un test',
    type: START_COURSE,
  },
  {
    courseBills: [courseBillList[2]._id],
    sendingDate: '2023-01-12T23:00:00.000Z',
    recipientEmails: ['test@compani.fr'],
    content: 'Bonjour, ceci est une relance',
    type: RESEND,
  },
];

const courseBillNumber = { _id: new ObjectId(), seq: 3 };

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Attendance.create(attendanceList),
    Activity.create(activityList),
    ActivityHistory.create(activityHistoryList),
    Card.create(cardsList),
    Course.create(courseList),
    CourseBill.create(courseBillList),
    CourseBillsNumber.create(courseBillNumber),
    CourseSlot.create(slotList),
    PendingCourseBill.create(pendingCourseBillList),
    Step.create(stepList),
    SubProgram.create(subProgramList),
    User.create(userList),
    UserCompany.create(userCompanyList),
  ]);
};

module.exports = { populateDB, courseList, userList, stepList, subProgramList };
