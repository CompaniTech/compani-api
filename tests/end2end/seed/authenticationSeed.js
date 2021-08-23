const Company = require('../../../src/models/Company');
const Role = require('../../../src/models/Role');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const { authCompany } = require('../../seed/companySeed');
const { rolesList } = require('../../seed/roleSeed');
const { userList, userCompaniesList } = require('../../seed/userSeed');

const populateAuthentication = async () => {
  await Company.deleteMany();
  await Role.deleteMany();
  await User.deleteMany();
  await UserCompany.deleteMany();

  await Company.create(authCompany);
  await Role.insertMany(rolesList);
  await User.create(userList);
  await UserCompany.insertMany(userCompaniesList);
};

module.exports = { populateAuthentication };
