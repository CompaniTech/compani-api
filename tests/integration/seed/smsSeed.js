const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { WEBAPP } = require('../../../src/helpers/constants');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const { otherCompany, authCompany } = require('../../seed/authCompaniesSeed');
const { clientAdminRoleId } = require('../../seed/authRolesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/authentication');

const smsUser = {
  _id: new ObjectId(),
  identity: { firstname: 'sms', lastname: 'Test' },
  local: { email: 'email_user@alenvi.io', password: '123456!eR' },
  contact: { phone: '0987654321' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  origin: WEBAPP,
};

const smsUserFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'texto', lastname: 'Test' },
  local: { email: 'email_user_other_company@alenvi.io', password: '123456!eR' },
  contact: { phone: '0253647382' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  origin: WEBAPP,
};

const userCompanies = [
  { _id: new ObjectId(), user: smsUser._id, company: authCompany._id },
  { _id: new ObjectId(), user: smsUserFromOtherCompany._id, company: otherCompany._id },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await User.create(smsUser, smsUserFromOtherCompany);
  await UserCompany.insertMany(userCompanies);
};

module.exports = { populateDB, smsUser, smsUserFromOtherCompany };
