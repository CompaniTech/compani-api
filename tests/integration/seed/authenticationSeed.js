const { ObjectID } = require('mongodb');
const memoize = require('lodash/memoize');
const Role = require('../../../src/models/Role');
const Right = require('../../../src/models/Right');
const User = require('../../../src/models/User');
const Company = require('../../../src/models/Company');
const Sector = require('../../../src/models/Sector');
const SectorHistory = require('../../../src/models/SectorHistory');
const Customer = require('../../../src/models/Customer');
const ThirdPartyPayer = require('../../../src/models/ThirdPartyPayer');
const Service = require('../../../src/models/Service');
const { rolesList, rightsList } = require('../../seed/roleSeed');
const { userList } = require('../../seed/userSeed');
const { thirdPartyPayerList } = require('../../seed/thirdPartyPayerSeed');
const { authCompany, companyWithoutSubscription } = require('../../seed/companySeed');
const { serviceList } = require('../../seed/serviceSeed');
const app = require('../../../server');

const otherCompany = {
  _id: new ObjectID(),
  prefixNumber: 102,
  name: 'Other test SAS',
  tradeName: 'Other test',
  folderId: '0987654321',
  directDebitsFolderId: '1234567890',
  customersFolderId: 'mnbvcxz',
  auxiliariesFolderId: 'iuytre',
  subscriptions: { erp: true },
};

const sector = {
  _id: new ObjectID(),
  name: 'Test',
  company: authCompany._id,
};

const sectorHistories = [
  {
    auxiliary: userList[2]._id,
    sector: sector._id,
    company: authCompany._id,
    startDate: '2018-12-10',
  },
  {
    auxiliary: userList[4]._id,
    sector: sector._id,
    company: authCompany._id,
    startDate: '2018-12-10',
  },
];

const populateDBForAuthentication = async () => {
  await Role.deleteMany({});
  await Right.deleteMany({});
  await User.deleteMany({});
  await Company.deleteMany({});
  await Sector.deleteMany({});
  await SectorHistory.deleteMany({});
  await Customer.deleteMany({});
  await ThirdPartyPayer.deleteMany({});
  await Service.deleteMany({});

  await new Company(authCompany).save();
  await new Company(otherCompany).save();
  await new Company(companyWithoutSubscription).save();
  await new Sector(sector).save();
  await SectorHistory.insertMany(sectorHistories);
  await Right.insertMany(rightsList);
  await Role.insertMany(rolesList);
  await ThirdPartyPayer.insertMany(thirdPartyPayerList);
  await Service.insertMany(serviceList);
  for (let i = 0; i < userList.length; i++) {
    await (new User(userList[i])).save();
  }
};

const getUser = (roleName, erp = true, list = userList) => {
  const role = rolesList.find(r => r.name === roleName);
  const company = [authCompany, companyWithoutSubscription].find(c => c.subscriptions.erp === erp);

  return list.find(u => u.role[role.interface] && u.role[role.interface].toHexString() === role._id.toHexString() &&
    company._id.toHexString() === u.company.toHexString());
};

const getTokenByCredentials = memoize(
  async (credentials) => {
    const response = await app.inject({
      method: 'POST',
      url: '/users/authenticate',
      payload: credentials,
    });

    return response.result.data.token;
  },
  // do not stringify the 'credentials' object, because the order of the props can't be predicted
  credentials => JSON.stringify([credentials.email, credentials.password])
);

const getToken = (roleName, erp, list) => {
  const user = getUser(roleName, erp, list);
  return getTokenByCredentials(user.local);
};

module.exports = {
  rolesList,
  rightsList,
  userList,
  populateDBForAuthentication,
  getUser,
  getToken,
  getTokenByCredentials,
  authCompany,
  otherCompany,
};
