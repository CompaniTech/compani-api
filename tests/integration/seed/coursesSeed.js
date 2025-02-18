const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const Company = require('../../../src/models/Company');
const CompanyHolding = require('../../../src/models/CompanyHolding');
const Course = require('../../../src/models/Course');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const CourseSlot = require('../../../src/models/CourseSlot');
const CourseSmsHistory = require('../../../src/models/CourseSmsHistory');
const CourseHistory = require('../../../src/models/CourseHistory');
const User = require('../../../src/models/User');
const Step = require('../../../src/models/Step');
const UserCompany = require('../../../src/models/UserCompany');
const Activity = require('../../../src/models/Activity');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const Card = require('../../../src/models/Card');
const Questionnaire = require('../../../src/models/Questionnaire');
const QuestionnaireHistory = require('../../../src/models/QuestionnaireHistory');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const CourseCreditNote = require('../../../src/models/CourseCreditNote');
const CourseCreditNoteNumber = require('../../../src/models/CourseCreditNoteNumber');
const Attendance = require('../../../src/models/Attendance');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const {
  authCompany,
  otherCompany,
  companyWithoutSubscription: thirdCompany,
  otherHolding,
  authHolding,
} = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const {
  vendorAdmin,
  noRole,
  auxiliary,
  helper,
  clientAdmin,
  trainerOrganisationManager,
  coach,
  trainer,
  trainerAndCoach,
  holdingAdminFromOtherCompany,
} = require('../../seed/authUsersSeed');
const {
  VIDEO,
  WEBAPP,
  SLOT_CREATION,
  SLOT_DELETION,
  INTRA,
  INTER_B2B,
  STRICTLY_E_LEARNING,
  INTER_B2C,
  BLENDED,
  TRAINEE_ADDITION,
  COMPANY_ADDITION,
  PUBLISHED,
  INTRA_HOLDING,
  GROUP,
  TRAINEE,
  TITLE_TEXT,
  SURVEY,
  GLOBAL,
  MONTHLY,
  SINGLE,
} = require('../../../src/helpers/constants');
const { auxiliaryRoleId, trainerRoleId, coachRoleId, clientAdminRoleId } = require('../../seed/authRolesSeed');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');

const SINGLE_COURSES_SUBPROGRAM_IDS = process.env.SINGLE_COURSES_SUBPROGRAM_IDS.split(';').map(id => new ObjectId(id));

const traineeFromAuthFormerlyInOther = {
  _id: new ObjectId(),
  identity: { firstname: 'Michel', lastname: 'Drucker' },
  local: { email: 'traineeAuthFormerlyOther@alenvi.io', password: '123456!eR' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const traineeFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Fred', lastname: 'Astaire' },
  local: { email: 'traineeOtherCompany@alenvi.io', password: '123456!eR' },
  role: { client: auxiliaryRoleId },
  contact: { phone: '0734856751', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const traineeFromAuthCompanyWithFormationExpoToken = {
  _id: new ObjectId(),
  identity: { firstname: 'Trainee', lastname: 'WithExpoToken' },
  local: { email: 'traineeWithExpoToken@alenvi.io' },
  role: { client: auxiliaryRoleId },
  contact: { phone: '0734856751', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
  formationExpoTokenList: ['ExponentPushToken[jeSuisUnTokenExpo]', 'ExponentPushToken[jeSuisUnAutreTokenExpo]'],
};

const traineeFormerlyInAuthCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Trainee', lastname: 'Formerly In Auth Company' },
  local: { email: 'trainee-formerly-in-auth-company@alenvi.io' },
  contact: { phone: '0121212121', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const traineeComingUpInAuthCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Trainee', lastname: 'Coming Up In Auth Company' },
  local: { email: 'trainee-coming-up-in-auth-company@alenvi.io' },
  contact: { phone: '0121212121', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const traineeWithoutCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Salut', lastname: 'Toi' },
  local: { email: 'traineeWithoutCompany@alenvi.io' },
  role: { vendor: trainerRoleId },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const traineeFromThirdCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Fred', lastname: 'Subscription' },
  local: { email: 'trainee_third_company@alenvi.io', password: '123456!eR' },
  role: { client: auxiliaryRoleId },
  contact: { phone: '0734856752', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const coachFromThirdCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Manon', lastname: 'Subscription' },
  local: { email: 'coach_third_company@alenvi.io', password: '123456!eR' },
  role: { client: coachRoleId },
  contact: { phone: '0734856752', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const clientAdminFromThirdCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Sophie', lastname: 'Subscription' },
  local: { email: 'admin_third_company@alenvi.io', password: '123456!eR' },
  role: { client: clientAdminRoleId },
  contact: { phone: '0734856752', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const contactWithoutPhone = {
  _id: new ObjectId(),
  identity: { firstname: 'Cathy', lastname: 'Palenne' },
  local: { email: 'contact_withoutphone@trainer.io' },
  role: { vendor: trainerRoleId },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const coachFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Zoe', lastname: 'Zebu' },
  local: { email: 'coachOtherCompany@alenvi.io', password: '123456!eR' },
  role: { client: coachRoleId },
  contact: { phone: '0734856751', countryCode: '+33' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const userList = [
  traineeFromOtherCompany,
  traineeFromAuthCompanyWithFormationExpoToken,
  traineeWithoutCompany,
  contactWithoutPhone,
  coachFromOtherCompany,
  traineeFromThirdCompany,
  coachFromThirdCompany,
  clientAdminFromThirdCompany,
  traineeFormerlyInAuthCompany,
  traineeComingUpInAuthCompany,
  traineeFromAuthFormerlyInOther,
];

const userCompanies = [
  { // 0 old inactive user company
    _id: new ObjectId(),
    user: traineeFromOtherCompany._id,
    company: thirdCompany._id,
    startDate: '2020-01-01T23:00:00.000Z',
    endDate: '2020-11-30T23:00:00.000Z',
  },
  { // 1
    _id: new ObjectId(),
    user: traineeFromOtherCompany._id,
    company: otherCompany._id,
    startDate: '2021-01-01T10:00:00.000Z',
  },
  { // 2
    _id: new ObjectId(),
    user: traineeFromAuthCompanyWithFormationExpoToken._id,
    company: authCompany._id,
    startDate: '2020-01-01T10:00:00.000Z',
  },
  { // 3
    _id: new ObjectId(),
    user: coachFromOtherCompany._id,
    company: otherCompany._id,
    startDate: '2020-01-01T10:00:00.000Z',
  },
  { // 4
    _id: new ObjectId(),
    user: traineeFromThirdCompany._id,
    company: thirdCompany._id,
    startDate: '2020-01-01T10:00:00.000Z',
  },
  { // 5 formerly in auth company
    _id: new ObjectId(),
    user: traineeFormerlyInAuthCompany._id,
    company: authCompany._id,
    startDate: '2020-01-01T10:00:00.000Z',
    endDate: '2021-03-01T10:00:00.000Z',
  },
  { // 6 currently in other company
    _id: new ObjectId(),
    user: traineeComingUpInAuthCompany._id,
    company: otherCompany._id,
    startDate: '2020-01-01T10:00:00.000Z',
    endDate: CompaniDate().add('P4M29D').toISO(),
  },
  { // 7 coming up in auth company
    _id: new ObjectId(),
    user: traineeComingUpInAuthCompany._id,
    company: authCompany._id,
    startDate: CompaniDate().add('P5M').toISO(),
  },
  { // 8
    _id: new ObjectId(),
    user: traineeFromAuthFormerlyInOther._id,
    company: otherCompany._id,
    startDate: '2020-01-01T10:00:00.000Z',
    endDate: '2020-12-31T10:00:00.000Z',
  },
  { // 9
    _id: new ObjectId(),
    user: traineeFromAuthFormerlyInOther._id,
    company: authCompany._id,
    startDate: '2021-01-01T10:00:00.000Z',
  },
  { // 10 formerly in auth company now in other
    _id: new ObjectId(),
    user: traineeFormerlyInAuthCompany._id,
    company: otherCompany._id,
    startDate: '2022-01-01T10:00:00.000Z',
  },
  { // 11
    _id: new ObjectId(),
    user: coachFromThirdCompany._id,
    company: thirdCompany._id,
    startDate: '2020-01-01T10:00:00.000Z',
  },
  { // 12
    _id: new ObjectId(),
    user: clientAdminFromThirdCompany._id,
    company: thirdCompany._id,
    startDate: '2020-01-01T10:00:00.000Z',
  },
];

const cardsList = [
  { _id: new ObjectId(), template: TITLE_TEXT, title: 'title', text: 'text' },
  { _id: new ObjectId(), template: SURVEY, labels: { 1: 'first', 5: 'last' }, question: 'question ?' },
  { _id: new ObjectId(), template: SURVEY, labels: { 1: 'first', 5: 'last' }, question: 'question ?' },
];

const activitiesList = [
  { _id: new ObjectId(), name: 'great activity', type: VIDEO, cards: [cardsList[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'great activity', type: VIDEO, cards: [cardsList[1]._id], status: PUBLISHED },
];
const activitiesHistory = [
  { _id: new ObjectId(), user: coach._id, activity: activitiesList[0]._id },
  { _id: new ObjectId(), user: clientAdmin._id, activity: activitiesList[0]._id },
  { _id: new ObjectId(), user: helper._id, activity: activitiesList[0]._id },
  { _id: new ObjectId(), user: auxiliary._id, activity: activitiesList[0]._id },
  { _id: new ObjectId(), user: trainerOrganisationManager._id, activity: activitiesList[0]._id },
  {
    _id: new ObjectId(),
    user: coach._id,
    activity: activitiesList[1]._id,
    questionnaireAnswersList: [{ card: cardsList[1]._id, answerList: ['3'] }],
  },
];

const stepList = [
  { _id: new ObjectId(), name: 'etape', type: 'on_site', activities: [], status: PUBLISHED, theoreticalDuration: 60 },
  {
    _id: new ObjectId(),
    name: 'etape',
    type: 'e_learning',
    activities: activitiesList.map(a => a._id),
    theoreticalDuration: 60,
    status: PUBLISHED,
  },
  { _id: new ObjectId(), name: 'etape', type: 'remote', activities: [], status: PUBLISHED, theoreticalDuration: 60 },
];

const subProgramsList = [
  { _id: new ObjectId(), name: 'sous-programme 1', steps: [stepList[0]._id, stepList[1]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'sous-programme 2', steps: [stepList[1]._id, stepList[2]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'sous-programme 3', steps: [stepList[1]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'sous-programme 4 (non publié)', steps: [stepList[1]._id, stepList[2]._id] },
  { _id: SINGLE_COURSES_SUBPROGRAM_IDS[0], name: 'Subprogram 5', steps: [stepList[0]._id], status: PUBLISHED },
];

const programsList = [
  {
    _id: new ObjectId(),
    name: 'program',
    learningGoals: 'on est là',
    image: { link: 'belle/url', publicId: '12345' },
    description: 'Ceci est une description',
    subPrograms: [subProgramsList[0]._id, subProgramsList[4]._id],
  },
  { _id: new ObjectId(), name: 'training program', image: { link: 'belle/url', publicId: '12345' } },
];

const coursesList = [
  { // 0
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'first session',
    trainers: [trainer._id, trainerAndCoach._id],
    trainees: [coach._id, helper._id, clientAdmin._id, vendorAdmin._id],
    companies: [authCompany._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    companyRepresentative: trainerAndCoach._id,
    contact: trainerAndCoach._id,
    expectedBillsCount: 3,
    hasCertifyingTest: true,
    certificateGenerationMode: GLOBAL,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: vendorAdmin._id,
    misc: 'team formation',
    trainers: [trainerAndCoach._id],
    trainees: [traineeFromOtherCompany._id, traineeFromAuthFormerlyInOther._id],
    companies: [otherCompany._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    expectedBillsCount: 2,
    salesRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 2
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: vendorAdmin._id,
    misc: 'second session',
    trainers: [trainer._id, trainerAndCoach._id],
    type: INTRA,
    maxTrainees: 8,
    trainees: [
      coach._id,
      helper._id,
      trainerOrganisationManager._id,
      clientAdmin._id,
      auxiliary._id,
      traineeFromAuthCompanyWithFormationExpoToken._id,
    ],
    companies: [authCompany._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 3
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'second team formation',
    type: INTRA,
    maxTrainees: 1,
    trainees: [traineeFromOtherCompany._id],
    companies: [otherCompany._id],
    operationsRepresentative: vendorAdmin._id,
    trainers: [trainerAndCoach._id],
    certificateGenerationMode: GLOBAL,
  },
  { // 4 course without slots
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'inter b2b session concerning auth company',
    type: INTER_B2B,
    trainees: [traineeFromOtherCompany._id, coach._id],
    companies: [otherCompany._id, authCompany._id],
    format: BLENDED,
    trainers: [trainer._id, trainerAndCoach._id],
    operationsRepresentative: vendorAdmin._id,
    hasCertifyingTest: true,
    certifiedTrainees: [traineeFromOtherCompany._id],
    certificateGenerationMode: GLOBAL,
  },
  { // 5 course with slots
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'inter b2b session NOT concerning auth company',
    type: INTER_B2B,
    format: BLENDED,
    trainees: [noRole._id],
    companies: [thirdCompany._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 6 course without trainees and slots
    _id: new ObjectId(),
    subProgram: subProgramsList[2]._id,
    type: INTER_B2C,
    trainees: [],
    format: STRICTLY_E_LEARNING,
  },
  { // 7 course with slots to plan
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: vendorAdmin._id,
    misc: 'inter b2b session',
    type: INTER_B2B,
    format: BLENDED,
    trainees: [auxiliary._id, traineeFromAuthFormerlyInOther._id],
    companies: [authCompany._id, thirdCompany._id],
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 8 eLearning course with access rules
    _id: new ObjectId(),
    subProgram: subProgramsList[2]._id,
    type: INTER_B2C,
    format: STRICTLY_E_LEARNING,
    trainees: [traineeFromAuthFormerlyInOther._id],
    accessRules: [authCompany._id],
  },
  { // 9 course with access rules and trainee that can't have access to the course but has already suscribed
    _id: new ObjectId(),
    subProgram: subProgramsList[2]._id,
    type: INTER_B2C,
    format: STRICTLY_E_LEARNING,
    trainees: [coach._id],
    accessRules: [authCompany._id],
  },
  { // 10 course with contact
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    trainers: [trainerAndCoach._id],
    misc: 'inter_b2b',
    type: INTER_B2B,
    trainees: [traineeFromOtherCompany._id],
    companies: [otherCompany._id],
    contact: vendorAdmin._id,
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 11 course without authCompany in access rules (11ème position)
    _id: new ObjectId(),
    subProgram: subProgramsList[2]._id,
    type: INTER_B2C,
    format: STRICTLY_E_LEARNING,
    trainees: [traineeFromOtherCompany._id, traineeFromAuthFormerlyInOther._id, noRole._id],
    accessRules: [otherCompany._id, thirdCompany._id],
  },
  { // 12 course with no on-site slot
    _id: new ObjectId(),
    subProgram: subProgramsList[1]._id,
    misc: 'inter_b2b',
    type: INTER_B2B,
    trainees: [],
    companies: [authCompany._id],
    operationsRepresentative: vendorAdmin._id,
    trainers: [trainer._id],
    certificateGenerationMode: GLOBAL,
  },
  { // 13 course without trainee
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: '',
    type: INTER_B2B,
    format: BLENDED,
    trainers: [trainer._id],
    trainees: [],
    companies: [],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 14 archived course
    _id: new ObjectId(),
    subProgram: subProgramsList[4]._id,
    misc: 'old session',
    trainers: [trainer._id],
    trainees: [coach._id, helper._id, clientAdmin._id],
    companies: [authCompany._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    archivedAt: '2021-01-01T00:00:00.000Z',
    estimatedStartDate: '2020-11-03T10:00:00.000Z',
    tutors: [traineeFromAuthFormerlyInOther._id],
    certificateGenerationMode: MONTHLY,
  },
  { // 15 course billed INTRA without trainees and slots
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'intra billed without trainee and slot',
    type: INTRA,
    maxTrainees: 8,
    format: BLENDED,
    operationsRepresentative: vendorAdmin._id,
    trainees: [],
    companies: [authCompany._id],
    expectedBillsCount: 1,
    certificateGenerationMode: GLOBAL,
  },
  { // 16 course without trainee and with slots to plan
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: '',
    type: INTER_B2B,
    format: BLENDED,
    trainers: [trainer._id],
    trainees: [],
    companies: [],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 17 Intra course without slots
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: trainer._id,
    companies: [authCompany._id],
    misc: 'third session',
    trainers: [trainer._id],
    type: INTRA,
    maxTrainees: 8,
    trainees: [
      coach._id,
      helper._id,
      trainerOrganisationManager._id,
      clientAdmin._id,
      auxiliary._id,
      traineeFromAuthCompanyWithFormationExpoToken._id,
    ],
    operationsRepresentative: vendorAdmin._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // 18 archived inter b2b course
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'old session',
    trainers: [trainer._id],
    trainees: [coach._id, helper._id, clientAdmin._id],
    companies: [authCompany._id],
    type: INTER_B2B,
    operationsRepresentative: vendorAdmin._id,
    archivedAt: '2021-01-01T00:00:00.000Z',
    estimatedStartDate: '2020-11-03T10:00:00.000Z',
    certificateGenerationMode: GLOBAL,
  },
  { // 19 course with billed and attended companies
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: vendorAdmin._id,
    misc: 'inter b2b session',
    type: INTER_B2B,
    format: BLENDED,
    trainees: [traineeFromAuthFormerlyInOther._id],
    companies: [authCompany._id, thirdCompany._id, otherCompany._id],
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 20 third company course
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: coachFromThirdCompany._id,
    misc: 'team formation',
    trainers: [trainerAndCoach._id],
    trainees: [traineeFromThirdCompany._id],
    companies: [thirdCompany._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    companyRepresentative: coachFromThirdCompany._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // 21 intra_holding course with companies, without trainees
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: trainer._id,
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
  { // 22 intra_holding course without companies
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: holdingAdminFromOtherCompany._id,
    misc: 'team formation',
    trainers: [trainer._id],
    trainees: [],
    companies: [],
    type: INTRA_HOLDING,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    holding: otherHolding._id,
    companyRepresentative: holdingAdminFromOtherCompany._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 23 intra_holding course with companies and trainees
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    contact: holdingAdminFromOtherCompany._id,
    misc: 'team formation',
    trainers: [trainer._id],
    trainees: [traineeFromThirdCompany._id, traineeFromOtherCompany._id],
    companies: [otherCompany._id, thirdCompany._id],
    type: INTRA_HOLDING,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    holding: otherHolding._id,
    companyRepresentative: holdingAdminFromOtherCompany._id,
    certificateGenerationMode: GLOBAL,
  },
  { // 24 Single course
    _id: new ObjectId(),
    subProgram: subProgramsList[4]._id,
    contact: trainer._id,
    misc: 'single course',
    type: SINGLE,
    format: BLENDED,
    trainees: [traineeFromAuthFormerlyInOther._id],
    companies: [authCompany._id],
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    tutors: [],
    certificateGenerationMode: MONTHLY,
    maxTrainees: 1,
    expectedBillsCount: 0,
  },
  { // 25 Single course with tutor already in course
    _id: new ObjectId(),
    subProgram: subProgramsList[4]._id,
    contact: trainer._id,
    misc: 'single session',
    type: SINGLE,
    format: BLENDED,
    trainees: [traineeFromAuthFormerlyInOther._id],
    companies: [authCompany._id],
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    tutors: [noRole._id],
    certificateGenerationMode: MONTHLY,
    maxTrainees: 1,
    expectedBillsCount: 0,
  },
];

const courseBillsList = [
  {
    _id: new ObjectId(),
    course: coursesList[15]._id,
    mainFee: { price: 1000, count: 1, description: 'Bonjour', countUnit: GROUP },
    companies: [authCompany._id],
    billingPurchaseList: [],
    billedAt: '2022-04-12T09:00:00.000Z',
    number: 'FACT-00001',
    payer: { company: authCompany._id },
  },
  {
    _id: new ObjectId(),
    course: coursesList[0]._id,
    mainFee: { price: 1000, count: 1, description: 'Bonjour', countUnit: GROUP },
    companies: [authCompany._id],
    billingPurchaseList: [],
    billedAt: '2022-04-12T09:00:00.000Z',
    number: 'FACT-00002',
    payer: { company: authCompany._id },
  },
  {
    _id: new ObjectId(),
    course: coursesList[0]._id,
    mainFee: { price: 1300, count: 1, description: 'Bonjour', countUnit: GROUP },
    companies: [authCompany._id],
    billingPurchaseList: [],
    billedAt: '2022-04-16T09:00:00.000Z',
    number: 'FACT-00003',
    payer: { company: authCompany._id },
  },
  {
    _id: new ObjectId(),
    course: coursesList[0]._id,
    mainFee: { price: 1500, count: 1, description: 'Bonjour', countUnit: GROUP },
    companies: [authCompany._id],
    billingPurchaseList: [],
    billedAt: '2022-04-20T09:00:00.000Z',
    number: 'FACT-00004',
    payer: { company: authCompany._id },
  },
  {
    _id: new ObjectId(),
    course: coursesList[0]._id,
    mainFee: { price: 1500, count: 1, description: 'Bonjour', countUnit: GROUP },
    companies: [authCompany._id],
    billingPurchaseList: [],
    billedAt: '2022-04-21T09:00:00.000Z',
    number: 'FACT-00005',
    payer: { company: authCompany._id },
  },
  {
    _id: new ObjectId(),
    course: coursesList[0]._id,
    mainFee: { price: 1600, count: 1, description: 'Bonjour', countUnit: GROUP },
    companies: [authCompany._id],
    billingPurchaseList: [],
    billedAt: '2022-04-23T09:00:00.000Z',
    number: 'FACT-00006',
    payer: { company: authCompany._id },
  },
  {
    _id: new ObjectId(),
    course: coursesList[19]._id,
    mainFee: { price: 1600, count: 1, description: 'Bonjour', countUnit: TRAINEE },
    companies: [authCompany._id],
    billingPurchaseList: [],
    billedAt: '2022-04-20T09:00:00.000Z',
    number: 'FACT-00007',
    payer: { company: authCompany._id },
  },
];

const courseBillNumber = { _id: new ObjectId(), seq: 7 };

const courseCreditNoteList = [
  {
    _id: new ObjectId(),
    number: 'AV-00001',
    courseBill: courseBillsList[1]._id,
    date: '2022-04-15T10:00:00.000Z',
    misc: 'wesh',
    companies: [authCompany._id],
  },
  {
    _id: new ObjectId(),
    number: 'AV-00002',
    courseBill: courseBillsList[4]._id,
    date: '2022-04-21T10:00:00.000Z',
    misc: 'wesh2',
    companies: [authCompany._id],
  },
];

const courseCreditNoteNumber = { _id: new ObjectId(), seq: 2 };

const questionnaire = {
  _id: new ObjectId(),
  name: 'questionnaire',
  status: 'published',
  cards: [cardsList[2]._id],
  type: 'end_of_course',
};
const questionnaireHistory = {
  course: coursesList[0]._id,
  questionnaire: questionnaire._id,
  user: coach._id,
  questionnaireAnswersList: [{ card: cardsList[2]._id, answerList: ['4'] }],
  company: authCompany._id,
};

const courseSmsHistory = {
  date: '2020-01-01T00:00:00.000Z',
  type: 'convocation',
  message: 'Hola ! This is a test',
  course: coursesList[0]._id,
  sender: trainer._id,
  missingPhones: [],
};

const courseHistories = [
  {
    action: SLOT_CREATION,
    course: coursesList[16]._id,
    slot: { startDate: '2020-01-01T00:00:00.000Z', endDate: '2020-01-01T02:00:00.000Z' },
    createdBy: trainerOrganisationManager._id,
  },
  {
    action: SLOT_DELETION,
    course: coursesList[16]._id,
    slot: { startDate: '2020-01-01T00:00:00.000Z', endDate: '2020-01-01T02:00:00.000Z' },
    createdBy: trainerOrganisationManager._id,
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: coach._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: helper._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: clientAdmin._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: vendorAdmin._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[1]._id,
    trainee: traineeFromOtherCompany._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[1]._id,
    trainee: traineeFromAuthFormerlyInOther._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[2]._id,
    trainee: coach._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[2]._id,
    trainee: helper._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[2]._id,
    trainee: trainerOrganisationManager._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[2]._id,
    trainee: clientAdmin._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[2]._id,
    trainee: auxiliary._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[2]._id,
    trainee: traineeFromAuthCompanyWithFormationExpoToken._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[3]._id,
    trainee: traineeFromOtherCompany._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[4]._id,
    trainee: traineeFromOtherCompany._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[4]._id,
    trainee: coach._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',

  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[5]._id,
    trainee: noRole._id,
    company: thirdCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2022-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[7]._id,
    trainee: traineeFromAuthFormerlyInOther._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[7]._id,
    trainee: auxiliary._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[10]._id,
    trainee: traineeFromOtherCompany._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[14]._id,
    trainee: coach._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[14]._id,
    trainee: helper._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[14]._id,
    trainee: clientAdmin._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[17]._id,
    trainee: coach._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[17]._id,
    trainee: helper._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[17]._id,
    trainee: trainerOrganisationManager._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[17]._id,
    trainee: clientAdmin._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[17]._id,
    trainee: auxiliary._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[17]._id,
    trainee: traineeFromAuthCompanyWithFormationExpoToken._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[18]._id,
    trainee: coach._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[18]._id,
    trainee: helper._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[18]._id,
    trainee: clientAdmin._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2023-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[19]._id,
    trainee: traineeFromAuthFormerlyInOther._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-03T14:00:00.000Z',
  },
  {
    action: COMPANY_ADDITION,
    course: coursesList[0]._id,
    company: authCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[20]._id,
    trainee: traineeFromThirdCompany._id,
    company: thirdCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[23]._id,
    trainee: traineeFromOtherCompany._id,
    company: otherCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-03T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[23]._id,
    trainee: traineeFromThirdCompany._id,
    company: thirdCompany._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2020-01-03T14:00:00.000Z',
  },
];

const slots = [
  { // 0
    _id: new ObjectId(),
    startDate: '2020-03-01T08:00:00.000Z',
    endDate: '2020-03-01T10:00:00.000Z',
    course: coursesList[0]._id,
    step: stepList[0]._id,
  },
  { // 1
    _id: new ObjectId(),
    startDate: '2020-03-02T13:00:00.000Z',
    endDate: '2020-03-02T17:00:00.000Z',
    course: coursesList[0]._id,
    step: stepList[0]._id,
  },
  { // 2
    _id: new ObjectId(),
    startDate: '2020-03-03T08:00:00.000Z',
    endDate: '2020-03-03T10:00:00.000Z',
    course: coursesList[1]._id,
    step: stepList[0]._id,
  },
  { // 3
    _id: new ObjectId(),
    startDate: '2020-03-04T08:00:00.000Z',
    endDate: '2020-03-04T10:00:00.000Z',
    course: coursesList[1]._id,
    step: stepList[1]._id,
  },
  { // 4
    _id: new ObjectId(),
    startDate: '2020-03-04T08:00:00.000Z',
    endDate: '2020-03-04T10:00:00.000Z',
    course: coursesList[2]._id,
    step: stepList[0]._id,
  },
  { // 5
    _id: new ObjectId(),
    course: coursesList[2]._id,
    step: stepList[0]._id,
  },
  { // 6
    _id: new ObjectId(),
    course: coursesList[2]._id,
    step: stepList[0]._id,
  },
  { // 7
    _id: new ObjectId(),
    startDate: '2020-03-05T08:00:00.000Z',
    endDate: '2020-03-05T10:00:00.000Z',
    course: coursesList[3]._id,
    step: stepList[0]._id,
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
  { // 8
    _id: new ObjectId(),
    course: coursesList[3]._id,
    step: stepList[0]._id,
  },
  { // 9
    _id: new ObjectId(),
    startDate: '2020-03-06T08:00:00.000Z',
    endDate: '2020-03-06T10:00:00.000Z',
    course: coursesList[5]._id,
    step: stepList[0]._id,
  },
  { // 10
    _id: new ObjectId(),
    course: coursesList[7]._id,
    step: stepList[0]._id,
  },
  { // 11
    _id: new ObjectId(),
    startDate: '2020-03-07T08:00:00.000Z',
    endDate: '2020-03-07T10:00:00.000Z',
    course: coursesList[7]._id,
    step: stepList[0]._id,
  },
  { // 13
    _id: new ObjectId(),
    startDate: '2020-03-10T08:00:00.000Z',
    endDate: '2020-03-10T10:00:00.000Z',
    course: coursesList[13]._id,
    step: stepList[0]._id,
  },
  { // 14
    _id: new ObjectId(),
    course: coursesList[16]._id,
    step: stepList[0]._id,
  },
  { // 15
    _id: new ObjectId(),
    startDate: '2020-03-07T08:00:00.000Z',
    endDate: '2020-03-07T10:00:00.000Z',
    course: coursesList[19]._id,
    step: stepList[0]._id,
  },
  { // 16
    _id: new ObjectId(),
    startDate: '2020-03-07T08:00:00.000Z',
    endDate: '2020-03-07T10:00:00.000Z',
    course: coursesList[21]._id,
    step: stepList[0]._id,
  },
  { // 17
    _id: new ObjectId(),
    startDate: '2020-03-07T08:00:00.000Z',
    endDate: '2020-03-07T10:00:00.000Z',
    course: coursesList[22]._id,
    step: stepList[0]._id,
  },
  { // 18
    _id: new ObjectId(),
    startDate: '2020-03-07T08:00:00.000Z',
    endDate: '2020-03-07T10:00:00.000Z',
    course: coursesList[23]._id,
    step: stepList[0]._id,
  },
];

const attendanceList = [
  {
    _id: new ObjectId(),
    trainee: traineeFromThirdCompany._id,
    courseSlot: slots[14]._id,
    company: thirdCompany._id,
  },
  {
    _id: new ObjectId(),
    trainee: traineeFromAuthCompanyWithFormationExpoToken._id,
    courseSlot: slots[16]._id,
    company: authCompany._id,
  },
  {
    _id: new ObjectId(),
    trainee: auxiliary._id,
    courseSlot: slots[0]._id,
    company: authCompany._id,
  },
];

const attendanceSheetList = [
  {
    _id: new ObjectId(),
    trainee: traineeFromAuthFormerlyInOther._id,
    course: coursesList[12]._id,
    file: { publicId: 'publicId', link: 'https://link.com' },
    companies: [authCompany._id],
    origin: WEBAPP,
    trainer: trainer._id,
  },
];

const fourthCompany = {
  _id: new ObjectId(),
  name: '4th company',
  prefixNumber: 104,
  iban: '1234',
  bic: '5678',
  folderId: '1234567890',
  directDebitsFolderId: '1234567890',
  customersFolderId: 'qwerty',
  auxiliariesFolderId: 'asdfgh',
  subscriptions: { erp: false },
};

const companyHoldingList = [
  { _id: new ObjectId(), holding: authHolding._id, company: fourthCompany._id },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activitiesList),
    ActivityHistory.create(activitiesHistory),
    Attendance.create(attendanceList),
    AttendanceSheet.create(attendanceSheetList),
    Card.create(cardsList),
    Company.create(fourthCompany),
    CompanyHolding.create(companyHoldingList),
    Course.create(coursesList),
    CourseBill.create(courseBillsList),
    CourseBillsNumber.create(courseBillNumber),
    CourseCreditNote.create(courseCreditNoteList),
    CourseCreditNoteNumber.create(courseCreditNoteNumber),
    CourseSlot.create(slots),
    CourseSmsHistory.create(courseSmsHistory),
    CourseHistory.create(courseHistories),
    Program.create(programsList),
    Questionnaire.create(questionnaire),
    QuestionnaireHistory.create(questionnaireHistory),
    Step.create(stepList),
    SubProgram.create(subProgramsList),
    User.create(userList),
    UserCompany.create(userCompanies),
  ]);
};

module.exports = {
  populateDB,
  activitiesList,
  stepList,
  coursesList,
  fourthCompany,
  subProgramsList,
  programsList,
  traineeFromOtherCompany,
  courseSmsHistory,
  traineeFromAuthCompanyWithFormationExpoToken,
  userCompanies,
  coachFromOtherCompany,
  traineeFormerlyInAuthCompany,
  traineeComingUpInAuthCompany,
  traineeFromAuthFormerlyInOther,
  clientAdminFromThirdCompany,
  traineeFromThirdCompany,
};
