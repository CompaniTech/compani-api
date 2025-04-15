const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const {
  clientAdminRoleId,
  coachRoleId,
  auxiliaryWithoutCompanyRoleId,
  auxiliaryRoleId,
  planningReferentRoleId,
  helperRoleId,
  vendorAdminRoleId,
  trainingOrganisationManagerRoleId,
  trainerRoleId,
  holdingAdminRoleId,
} = require('./authRolesSeed');
const {
  authCompany,
  companyWithoutSubscription,
  otherCompany,
  authHolding,
  otherHolding,
} = require('./authCompaniesSeed');
const { WEBAPP, MOBILE } = require('../../src/helpers/constants');

const userList = [
  { // 0
    _id: new ObjectId(),
    identity: { firstname: 'client_admin', lastname: 'Boss' },
    refreshToken: uuidv4(),
    local: { email: 'client-admin@alenvi.io', password: '123456!eR' },
    role: { client: clientAdminRoleId },
    origin: WEBAPP,
  },
  { // 1
    _id: new ObjectId(),
    identity: { firstname: 'Coach', lastname: 'Calif' },
    local: { email: 'coach@alenvi.io', password: '123456!eR' },
    contact: { phone: '0987654321', countryCode: '+33' },
    refreshToken: uuidv4(),
    role: { client: coachRoleId },
    origin: WEBAPP,
  },
  { // 2
    _id: new ObjectId(),
    identity: { firstname: 'Auxiliary', lastname: 'Olait', title: 'mr' },
    local: { email: 'auxiliary@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: auxiliaryRoleId },
    origin: WEBAPP,
    contracts: [new ObjectId()],
    administrative: { driveFolder: { driveId: '0987654321' }, transportInvoice: { transportType: 'private' } },
  },
  { // 3
    _id: new ObjectId(),
    identity: { firstname: 'Auxiliary without company', lastname: 'créole' },
    local: { email: 'auxiliary-without-company@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: auxiliaryWithoutCompanyRoleId },
    origin: WEBAPP,
  },
  { // 4
    _id: new ObjectId(),
    identity: { firstname: 'PlanningReferent', lastname: 'Test', title: 'mrs' },
    local: { email: 'planning-referent@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: planningReferentRoleId },
    origin: WEBAPP,
  },
  { // 5
    _id: new ObjectId(),
    identity: { title: 'mr', firstname: 'Helper', lastname: 'Test' },
    local: { email: 'helper@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: helperRoleId },
    origin: WEBAPP,
  },
  { // 6
    _id: new ObjectId(),
    identity: { firstname: 'vendor_admin', lastname: 'SuperChef' },
    refreshToken: uuidv4(),
    local: { email: 'vendor-admin@alenvi.io', password: '123456!eR' },
    role: { vendor: vendorAdminRoleId },
    origin: WEBAPP,
  },
  { // 7
    _id: new ObjectId(),
    identity: { firstname: 'training_organisation_manager', lastname: 'ROP' },
    refreshToken: uuidv4(),
    local: { email: 'training-organisation-manager@alenvi.io', password: '123456!eR' },
    role: { vendor: trainingOrganisationManagerRoleId },
    origin: WEBAPP,
  },
  { // 8
    _id: new ObjectId(),
    identity: { firstname: 'trainer', lastname: 'trainer' },
    refreshToken: uuidv4(),
    local: { email: 'trainer@alenvi.io', password: '123456!eR' },
    role: { vendor: trainerRoleId },
    origin: WEBAPP,
  },
  { // 9
    _id: new ObjectId(),
    identity: { firstname: 'client_admin_company_without_subscription', lastname: 'Chef' },
    refreshToken: uuidv4(),
    local: { email: 'client-admin-company-without-erp@alenvi.io', password: '123456!eR' },
    role: { client: clientAdminRoleId },
    origin: WEBAPP,
  },
  { // 10
    _id: new ObjectId(),
    identity: { firstname: 'norole', lastname: 'test' },
    refreshToken: uuidv4(),
    local: { email: 'norole@alenvi.io', password: 'fdsf5P56D' },
    contact: { phone: '0798640728', countryCode: '+33' },
    origin: MOBILE,
  },
  { // 11
    _id: new ObjectId(),
    identity: { firstname: 'norole', lastname: 'nocompany' },
    refreshToken: uuidv4(),
    local: { email: 'norole.nocompany@authuserseed.fr', password: 'fdsf5P56D' },
    contact: { phone: '0798640728', countryCode: '+33' },
    picture: { link: 'qwertyuio', pictureId: 'poiuytrew' },
    origin: MOBILE,
    formationExpoTokenList: ['ExponentPushToken[jeSuisUnIdExpo]'],
  },
  { // 12
    _id: new ObjectId(),
    identity: { firstname: 'Simon', lastname: 'TrainerAndCoach' },
    refreshToken: uuidv4(),
    local: { email: 'trainercoach@alenvi.io', password: '123456!eR' },
    role: { client: coachRoleId, vendor: trainerRoleId },
    origin: WEBAPP,
  },
  { // 13
    _id: new ObjectId(),
    identity: { firstname: 'Simon', lastname: 'Holding' },
    refreshToken: uuidv4(),
    local: { email: 'holding@alenvi.io', password: '123456!eR' },
    role: { client: coachRoleId, holding: holdingAdminRoleId },
    origin: WEBAPP,
  },
  { // 14
    _id: new ObjectId(),
    identity: { firstname: 'Chloe', lastname: 'Holding' },
    refreshToken: uuidv4(),
    local: { email: 'holding@other.io', password: '123456!eR' },
    role: { client: coachRoleId, holding: holdingAdminRoleId },
    origin: WEBAPP,
  },
];

const userCompaniesList = [
  // old inactive user companies
  { _id: new ObjectId(), user: userList[0]._id, company: authCompany._id, startDate: '2019-01-01T23:00:00.000Z' },
  { _id: new ObjectId(), user: userList[1]._id, company: authCompany._id, startDate: '2019-01-01T23:00:00.000Z' },
  { _id: new ObjectId(), user: userList[2]._id, company: authCompany._id, startDate: '2019-01-01T23:00:00.000Z' },
  {
    _id: new ObjectId(),
    user: userList[3]._id,
    company: companyWithoutSubscription._id,
    startDate: '2019-01-01T23:00:00.000Z',
    endDate: '2022-11-30T22:59:59.999Z',
  },
  { _id: new ObjectId(), user: userList[4]._id, company: authCompany._id, startDate: '2019-01-01T23:00:00.000Z' },
  { _id: new ObjectId(), user: userList[5]._id, company: authCompany._id, startDate: '2019-01-01T23:00:00.000Z' },
  {
    _id: new ObjectId(),
    user: userList[6]._id,
    company: companyWithoutSubscription._id,
    startDate: '2019-01-01T23:00:00.000Z',
    endDate: '2022-11-30T22:59:59.999Z',
  },
  {
    _id: new ObjectId(),
    user: userList[7]._id,
    company: companyWithoutSubscription._id,
    startDate: '2019-01-01T23:00:00.000Z',
    endDate: '2022-11-30T22:59:59.999Z',
  },
  {
    _id: new ObjectId(),
    user: userList[8]._id,
    company: companyWithoutSubscription._id,
    startDate: '2019-01-01T23:00:00.000Z',
    endDate: '2022-11-30T22:59:59.999Z',
  },
  {
    _id: new ObjectId(),
    user: userList[9]._id,
    company: companyWithoutSubscription._id,
    startDate: '2019-01-01T23:00:00.000Z',
  },
  {
    _id: new ObjectId(),
    user: userList[10]._id,
    company: companyWithoutSubscription._id,
    startDate: '2019-01-01T23:00:00.000Z',
    endDate: '2022-11-30T22:59:59.999Z',
  },
  {
    _id: new ObjectId(),
    user: userList[12]._id,
    company: companyWithoutSubscription._id,
    startDate: '2019-01-01T23:00:00.000Z',
    endDate: '2022-11-30T22:59:59.999Z',
  },
  { user: userList[3]._id, company: authCompany._id, startDate: '2022-11-30T23:00:00.000Z' },
  { user: userList[6]._id, company: authCompany._id, startDate: '2022-11-30T23:00:00.000Z' },
  { user: userList[7]._id, company: authCompany._id, startDate: '2022-11-30T23:00:00.000Z' },
  { user: userList[10]._id, company: authCompany._id, startDate: '2022-12-30T23:00:00.000Z' },
  { user: userList[12]._id, company: authCompany._id, startDate: '2022-11-30T23:00:00.000Z' },
  { user: userList[13]._id, company: authCompany._id, startDate: '2019-11-30T23:00:00.000Z' },
  { user: userList[14]._id, company: otherCompany._id, startDate: '2019-11-30T23:00:00.000Z' },
];

const userHoldingList = [
  { _id: new ObjectId(), user: userList[13]._id, holding: authHolding._id },
  { _id: new ObjectId(), user: userList[14]._id, holding: otherHolding._id },
];

const trainer = userList.find(u => u.local.email === 'trainer@alenvi.io');
const noRoleNoCompany = userList.find(u => u.local.email === 'norole.nocompany@authuserseed.fr');
const noRole = userList.find(u => u.local.email === 'norole@alenvi.io');
const vendorAdmin = userList.find(u => u.local.email === 'vendor-admin@alenvi.io');
const helper = userList.find(u => u.local.email === 'helper@alenvi.io');
const auxiliary = userList.find(u => u.local.email === 'auxiliary@alenvi.io');
const coach = userList.find(u => u.local.email === 'coach@alenvi.io');
const auxiliaryWithoutCompany = userList.find(u => u.local.email === 'auxiliary-without-company@alenvi.io');
const clientAdmin = userList.find(u => u.local.email === 'client-admin@alenvi.io');
const trainerOrganisationManager = userList.find(u => u.local.email === 'training-organisation-manager@alenvi.io');
const trainerAndCoach = userList.find(u => u.local.email === 'trainercoach@alenvi.io');
const holdingAdminFromAuthCompany = userList.find(u => u.local.email === 'holding@alenvi.io');
const holdingAdminFromOtherCompany = userList.find(u => u.local.email === 'holding@other.io');

module.exports = {
  userList,
  userCompaniesList,
  userHoldingList,
  trainer,
  noRoleNoCompany,
  noRole,
  vendorAdmin,
  helper,
  auxiliary,
  coach,
  auxiliaryWithoutCompany,
  clientAdmin,
  trainerOrganisationManager,
  trainerAndCoach,
  holdingAdminFromAuthCompany,
  holdingAdminFromOtherCompany,
};
