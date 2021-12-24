const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Sector = require('../../../src/models/Sector');
const SectorHistory = require('../../../src/models/SectorHistory');
const User = require('../../../src/models/User');
const { authCompany, otherCompany } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/authentication');
const { WEBAPP } = require('../../../src/helpers/constants');
const UserCompany = require('../../../src/models/UserCompany');
const { clientAdminRoleId } = require('../../seed/authRolesSeed');

const sectorsList = [
  { _id: new ObjectId(), name: 'Test', company: authCompany._id },
  { _id: new ObjectId(), name: 'Test', company: otherCompany._id },
  { _id: new ObjectId(), name: 'Test2', company: authCompany._id },
];

const historyList = [
  {
    _id: new ObjectId(),
    auxiliary: new ObjectId(),
    sector: sectorsList[0]._id,
    startDate: '2020-03-20T00:00:00',
    company: otherCompany._id,
  },
  {
    _id: new ObjectId(),
    auxiliary: new ObjectId(),
    sector: sectorsList[0]._id,
    startDate: '2020-03-20T00:00:00',
    company: otherCompany._id,
  },
  {
    _id: new ObjectId(),
    auxiliary: new ObjectId(),
    sector: sectorsList[1]._id,
    startDate: '2020-03-20T00:00:00',
    company: otherCompany._id,
  },
];

const userFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Test7', lastname: 'Test7' },
  local: { email: 'test@othercompany.io', password: '123456!eR' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  contracts: [new ObjectId()],
  origin: WEBAPP,
};

const userCompany = { _id: new ObjectId(), user: userFromOtherCompany._id, company: otherCompany._id };

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Sector.insertMany(sectorsList);
  await SectorHistory.insertMany(historyList);
  await User.create(userFromOtherCompany);
  await UserCompany.create(userCompany);
};

module.exports = { sectorsList, populateDB, userFromOtherCompany };
