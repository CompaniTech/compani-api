const { ObjectID } = require('mongodb');
const { rolesList } = require('./roleSeed');
const { authCompany, companyWithoutSubscription } = require('./companySeed');
const { authCustomer } = require('./customerSeed');
const uuidv4 = require('uuid/v4');
const {
  VENDOR_ADMIN,
  CLIENT_ADMIN,
  AUXILIARY,
  HELPER,
  COACH,
  PLANNING_REFERENT,
  AUXILIARY_WITHOUT_COMPANY,
  TRAINING_ORGANISATION_MANAGER,
  TRAINER,
} = require('../../src/helpers/constants');

const userList = [
  {
    _id: new ObjectID(),
    identity: { firstname: 'client_admin', lastname: 'Chef' },
    refreshToken: uuidv4(),
    local: { email: 'client-admin@alenvi.io', password: '123456!eR' },
    role: { client: rolesList.find(role => role.name === CLIENT_ADMIN)._id },
    company: authCompany._id,
  },
  {
    _id: new ObjectID(),
    identity: { firstname: 'Coach', lastname: 'Calif' },
    local: { email: 'coach@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: rolesList.find(role => role.name === COACH)._id },
    company: authCompany._id,
  },
  {
    _id: new ObjectID(),
    identity: { firstname: 'Auxiliary', lastname: 'Test', title: 'mr' },
    local: { email: 'auxiliary@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: rolesList.find(role => role.name === AUXILIARY)._id },
    company: authCompany._id,
  },
  {
    _id: new ObjectID(),
    identity: { firstname: 'Auxiliary without company', lastname: 'Test' },
    local: { email: 'auxiliary-without-company@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: rolesList.find(role => role.name === AUXILIARY_WITHOUT_COMPANY)._id },
    company: authCompany._id,
  },
  {
    _id: new ObjectID(),
    identity: { firstname: 'PlanningReferent', lastname: 'Test', title: 'mrs' },
    local: { email: 'planning-referent@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: rolesList.find(role => role.name === PLANNING_REFERENT)._id },
    company: authCompany._id,
  },
  {
    _id: new ObjectID(),
    identity: { title: 'mr', firstname: 'Helper', lastname: 'Test' },
    local: { email: 'helper@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: rolesList.find(role => role.name === HELPER)._id },
    company: authCompany._id,
    customers: [authCustomer._id],
  },
  {
    _id: new ObjectID(),
    identity: { firstname: 'vendor_admin', lastname: 'SuperChef' },
    refreshToken: uuidv4(),
    local: { email: 'vendor-admin@alenvi.io', password: '123456!eR' },
    role: { vendor: rolesList.find(role => role.name === VENDOR_ADMIN)._id },
    company: authCompany._id,
  },
  {
    _id: new ObjectID(),
    identity: { firstname: 'training_organisation_manager', lastname: 'ROP' },
    refreshToken: uuidv4(),
    local: { email: 'training-organisation-manager@alenvi.io', password: '123456!eR' },
    role: { vendor: rolesList.find(role => role.name === TRAINING_ORGANISATION_MANAGER)._id },
    company: authCompany._id,
  },
  {
    _id: new ObjectID(),
    identity: { firstname: 'trainer', lastname: 'trainer' },
    refreshToken: uuidv4(),
    local: { email: 'trainer@alenvi.io', password: '123456!eR' },
    role: { vendor: rolesList.find(role => role.name === TRAINER)._id },
  },
  {
    _id: new ObjectID(),
    identity: { firstname: 'client_admin_company_without_subscription', lastname: 'Chef' },
    refreshToken: uuidv4(),
    local: { email: 'client-admin-company-without-erp@alenvi.io', password: '123456!eR' },
    role: { client: rolesList.find(role => role.name === CLIENT_ADMIN)._id },
    company: companyWithoutSubscription._id,
  },
];

const trainer = userList.find(u => u.local.email === 'trainer@alenvi.io');

module.exports = { userList, trainer };
