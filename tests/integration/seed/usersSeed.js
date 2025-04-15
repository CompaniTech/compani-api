const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const Card = require('../../../src/models/Card');
const User = require('../../../src/models/User');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const Activity = require('../../../src/models/Activity');
const UserCompany = require('../../../src/models/UserCompany');
const IdentityVerification = require('../../../src/models/IdentityVerification');
const Contract = require('../../../src/models/Contract');
const Establishment = require('../../../src/models/Establishment');
const { otherCompany, authCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { vendorAdmin } = require('../../seed/authUsersSeed');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const Course = require('../../../src/models/Course');
const CompanyLinkRequest = require('../../../src/models/CompanyLinkRequest');
const {
  WEBAPP,
  MOBILE,
  VIDEO,
  INTER_B2B,
  INTRA,
  INTER_B2C,
  BLENDED,
  STRICTLY_E_LEARNING,
  PUBLISHED,
  E_LEARNING,
  ON_SITE,
  GLOBAL,
} = require('../../../src/helpers/constants');
const {
  helperRoleId,
  coachRoleId,
  auxiliaryRoleId,
  planningReferentRoleId,
  auxiliaryWithoutCompanyRoleId,
  clientAdminRoleId,
  vendorAdminRoleId,
  trainerRoleId,
} = require('../../seed/authRolesSeed');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');

const establishmentList = [
  {
    _id: new ObjectId(),
    name: 'Toto',
    siret: '12345678901234',
    address: {
      street: '15, rue du test',
      fullAddress: '15, rue du test 75007 Paris',
      zipCode: '75007',
      city: 'Paris',
      location: { type: 'Point', coordinates: [4.849302, 2.90887] },
    },
    phone: '0123456789',
    workHealthService: 'MT01',
    urssafCode: '117',
    company: authCompany._id,
  },
  {
    _id: new ObjectId(),
    name: 'Tata',
    siret: '09876543210987',
    address: {
      street: '37, rue des acacias',
      fullAddress: '37, rue des acacias 69000 Lyon',
      zipCode: '69000',
      city: 'Lyon',
      location: { type: 'Point', coordinates: [4.824302, 3.50807] },
    },
    phone: '0446899034',
    workHealthService: 'MT01',
    urssafCode: '217',
    company: otherCompany._id,
  },
];

const helperFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Guigui', lastname: 'toto' },
  local: { email: 'othercompany@alenvi.io' },
  role: { client: helperRoleId },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const coachFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Arnaud', lastname: 'toto' },
  local: { email: 'othercompanycoach@alenvi.io' },
  role: { client: coachRoleId },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const auxiliaryFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Philou', lastname: 'toto' },
  local: { email: 'othercompanyauxiliary@alenvi.io' },
  role: { client: auxiliaryRoleId },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const traineeWhoLeftCompanyWithoutSubscription = {
  _id: new ObjectId(),
  identity: { firstname: 'trainee_changed_company', lastname: 'test' },
  local: { email: 'trainee_changed_company@alenvi.io' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const usersFromOtherCompany = [
  helperFromOtherCompany,
  coachFromOtherCompany,
  auxiliaryFromOtherCompany,
];

const usersFromDifferentCompanyList = [...usersFromOtherCompany, traineeWhoLeftCompanyWithoutSubscription];

const contractId = new ObjectId();
const contractNotStartedId = new ObjectId();
const endedContractId = new ObjectId();

const usersSeedList = [
  { // 0
    _id: new ObjectId(),
    identity: { firstname: 'Auxiliary', lastname: 'Black' },
    local: { email: 'black@alenvi.io', password: '123456!eR' },
    role: { client: auxiliaryRoleId },
    refreshToken: uuidv4(),
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    contact: { phone: '0987654321', countryCode: '+33' },
    contracts: [contractId],
    establishment: establishmentList[0]._id,
    picture: { publicId: 'a/public/id', link: 'https://the.complete.com/link/to/the/picture/storage/location' },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 1
    _id: new ObjectId(),
    identity: { firstname: 'Auxiliary', lastname: 'White' },
    local: { email: 'white@alenvi.io' },
    role: { client: auxiliaryRoleId },
    refreshToken: uuidv4(),
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    origin: WEBAPP,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnAutreIdExpo]'],
  },
  { // 2
    _id: new ObjectId(),
    identity: { firstname: 'Coach3', lastname: 'Kitty' },
    local: { email: 'kitty@alenvi.io' },
    refreshToken: uuidv4(),
    role: { client: coachRoleId },
    inactivityDate: '2018-11-01T12:52:27.461Z',
    origin: WEBAPP,
  },
  { // 3
    _id: new ObjectId(),
    identity: { firstname: 'Helper1', lastname: 'Carolyn' },
    local: { email: 'carolyn@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: helperRoleId },
    contracts: [new ObjectId()],
    passwordToken: { token: uuidv4(), expiresIn: new Date('2020-01-20').getTime() + 3600000 },
    origin: WEBAPP,
    loginCode: '1234',
  },
  { // 4
    _id: new ObjectId(),
    identity: { firstname: 'Auxiliary2', lastname: 'Yellow' },
    local: { email: 'aux@alenvi.io' },
    role: { client: planningReferentRoleId },
    refreshToken: uuidv4(),
    contracts: [endedContractId, contractNotStartedId],
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    origin: WEBAPP,
  },
  { // 5
    _id: new ObjectId(),
    identity: { firstname: 'AuxiliaryWithoutCompany', lastname: 'Green' },
    local: { email: 'withouCompany@alenvi.io' },
    role: { client: auxiliaryWithoutCompanyRoleId },
    refreshToken: uuidv4(),
    administrative: { certificates: [{ driveId: '1234567890' }], driveFolder: { driveId: '0987654321' } },
    origin: WEBAPP,
  },
  { // 6
    _id: new ObjectId(),
    identity: { firstname: 'adminion', lastname: 'Mitty' },
    local: { email: 'cae@alenvi.io' },
    refreshToken: uuidv4(),
    role: { client: clientAdminRoleId },
    origin: WEBAPP,
  },
  { // 7
    _id: new ObjectId(),
    identity: { firstname: 'no_role_trainee', lastname: 'test' },
    local: { email: 'no_role_trainee@alenvi.io' },
    refreshToken: uuidv4(),
    origin: WEBAPP,
  },
  { // 8
    _id: new ObjectId(),
    identity: { firstname: 'trainee_to_auxiliary', lastname: 'etst' },
    local: { email: 'trainee_to_auxiliary@alenvi.io' },
    refreshToken: uuidv4(),
    origin: WEBAPP,
  },
  { // 9
    _id: new ObjectId(),
    identity: { firstname: 'user_without_company', lastname: 'test' },
    local: { email: 'user_without_company@alenvi.io' },
    refreshToken: uuidv4(),
    origin: WEBAPP,
  },
  { // 10
    _id: new ObjectId(),
    identity: { firstname: 'vendor', lastname: 'test' },
    local: { email: 'vendor@alenvi.io' },
    role: { vendor: vendorAdminRoleId },
    refreshToken: uuidv4(),
    origin: WEBAPP,
  },
  { // 11
    _id: new ObjectId(),
    identity: { firstname: 'trainer', lastname: 'no_company' },
    local: { email: 'traisner_no_company@compani.io' },
    role: { vendor: trainerRoleId },
    refreshToken: uuidv4(),
    origin: WEBAPP,
  },
  { // 12
    _id: new ObjectId(),
    identity: { firstname: 'norole', lastname: 'no_company' },
    refreshToken: uuidv4(),
    local: { email: 'norole.nocompany@userseed.fr', password: 'fdsf5P56D' },
    contact: { phone: '0798640728', countryCode: '+33' },
    picture: { link: 'qwertyuio', pictureId: 'poiuytrew' },
    origin: MOBILE,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 13
    _id: new ObjectId(),
    identity: { firstname: 'future_traine', lastname: 'test' },
    local: { email: 'future_trainee@alenvi.io' },
    refreshToken: uuidv4(),
    origin: WEBAPP,
  },
  { // 14 trainee twice in same company and detach from both
    _id: new ObjectId(),
    identity: { firstname: 'twice in same', lastname: 'company' },
    local: { email: 'twice@alenvi.io' },
    refreshToken: uuidv4(),
    origin: WEBAPP,
  },
];

const companyLinkRequest = {
  _id: new ObjectId(),
  user: usersSeedList[12]._id,
  company: authCompany._id,
};

const userCompanies = [
  {
    user: auxiliaryFromOtherCompany._id,
    company: authCompany._id,
    startDate: '2021-01-01T23:00:00.000Z',
    endDate: '2021-12-31T23:00:00.000Z',
  },
  { user: auxiliaryFromOtherCompany._id, company: otherCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: helperFromOtherCompany._id, company: otherCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: coachFromOtherCompany._id, company: otherCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  {
    user: usersSeedList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2021-01-01T23:00:00.000Z',
    endDate: '2021-12-31T23:00:00.000Z',
  },
  { user: usersSeedList[0]._id, company: authCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: usersSeedList[1]._id, company: authCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: usersSeedList[2]._id, company: authCompany._id, startDate: '2019-01-01T08:00:00.000Z' },
  { user: usersSeedList[3]._id, company: authCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: usersSeedList[4]._id, company: authCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: usersSeedList[5]._id, company: authCompany._id, startDate: '2019-01-01T08:00:00.000Z' },
  { user: usersSeedList[6]._id, company: authCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: usersSeedList[7]._id, company: authCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: usersSeedList[8]._id, company: authCompany._id, startDate: '2022-01-01T23:00:00.000Z' },
  { user: usersSeedList[10]._id, company: authCompany._id, startDate: '2022-12-30T23:00:00.000Z' },
  {
    user: traineeWhoLeftCompanyWithoutSubscription._id,
    company: companyWithoutSubscription._id,
    startDate: '2019-01-01T08:00:00.000Z',
    endDate: '2022-12-01T02:59:59.999Z',
  },
  { // trainee will join company in the future
    user: usersSeedList[13]._id,
    company: authCompany._id,
    startDate: CompaniDate().add('P1D').toISO(),
  },
  { // trainee twice in same company and detach from both
    user: usersSeedList[14]._id,
    company: companyWithoutSubscription,
    startDate: '2019-01-01T08:00:00.000Z',
    endDate: '2022-12-01T22:59:59.999Z',
  },
  { // trainee twice in same company and detach from both
    user: usersSeedList[14]._id,
    company: companyWithoutSubscription,
    startDate: '2022-12-02T08:00:00.000Z',
    endDate: '2022-12-31T22:59:59.999Z',
  },
];

const contracts = [
  {
    _id: contractId,
    serialNumber: 'sadfasdgvxcsda',
    user: usersSeedList[0]._id,
    startDate: '2022-10-10T10:00:00.000Z',
    createdAt: '2022-10-09T10:00:00.000Z',
    company: authCompany._id,
  },
  {
    _id: contractNotStartedId,
    serialNumber: 'sdadsfsdfsd',
    user: usersSeedList[4]._id,
    startDate: CompaniDate().add('P1M').toISO(),
    createdAt: CompaniDate().add('P29D').toISO(),
    company: authCompany._id,
  },
  {
    _id: endedContractId,
    serialNumber: 'testserialnumber',
    user: usersSeedList[4]._id,
    startDate: '2022-01-02T00:00:00.000Z',
    createdAt: '2022-01-01T23:59:59.000Z',
    company: authCompany._id,
  },
];

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

const stepList = [
  { _id: new ObjectId(), name: 'etape', type: ON_SITE, status: PUBLISHED, theoreticalDuration: 60 },
  {
    _id: new ObjectId(),
    name: 'etape',
    type: E_LEARNING,
    activities: [activityList[0]._id],
    status: PUBLISHED,
    theoreticalDuration: 60,
  },
];
const subProgramsList = [
  { _id: new ObjectId(), name: 'subProgram 1', steps: [stepList[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'subProgram 2', steps: [stepList[1]._id], status: PUBLISHED },
];

const coursesList = [
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    type: INTER_B2B,
    format: BLENDED,
    trainees: [helperFromOtherCompany._id, usersSeedList[0]._id],
    companies: [otherCompany._id, authCompany._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[0]._id,
    type: INTRA,
    format: BLENDED,
    maxTrainees: 8,
    trainees: [usersSeedList[0]._id],
    companies: [authCompany._id],
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
  {
    _id: new ObjectId(),
    subProgram: subProgramsList[1]._id,
    type: INTER_B2C,
    format: STRICTLY_E_LEARNING,
    trainees: [usersSeedList[12]._id],
  },
];

const activityHistoryList = [
  { _id: new ObjectId(), activity: activityList[0]._id, user: usersSeedList[12]._id, date: '2021-01-25T10:05:32.582Z' },
];

const identityVerifications = [
  {
    _id: new ObjectId(),
    email: usersSeedList[3].local.email,
    code: '3310',
    createdAt: new Date('2021-01-25T10:05:32.582Z'),
  },
];

const isInList = (list, user) => list.some(i => i._id.toHexString() === user._id.toHexString());

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activityList),
    ActivityHistory.create(activityHistoryList),
    Card.create(cardsList),
    Contract.create(contracts),
    Course.create(coursesList),
    Establishment.create(establishmentList),
    IdentityVerification.create(identityVerifications),
    Step.create(stepList),
    SubProgram.create(subProgramsList),
    User.create([...usersSeedList, ...usersFromDifferentCompanyList]),
    UserCompany.create(userCompanies),
    CompanyLinkRequest.create(companyLinkRequest),
  ]);
};

module.exports = {
  usersSeedList,
  usersFromDifferentCompanyList,
  populateDB,
  isInList,
  helperFromOtherCompany,
  traineeWhoLeftCompanyWithoutSubscription,
  establishmentList,
  coachFromOtherCompany,
  auxiliaryFromOtherCompany,
  activityList,
};
