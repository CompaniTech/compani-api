const { ObjectID } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { WEBAPP } = require('../../../src/helpers/constants');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const { otherCompany, authCompany } = require('../../seed/authCompaniesSeed');
const { clientAdminRoleId } = require('../../seed/authRolesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/authentication');

const smsUser = {
  _id: new ObjectID(),
  identity: { firstname: 'sms', lastname: 'Test' },
  local: { email: 'email_user@alenvi.io' },
  contact: { phone: '0987654321' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  origin: WEBAPP,
};

const smsUserWithSameNumberAndNoCompany = {
  _id: new ObjectID(),
  identity: { firstname: 'mms', lastname: 'Test' },
  local: { email: 'email_user_with_same_number@alenvi.io' },
  contact: { phone: '0987654321' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  origin: WEBAPP,
};

const smsUserFromOtherCompany = {
  _id: new ObjectID(),
  identity: { firstname: 'texto', lastname: 'Test' },
  local: { email: 'email_user_other_company@alenvi.io' },
  contact: { phone: '0253647382' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  origin: WEBAPP,
};

const userCompanies = [
  { _id: new ObjectID(), user: smsUser._id, company: authCompany._id },
  { _id: new ObjectID(), user: smsUserFromOtherCompany._id, company: otherCompany._id },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    User.create(smsUser, smsUserFromOtherCompany, smsUserWithSameNumberAndNoCompany),
    UserCompany.insertMany(userCompanies),
  ]);
};

module.exports = { populateDB, smsUser, smsUserFromOtherCompany };
