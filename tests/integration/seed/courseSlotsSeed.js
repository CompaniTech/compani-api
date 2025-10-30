const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Activity = require('../../../src/models/Activity');
const Card = require('../../../src/models/Card');
const Course = require('../../../src/models/Course');
const Program = require('../../../src/models/Program');
const CourseSlot = require('../../../src/models/CourseSlot');
const UserCompany = require('../../../src/models/UserCompany');
const User = require('../../../src/models/User');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const Attendance = require('../../../src/models/Attendance');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const { authCompany, otherCompany, companyWithoutSubscription, authHolding } = require('../../seed/authCompaniesSeed');
const { vendorAdmin, trainerAndCoach, trainer } = require('../../seed/authUsersSeed');
const {
  WEBAPP,
  INTRA,
  PUBLISHED,
  LESSON,
  INTRA_HOLDING,
  GLOBAL,
  SINGLE,
  MONTHLY,
} = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { auxiliaryRoleId } = require('../../seed/authRolesSeed');

const traineeFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'fdsdsdf', lastname: 'sdfds' },
  local: { email: 'traineeOtherCompany@alenvi.fr' },
  role: { client: auxiliaryRoleId },
  contact: { phone: '0734856751', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const userCompanies = [
  {
    _id: new ObjectId(),
    user: traineeFromOtherCompany._id,
    company: otherCompany._id,
    startDate: '2020-01-01T23:00:00.000Z',
  },
];

const cardsList = [
  { _id: new ObjectId(), template: 'title_text', title: 'title', text: 'text' },
];

const activitiesList = [
  { _id: new ObjectId(), name: 'great activity', type: LESSON, cards: [cardsList[0]._id], status: PUBLISHED },
];

const stepsList = [
  { _id: new ObjectId(), type: 'on_site', name: 'c\'est une étape', status: PUBLISHED, theoreticalDuration: 60 },
  {
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'toujours une étape',
    status: PUBLISHED,
    theoreticalDuration: 60,
    activities: [activitiesList[0]._id],
  },
  { _id: new ObjectId(), type: 'e_learning', name: 'encore une étape' },
  { _id: new ObjectId(), type: 'on_site', name: 'encore une étape' },
  { _id: new ObjectId(), type: 'remote', name: 'une étape de plus', status: PUBLISHED, theoreticalDuration: 60 },
];

const subProgramsList = [
  {
    _id: new ObjectId(),
    name: 'sous-programme A',
    steps: [stepsList[0]._id, stepsList[1]._id, stepsList[4]._id],
    status: PUBLISHED,
  },
  { _id: new ObjectId(), name: 'sous-programme B', steps: [stepsList[2]._id, stepsList[3]._id] },
];

const programsList = [
  { _id: new ObjectId(), name: 'program', subPrograms: [subProgramsList[0]] },
  { _id: new ObjectId(), name: 'training program', subPrograms: [subProgramsList[1]] },
];

const coursesList = [
  { // 0
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    trainees: [],
    companies: [authCompany._id],
    misc: 'first session',
    type: INTRA,
    maxTrainees: 8,
    trainers: [trainer._id, trainerAndCoach._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    trainees: [traineeFromOtherCompany._id],
    companies: [otherCompany._id],
    misc: 'team formation',
    type: SINGLE,
    trainers: [trainerAndCoach._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: MONTHLY,
    maxTrainees: 1,
    expectedBills: 0,
  },
  { // 2
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    trainees: [],
    companies: [authCompany._id],
    misc: 'old session',
    type: INTRA,
    maxTrainees: 8,
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    archivedAt: '2021-11-15T09:00:00',
    certificateGenerationMode: GLOBAL,
  },
  { // 3
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    trainees: [],
    companies: [companyWithoutSubscription._id],
    misc: 'third company',
    type: INTRA,
    maxTrainees: 8,
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 4
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'team formation',
    trainers: [trainer._id],
    trainees: [],
    companies: [authCompany._id],
    type: INTRA_HOLDING,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    holding: authHolding._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 5 without companies
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'team formation',
    trainers: [trainer._id],
    trainees: [],
    companies: [],
    type: INTRA_HOLDING,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    holding: authHolding._id,
    certificateGenerationMode: GLOBAL,
  },
];

const courseSlotsList = [
  { // 0
    _id: new ObjectId(),
    startDate: '2020-03-10T09:00:00',
    endDate: '2020-03-10T12:00:00',
    course: coursesList[0]._id,
    step: stepsList[0]._id,
    address: {
      street: '37 rue de Ponthieu',
      zipCode: '75008',
      city: 'Paris',
      fullAddress: '37 rue de Ponthieu 75008 Paris',
      location: { type: 'Point', coordinates: [2.0987, 1.2345] },
    },
  },
  { // 1
    _id: new ObjectId(),
    startDate: '2020-04-10T09:00:00',
    endDate: '2020-04-10T12:00:00',
    course: coursesList[0]._id,
    step: stepsList[0]._id,
  },
  { // 2
    _id: new ObjectId(),
    startDate: '2020-03-10T14:00:00',
    endDate: '2020-03-10T16:00:00',
    course: coursesList[0]._id,
    step: stepsList[0]._id,
  },
  { // 3
    _id: new ObjectId(),
    startDate: '2020-04-10T09:00:00',
    endDate: '2020-04-10T12:00:00',
    course: coursesList[1]._id,
    step: stepsList[0]._id,
  },
  { // 4 slot with attendance
    _id: new ObjectId(),
    startDate: '2020-05-10T09:00:00',
    endDate: '2020-05-10T12:00:00',
    course: coursesList[1]._id,
    step: stepsList[0]._id,
  },
  { // 5 old session slot
    _id: new ObjectId(),
    startDate: '2020-05-10T09:00:00',
    endDate: '2020-05-10T12:00:00',
    course: coursesList[2]._id,
    step: stepsList[0]._id,
  },
  { // 6 slot to plan
    _id: new ObjectId(),
    course: coursesList[1]._id,
    step: stepsList[0]._id,
  },
  { // 7
    _id: new ObjectId(),
    startDate: '2020-05-10T09:00:00',
    endDate: '2020-05-10T12:00:00',
    course: coursesList[0]._id,
    step: stepsList[1]._id,
  },
  { // 8 remote slot with meetingLink
    _id: new ObjectId(),
    startDate: '2020-12-10T09:00:00',
    endDate: '2020-12-10T12:00:00',
    course: coursesList[0]._id,
    step: stepsList[4]._id,
    meetingLink: 'https://meet.google.com',
  },
  { // 9
    _id: new ObjectId(),
    startDate: '2020-04-10T09:00:00',
    endDate: '2020-04-10T12:00:00',
    course: coursesList[3]._id,
    step: stepsList[0]._id,
  },
  { // 10
    _id: new ObjectId(),
    startDate: '2020-04-10T09:00:00',
    endDate: '2020-04-10T12:00:00',
    course: coursesList[4]._id,
    step: stepsList[0]._id,
  },
  { // 11
    _id: new ObjectId(),
    startDate: '2020-04-10T09:00:00',
    endDate: '2020-04-10T12:00:00',
    course: coursesList[5]._id,
    step: stepsList[0]._id,
  },
  { // 12 slot with attendance sheet
    _id: new ObjectId(),
    startDate: '2020-05-10T09:00:00',
    endDate: '2020-05-10T12:00:00',
    course: coursesList[1]._id,
    step: stepsList[0]._id,
  },
  { // 13 slot in completion certificate month
    _id: new ObjectId(),
    startDate: '2020-05-13T09:00:00',
    endDate: '2020-05-13T12:00:00',
    course: coursesList[1]._id,
    step: stepsList[0]._id,
  },
];

const attendance = {
  _id: new ObjectId(),
  trainee: traineeFromOtherCompany._id,
  courseSlot: courseSlotsList[4]._id,
  company: otherCompany._id,
};

const attendanceSheet = {
  _id: new ObjectId(),
  course: coursesList[1]._id,
  file: { publicId: 'mon upload', link: 'www.test.com' },
  trainee: traineeFromOtherCompany._id,
  companies: [otherCompany._id],
  slots: [{ slotId: courseSlotsList[12]._id }],
  origin: WEBAPP,
  trainer: trainerAndCoach._id,
};

const completionCertificate = {
  trainee: traineeFromOtherCompany._id,
  month: '05-2020',
  company: otherCompany._id,
  course: coursesList[1]._id,
  file: { publicId: 'comp-certif', link: 'www.certif.com' },
};

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activitiesList),
    Card.create(cardsList),
    CompletionCertificate.create(completionCertificate),
    SubProgram.create(subProgramsList),
    Program.create(programsList),
    Course.create(coursesList),
    CourseSlot.create(courseSlotsList),
    Step.create(stepsList),
    User.create([traineeFromOtherCompany]),
    Attendance.create(attendance),
    AttendanceSheet.create(attendanceSheet),
    UserCompany.create(userCompanies),
  ]);
};

module.exports = {
  populateDB,
  coursesList,
  programsList,
  courseSlotsList,
  stepsList,
};
