const { ObjectId } = require('mongodb');
const Activity = require('../../../src/models/Activity');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const Attendance = require('../../../src/models/Attendance');
const Course = require('../../../src/models/Course');
const CourseSlot = require('../../../src/models/CourseSlot');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const Program = require('../../../src/models/Program');
const { INTER_B2B, PUBLISHED, MONTHLY, VIDEO, E_LEARNING } = require('../../../src/helpers/constants');
const { authCompany } = require('../../seed/authCompaniesSeed');
const {
  trainer,
  trainerAndCoach,
  noRole,
  trainerOrganisationManager,
  auxiliary,
  holdingAdminFromAuthCompany,
} = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const Attendance = require('../../../src/models/Attendance');

const cardsList = [
  { _id: new ObjectId(), template: 'transition', title: 'ceci est un titre' },
];

const activityList = [{
  _id: new ObjectId(),
  name: 'great activity',
  type: VIDEO,
  cards: [cardsList[0]._id],
  status: PUBLISHED,
}];

const activityHistoryList = [
  { _id: new ObjectId(), activity: activityList[0]._id, user: auxiliary._id, date: '2025-03-25T10:05:32.582Z' },
  { _id: new ObjectId(), activity: activityList[0]._id, user: auxiliary._id, date: '2025-02-21T10:05:32.582Z' },
];

const stepList = [
  { _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 },
  { _id: new ObjectId(), type: 'on_site', name: 'autre étape', status: PUBLISHED, theoreticalDuration: 60 },
  {
    _id: new ObjectId(),
    type: E_LEARNING,
    name: 'étape',
    status: PUBLISHED,
    activities: [activityList[0]._id],
    theoreticalDuration: 60,
  },
];

const subProgramList = [
  { _id: new ObjectId(), name: 'Subprogram 1', steps: [stepList[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'Subprogram 2', steps: [stepList[1]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'Subprogram 3', steps: [stepList[2]._id], status: PUBLISHED },
];

const programsList = [
  { _id: new ObjectId(), name: 'Program 1', subPrograms: [subProgramList[0]._id, subProgramList[1]._id] },
];

const courseList = [
  { // 0 Course with monthly certificateGenerationMode
    _id: new ObjectId(),
    subProgram: subProgramList[1]._id,
    type: INTER_B2B,
    trainees: [noRole._id, holdingAdminFromAuthCompany._id],
    companies: [authCompany._id],
    operationsRepresentative: trainerOrganisationManager._id,
    trainers: [trainer._id, trainerAndCoach._id],
    certificateGenerationMode: MONTHLY,
  },
  { // 1 Course with monthly certificateGenerationMode
    _id: new ObjectId(),
    subProgram: subProgramList[2]._id,
    type: INTER_B2B,
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    operationsRepresentative: trainerOrganisationManager._id,
    trainers: [trainer._id],
    certificateGenerationMode: MONTHLY,
  },
  { // 2 Course with monthly certificateGenerationMode and same subProgram as courseList[0]
    _id: new ObjectId(),
    subProgram: subProgramList[1]._id,
    type: INTER_B2B,
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    operationsRepresentative: trainerOrganisationManager._id,
    trainers: [trainer._id],
    certificateGenerationMode: MONTHLY,
  },
];

const slotsList = [
  { // 0
    _id: new ObjectId(),
    startDate: '2020-01-20T10:00:00.000Z',
    endDate: '2020-01-20T14:00:00.000Z',
    course: courseList[0],
    step: stepList[1]._id,
  },
  { // 1
    _id: new ObjectId(),
    startDate: '2020-01-21T10:00:00.000Z',
    endDate: '2020-01-21T14:00:00.000Z',
    course: courseList[2],
    step: stepList[1]._id,
  },
];

const attendancesList = [
  { _id: new ObjectId(), courseSlot: slotsList[0]._id, trainee: noRole._id, company: authCompany._id },
  {
    _id: new ObjectId(),
    courseSlot: slotsList[1]._id,
    trainee: holdingAdminFromAuthCompany._id,
    company: authCompany._id,
  },
];

const slotsList = [
  { // 0
    _id: new ObjectId(),
    startDate: '2025-03-20T10:00:00.000Z',
    endDate: '2025-03-20T14:00:00.000Z',
    course: courseList[1]._id,
    step: stepList[2]._id,
  },
  { // 1
    _id: new ObjectId(),
    startDate: '2025-03-21T10:00:00.000Z',
    endDate: '2025-03-21T14:00:00.000Z',
    course: courseList[1]._id,
    step: stepList[2]._id,
  },
  { // 2
    _id: new ObjectId(),
    startDate: '2025-02-21T10:00:00.000Z',
    endDate: '2025-02-21T14:00:00.000Z',
    course: courseList[1]._id,
    step: stepList[2]._id,
  },
  { // 3 without attendance
    _id: new ObjectId(),
    startDate: '2024-12-21T10:00:00.000Z',
    endDate: '2024-12-21T14:00:00.000Z',
    course: courseList[1]._id,
    step: stepList[2]._id,
  },
];

const attendancesList = [
  {
    _id: new ObjectId(),
    trainee: auxiliary._id,
    courseSlot: slotsList[1]._id,
    company: authCompany._id,
  },
  {
    _id: new ObjectId(),
    trainee: auxiliary._id,
    courseSlot: slotsList[2]._id,
    company: authCompany._id,
  },
];

const completionCertificateList = [
  { _id: new ObjectId(), course: courseList[0]._id, trainee: noRole._id, month: '12-2024' },
  { _id: new ObjectId(), course: courseList[0]._id, trainee: noRole._id, month: '01-2025' },
  { _id: new ObjectId(), course: courseList[0]._id, trainee: noRole._id, month: '02-2025' },
  { _id: new ObjectId(), course: courseList[1]._id, trainee: auxiliary._id, month: '01-2025' },
  {
    _id: new ObjectId(),
    course: courseList[1]._id,
    trainee: auxiliary._id,
    month: '02-2025',
    file: { publicId: 'certif1', link: 'https://test.com/certif1' },
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activityList),
    ActivityHistory.create(activityHistoryList),
    Attendance.create(attendancesList),
    Course.create(courseList),
    CourseSlot.create(slotsList),
    CompletionCertificate.create(completionCertificateList),
    Step.create(stepList),
    SubProgram.create(subProgramList),
    Program.create(programsList),
  ]);
};

module.exports = { populateDB, courseList, completionCertificateList };
