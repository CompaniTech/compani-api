const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const {
  WEBAPP,
  INTRA,
  GLOBAL,
  GROUP,
  PUBLISHED,
  SINGLE,
  MONTHLY,
  TRAINEE,
  BLENDED,
} = require('../../../src/helpers/constants');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const CourseSlot = require('../../../src/models/CourseSlot');
const Program = require('../../../src/models/Program');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const VendorCompany = require('../../../src/models/VendorCompany');
const { otherCompany, authCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { clientAdminRoleId, trainerRoleId, helperRoleId, coachRoleId } = require('../../seed/authRolesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { trainer, vendorAdmin } = require('../../seed/authUsersSeed');
const { auxiliary } = require('../../../src/models/schemaDefinitions/pay');

const emailUser = {
  _id: new ObjectId(),
  identity: { firstname: 'emailUser', lastname: 'Test' },
  local: { email: 'email_user@alenvi.io' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  origin: WEBAPP,
};

const emailUserFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'otherCompany', lastname: 'Test' },
  local: { email: 'email_user_other_company@alenvi.io' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  origin: WEBAPP,
};

const coachFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'coach', lastname: 'Test' },
  local: { email: 'coach_email_user@alenvi.io' },
  refreshToken: uuidv4(),
  role: { client: coachRoleId },
  origin: WEBAPP,
};

const trainerFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'trainer', lastname: 'Test' },
  local: { email: 'trainer_email_other_company@alenvi.io' },
  refreshToken: uuidv4(),
  role: { vendor: trainerRoleId },
  origin: WEBAPP,
};

const helperFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'helper', lastname: 'Test' },
  local: { email: 'helper_email_user@alenvi.io' },
  refreshToken: uuidv4(),
  role: { client: helperRoleId },
  origin: WEBAPP,
};

const futureTraineeFromAuthCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'future', lastname: 'Trainee' },
  local: { email: 'future_trainee@alenvi.io' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const emailUserFromThirdCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'third', lastname: 'company' },
  local: { email: 'third_trainee@alenvi.io' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const emailUsers = [
  emailUser,
  emailUserFromOtherCompany,
  trainerFromOtherCompany,
  helperFromOtherCompany,
  coachFromOtherCompany,
  futureTraineeFromAuthCompany,
  emailUserFromThirdCompany,
];

const userCompanies = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: emailUser._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: emailUser._id, company: authCompany._id },
  { _id: new ObjectId(), user: emailUserFromOtherCompany._id, company: otherCompany._id },
  { _id: new ObjectId(), user: trainerFromOtherCompany._id, company: otherCompany._id },
  { _id: new ObjectId(), user: emailUserFromThirdCompany._id, company: companyWithoutSubscription._id },
  {
    _id: new ObjectId(),
    user: futureTraineeFromAuthCompany._id,
    company: authCompany._id,
    startDate: CompaniDate().add('P1D').toISO(),
  },
  { _id: new ObjectId(), user: coachFromOtherCompany._id, company: otherCompany._id },
  { _id: new ObjectId(), user: helperFromOtherCompany._id, company: otherCompany._id },
];

const stepList = [
  { _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 },
  { _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 120 },
];

const subProgramList = [{ _id: new ObjectId(), name: 'subProgram 1', steps: [stepList[0]._id], status: PUBLISHED }];

const programsList = [
  { _id: new ObjectId(), name: 'Program 1', subPrograms: [subProgramList[0]._id] },
];

const VAEI_SUBPROGRAM_ID = new ObjectId();

const coursesList = [
  {
    _id: new ObjectId(),
    type: INTRA,
    format: BLENDED,
    subProgram: subProgramList[0]._id,
    misc: 'group inter',
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    expectedBillsCount: 2,
    maxTrainees: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // VAEI course
    _id: new ObjectId(),
    type: SINGLE,
    format: BLENDED,
    subProgram: VAEI_SUBPROGRAM_ID,
    misc: 'Tony Montana',
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    expectedBillsCount: 21,
    maxTrainees: 1,
    certificateGenerationMode: MONTHLY,
  },
];

const courseBillsList = [
  { // 0
    _id: new ObjectId(),
    course: coursesList[0]._id,
    companies: [authCompany._id],
    mainFee: { price: 1200.20, count: 1, countUnit: GROUP },
    billedAt: '2022-03-06T00:00:00.000Z',
    number: 'FACT-00001',
    payer: { company: authCompany._id },
  },
  { // 1
    _id: new ObjectId(),
    course: coursesList[1]._id,
    companies: [authCompany._id],
    billedAt: '2022-03-06T00:00:00.000Z',
    number: 'FACT-00002',
    mainFee: { price: 1200, count: 1, description: 'Accompagnement Mars 2022', countUnit: TRAINEE },
    payer: { company: authCompany._id },
  },
  { // 2
    _id: new ObjectId(),
    course: coursesList[0]._id,
    companies: [authCompany._id],
    mainFee: { price: 1200, count: 1, description: 'Lorem ipsum', countUnit: GROUP },
    payer: { company: authCompany._id },
    billedAt: '2022-04-06T00:00:00.000Z',
    number: 'FACT-00003',
    sendingDates: ['2022-04-09T00:00:00.000Z'],
  },
];

const courseBillNumber = { _id: new ObjectId(), seq: 3 };

const slotAddress = {
  street: '24 Avenue Daumesnil',
  fullAddress: '24 Avenue Daumesnil 75012 Paris',
  zipCode: '75012',
  city: 'Paris',
  location: { type: 'Point', coordinates: [2.37345, 48.848024] },
};

const courseSlotList = [
  { // 0
    _id: new ObjectId(),
    course: coursesList[0]._id,
    step: stepList[0]._id,
    startDate: '2021-05-01T08:00:00.000Z',
    endDate: '2021-05-01T10:00:00.000Z',
    address: slotAddress,
    createdAt: '2020-12-12T10:00:00.000Z',
  },
  { // 1
    _id: new ObjectId(),
    course: coursesList[0]._id,
    step: stepList[1]._id,
    startDate: '2021-05-01T14:00:00.000Z',
    endDate: '2021-05-01T16:00:00.000Z',
    meetingLink: 'https://meet.google.com',
    createdAt: '2020-12-12T10:00:01.000Z',
  },
];

const vendorCompany = {
  name: 'VendorCompany',
  billingRepresentative: {
    _id: new ObjectId(),
    identity: { firstname: 'toto', lastname: 'zero' },
    contact: {},
    local: { email: 'toto@zero.io' },
  },
  iban: 'FR2817569000407686668287H77',
  bic: 'ERTYFRPP',
  address: {
    fullAddress: '24 Avenue Daumesnil 75012 Paris',
    street: '24 Avenue Daumesnil',
    city: 'Paris',
    zipCode: '75012',
    location: { type: 'Point', coordinates: [2.37345, 48.848024] },
  },
  ics: 'FR12345678909',
  debitMandateTemplate: { link: 'link/123567890', driveId: '123567890' },
  shareCapital: 123000,
  activityDeclarationNumber: 123456789,
  siret: '12345678901245',
};

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Course.create(coursesList),
    CourseBill.create(courseBillsList),
    CourseBillsNumber.create(courseBillNumber),
    CourseSlot.create(courseSlotList),
    Program.create(programsList),
    Step.create(stepList),
    SubProgram.create(subProgramList),
    User.create(emailUsers),
    UserCompany.create(userCompanies),
    VendorCompany.create(vendorCompany),
  ]);
};

module.exports = {
  populateDB,
  emailUser,
  emailUserFromOtherCompany,
  trainerFromOtherCompany,
  helperFromOtherCompany,
  coachFromOtherCompany,
  futureTraineeFromAuthCompany,
  emailUserFromThirdCompany,
  courseBillsList,
  VAEI_SUBPROGRAM_ID,
  coursesList,
};
