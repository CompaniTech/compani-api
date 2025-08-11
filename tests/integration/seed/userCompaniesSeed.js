const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const Establishment = require('../../../src/models/Establishment');
const UserCompany = require('../../../src/models/UserCompany');
const User = require('../../../src/models/User');
const Company = require('../../../src/models/Company');
const Course = require('../../../src/models/Course');
const CourseHistory = require('../../../src/models/CourseHistory');
const Activity = require('../../../src/models/Activity');
const Card = require('../../../src/models/Card');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const { authCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const {
  WEBAPP,
  TRAINEE_ADDITION,
  INTRA,
  VIDEO,
  TRAINEE_DELETION,
  MOBILE,
  PUBLISHED,
  TITLE_TEXT,
  SURVEY,
  GLOBAL,
} = require('../../../src/helpers/constants');
const { auxiliaryRoleId, coachRoleId, trainingOrganisationManagerRoleId } = require('../../seed/authRolesSeed');
const { vendorAdmin, trainerOrganisationManager, trainer } = require('../../seed/authUsersSeed');

const DETACHMENT_ALLOWED_COMPANY_IDS =
  process.env.DETACHMENT_ALLOWED_COMPANY_IDS.split(';').map(id => new ObjectId(id));

const establishmentList = [
  {
    _id: new ObjectId(),
    name: 'Toto',
    siret: '98765432112456',
    address: {
      street: '24, avenue du test',
      fullAddress: '15, avenue du test 75007 Paris',
      zipCode: '75007',
      city: 'Paris',
      location: { type: 'Point', coordinates: [4.849302, 2.90887] },
    },
    phone: '0523456789',
    workHealthService: 'MT01',
    urssafCode: '117',
    company: authCompany._id,
  },
];

const usersSeedList = [
  { // 0
    _id: new ObjectId(),
    identity: { firstname: 'Apprenant', lastname: 'coucou' },
    local: { email: 'coucou@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    contact: { phone: '0987654321', countryCode: '+33' },
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 1
    _id: new ObjectId(),
    identity: { firstname: 'Coach', lastname: 'EPS' },
    local: { email: 'coach@eps.io', password: '123456!eR' },
    role: { client: coachRoleId },
    refreshToken: uuidv4(),
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    contact: { phone: '0987654321', countryCode: '+33' },
    contracts: [{ _id: new ObjectId() }],
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 2
    _id: new ObjectId(),
    identity: { firstname: 'Auxi', lastname: 'Other comp' },
    local: { email: 'auxi@ocompa.io', password: '123456!eR' },
    role: { client: auxiliaryRoleId },
    refreshToken: uuidv4(),
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    contact: { phone: '0987654321', countryCode: '+33' },
    contracts: [{ _id: new ObjectId() }],
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 3
    _id: new ObjectId(),
    identity: { firstname: 'ROF', lastname: 'Company' },
    local: { email: 'rof@company.io', password: '123456!eR' },
    role: { vendor: trainingOrganisationManagerRoleId },
    refreshToken: uuidv4(),
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    contact: { phone: '0987654321', countryCode: '+33' },
    contracts: [{ _id: new ObjectId() }],
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 4
    _id: new ObjectId(),
    identity: { firstname: 'Apprenant', lastname: 'autre' },
    local: { email: 'autreApp@company.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    contact: { phone: '0987654321', countryCode: '+33' },
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 5
    _id: new ObjectId(),
    identity: { firstname: 'Apprenant', lastname: '3' },
    local: { email: '3app@company.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    contact: { phone: '0987654321', countryCode: '+33' },
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 6
    _id: new ObjectId(),
    identity: { firstname: 'Apprenant', lastname: 'est un auxiliaire' },
    local: { email: 'auxil@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: auxiliaryRoleId },
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    contact: { phone: '0987654321', countryCode: '+33' },
    contracts: [{ _id: new ObjectId() }],
    establishment: establishmentList[0]._id,
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 7
    _id: new ObjectId(),
    identity: { firstname: 'Apprenant', lastname: 'deja detaché' },
    local: { email: 'appSansStruc@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    contact: { phone: '0987654321', countryCode: '+33' },
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 8
    _id: new ObjectId(),
    identity: { firstname: 'Apprenant', lastname: 'inscrit a une formation' },
    local: { email: 'appinscrit@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    contact: { phone: '0987654321', countryCode: '+33' },
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 9
    _id: new ObjectId(),
    identity: { firstname: 'Coach', lastname: 'Autre structure' },
    local: { email: 'coach@autre.io', password: '123456!eR' },
    role: { client: coachRoleId },
    refreshToken: uuidv4(),
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    contact: { phone: '0987654321', countryCode: '+33' },
    contracts: [{ _id: new ObjectId() }],
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 10
    _id: new ObjectId(),
    identity: { firstname: 'Apprenant', lastname: 'Sans structure' },
    local: { email: 'apprenanatsansstructure@autre.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    contact: { phone: '0987654321', countryCode: '+33' },
    origin: MOBILE,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
];

const company = {
  _id: DETACHMENT_ALLOWED_COMPANY_IDS[0],
  name: 'Structure dans laquelle on peut detacher des apprenants',
  iban: 'FR3514508000505917721779B12',
  bic: 'ERTYFRPP',
  folderId: '0987654321',
  directDebitsFolderId: '1234567890',
  customersFolderId: 'mnbvcxz',
  auxiliariesFolderId: 'kjhgf',
  prefixNumber: 104,
};

const userCompanies = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: usersSeedList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-06-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: usersSeedList[0]._id, company: company._id, startDate: '2022-08-14T23:00:00.000Z' },
  { _id: new ObjectId(), user: usersSeedList[1]._id, company: company._id, startDate: '2020-12-14T23:00:00.000Z' },
  { _id: new ObjectId(), user: usersSeedList[2]._id, company: authCompany._id, startDate: '2020-10-14T23:00:00.000Z' },
  { _id: new ObjectId(), user: usersSeedList[3]._id, company: company._id, startDate: '2020-11-19T23:00:00.000Z' },
  { _id: new ObjectId(), user: usersSeedList[4]._id, company: company._id, startDate: '2021-11-19T23:00:00.000Z' },
  { // startDate must be greater than 27/12/2022
    _id: new ObjectId(),
    user: usersSeedList[5]._id,
    company: company._id,
    startDate: '2022-12-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: usersSeedList[6]._id, company: company._id, startDate: '2020-11-19T23:00:00.000Z' },
  {
    _id: new ObjectId(),
    user: usersSeedList[7]._id,
    company: company._id,
    startDate: '2020-11-19T23:00:00.000Z',
    endDate: '2021-11-19T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: usersSeedList[8]._id, company: company._id, startDate: '2020-11-19T23:00:00.000Z' },
  { _id: new ObjectId(), user: usersSeedList[9]._id, company: authCompany._id, startDate: '2020-11-19T23:00:00.000Z' },
];

const cardsList = [
  { _id: new ObjectId(), template: TITLE_TEXT, title: 'title', text: 'text' },
  { _id: new ObjectId(), template: SURVEY, labels: { 1: 'first', 5: 'last' }, question: 'question ?' },
];

const activitiesList = [
  { _id: new ObjectId(), name: 'great activity', type: VIDEO, cards: [cardsList[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'great activity', type: VIDEO, cards: [cardsList[1]._id], status: PUBLISHED },
];
const stepList = [
  { _id: new ObjectId(), name: 'etape', type: 'on_site', activities: [], status: PUBLISHED, theoreticalDuration: 60 },
  {
    _id: new ObjectId(),
    name: 'etape',
    type: 'e_learning',
    activities: activitiesList.map(a => a._id),
    status: PUBLISHED,
    theoreticalDuration: 60,
  },
];

const subProgramsList = [
  { _id: new ObjectId(), name: 'sous-programme 1', steps: [stepList[0]._id, stepList[1]._id], status: PUBLISHED },
];

const coursesList = [
  { // 0
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    misc: 'first session',
    trainers: [trainer._id],
    trainees: [usersSeedList[8]._id],
    companies: [company._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    companyRepresentative: usersSeedList[1]._id,
    contact: trainer._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
];

const courseHistories = [
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: usersSeedList[0]._id,
    company: company._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2022-09-05T10:00:00.000Z',
  },
  {
    action: TRAINEE_DELETION,
    course: coursesList[0]._id,
    trainee: usersSeedList[0]._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2022-09-05T14:00:00.000Z',
  },
  {
    action: TRAINEE_ADDITION,
    course: coursesList[0]._id,
    trainee: usersSeedList[8]._id,
    company: company._id,
    createdBy: trainerOrganisationManager._id,
    createdAt: '2022-09-10T10:00:00.000Z',
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activitiesList),
    Card.create(cardsList),
    Company.create(company),
    Course.create(coursesList),
    CourseHistory.create(courseHistories),
    Establishment.create(establishmentList),
    Step.create(stepList),
    SubProgram.create(subProgramsList),
    User.create(usersSeedList),
    UserCompany.create(userCompanies),
  ]);
};

module.exports = {
  populateDB,
  usersSeedList,
  userCompanies,
};
