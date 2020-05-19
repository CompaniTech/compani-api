const uuidv4 = require('uuid/v4');
const { ObjectID } = require('mongodb');
const { DAILY, PAID_LEAVE } = require('../../../src/helpers/constants');
const Contract = require('../../../src/models/Contract');
const User = require('../../../src/models/User');
const Customer = require('../../../src/models/Customer');
const Sector = require('../../../src/models/Sector');
const SectorHistory = require('../../../src/models/SectorHistory');
const Event = require('../../../src/models/Event');
const { rolesList, getUser } = require('./authenticationSeed');
const { populateDBForAuthentication, authCompany, otherCompany } = require('./authenticationSeed');

const contractCustomer = {
  _id: new ObjectID(),
  company: authCompany._id,
  identity: { title: 'mr', firstname: 'Romain', lastname: 'Bardet' },
  contact: {
    primaryAddress: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    phone: '0123456789',
  },
  subscriptions: [
    {
      _id: new ObjectID(),
      service: new ObjectID(),
      versions: [{
        unitTTCRate: 12,
        estimatedWeeklyVolume: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    },
  ],
  payment: {
    bankAccountOwner: 'David gaudu',
    iban: '',
    bic: '',
    mandates: [{ rum: 'R012345678903456789' }],
  },
  driveFolder: { driveId: '1234567890' },
};

const userForContractCustomer = {
  _id: new ObjectID(),
  identity: { firstname: 'Helper1', lastname: 'Carolyn' },
  local: { email: 'helperForContractCustomer@alenvi.io', password: '123456!eR' },
  inactivityDate: null,
  refreshToken: uuidv4(),
  company: authCompany._id,
  customers: [contractCustomer._id],
  role: { client: rolesList.find(role => role.name === 'helper')._id },
  passwordToken: { token: uuidv4(), expiresIn: new Date('2020-01-20').getTime() + 3600000 },
};

const otherCompanyContractUser = {
  _id: new ObjectID(),
  identity: { firstname: 'OCCU', lastname: 'OCCU' },
  local: { email: 'other-company-contract-user@alenvi.io', password: '123456!eR' },
  inactivityDate: null,
  employee_id: 12345678,
  refreshToken: uuidv4(),
  role: { client: rolesList[0]._id },
  contracts: [new ObjectID()],
  company: otherCompany._id,
  prefixNumber: 103,
};

const sector = { _id: new ObjectID(), company: authCompany._id };

const contractUsers = [{
  _id: new ObjectID(),
  identity: {
    firstname: 'Test7',
    lastname: 'Test7',
    nationality: 'FR',
    socialSecurityNumber: '2987654334562',
    birthDate: '1999-09-08T00:00:00',
    birthCity: 'Paris',
    birthState: 75,
  },
  establishment: new ObjectID(),
  local: { email: 'test7@alenvi.io', password: '123456!eR' },
  inactivityDate: null,
  employee_id: 12345678,
  refreshToken: uuidv4(),
  role: { client: rolesList.find(role => role.name === 'auxiliary')._id },
  contracts: [new ObjectID()],
  company: authCompany._id,
  sector: sector._id,
  contact: {
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
},
{
  _id: new ObjectID(),
  identity: {
    firstname: 'Test',
    lastname: 'Toto',
    nationality: 'FR',
    socialSecurityNumber: '2987654334562',
    birthDate: '1999-09-08T00:00:00',
    birthCity: 'Paris',
    birthState: 75,
  },
  establishment: new ObjectID(),
  local: { email: 'tototest@alenvi.io', password: '123456!eR' },
  inactivityDate: null,
  employee_id: 12345678,
  refreshToken: uuidv4(),
  role: { client: rolesList.find(role => role.name === 'auxiliary')._id },
  contracts: [new ObjectID()],
  company: authCompany._id,
  sector: sector._id,
  contact: {
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
},
{
  _id: new ObjectID(),
  identity: {
    firstname: 'ok',
    lastname: 'Titi',
    nationality: 'FR',
    socialSecurityNumber: '2987654334562',
    birthDate: '1999-09-08T00:00:00',
    birthCity: 'Paris',
    birthState: 75,
  },
  establishment: new ObjectID(),
  local: { email: 'ok@alenvi.io', password: '123456!eR' },
  inactivityDate: null,
  employee_id: 12345678,
  refreshToken: uuidv4(),
  role: { client: rolesList.find(role => role.name === 'auxiliary')._id },
  contracts: [],
  company: authCompany._id,
  sector: sector._id,
  contact: {
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
},
{
  _id: new ObjectID(),
  identity: { firstname: 'contract', lastname: 'Titi' },
  local: { email: 'contract@alenvi.io', password: '123456!eR' },
  inactivityDate: null,
  employee_id: 12345678,
  refreshToken: uuidv4(),
  role: { client: rolesList.find(role => role.name === 'auxiliary')._id },
  contracts: [new ObjectID()],
  company: authCompany._id,
  sector: sector._id,
}];

const sectorHistories = [
  {
    auxiliary: contractUsers[0]._id,
    sector: sector._id,
    company: authCompany._id,
  },
  {
    auxiliary: contractUsers[1]._id,
    sector: sector._id,
    company: authCompany._id,
  },
  {
    auxiliary: contractUsers[2]._id,
    sector: sector._id,
    company: authCompany._id,
    startDate: '2016-12-01',
    endDate: '2016-12-20',
  },
  {
    auxiliary: contractUsers[3]._id,
    sector: sector._id,
    company: authCompany._id,
    startDate: '2018-08-03',
    endDate: '2018-09-02',
  },
  {
    auxiliary: contractUsers[2]._id,
    sector: sector._id,
    company: authCompany._id,
    startDate: '2017-01-01',
    endDate: '2017-11-30',
  },
  {
    auxiliary: contractUsers[3]._id,
    sector: sector._id,
    company: authCompany._id,
    startDate: '2018-09-03',
  },
];

const otherCompanyContract = {
  createdAt: '2018-12-04T16:34:04.144Z',
  endDate: null,
  user: otherCompanyContractUser._id,
  startDate: '2018-12-03T23:00:00.000Z',
  status: 'contract_with_company',
  _id: otherCompanyContractUser.contracts[0],
  company: otherCompany._id,
  versions: [
    {
      createdAt: '2018-12-04T16:34:04.144Z',
      endDate: null,
      grossHourlyRate: 10.28,
      startDate: '2018-12-03T23:00:00.000Z',
      weeklyHours: 9,
      _id: new ObjectID(),
    },
  ],
};

const userFromOtherCompany = {
  _id: new ObjectID(),
  identity: { firstname: 'Test7', lastname: 'Test7' },
  local: { email: 'test@othercompany.io', password: '123456!eR' },
  inactivityDate: null,
  employee_id: 123456789,
  refreshToken: uuidv4(),
  role: { client: rolesList[0]._id },
  contracts: [new ObjectID()],
  company: otherCompany._id,
};

const customerFromOtherCompany = {
  _id: new ObjectID(),
  company: otherCompanyContract._id,
  identity: { firstname: 'customer', lastname: 'toto' },
  contact: {
    primaryAddress: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    phone: '0612345678',
  },
};

const contractsList = [
  {
    createdAt: '2018-12-04T16:34:04.144Z',
    user: contractUsers[0]._id,
    startDate: '2018-12-03T23:00:00.000Z',
    status: 'contract_with_company',
    _id: contractUsers[0].contracts[0],
    company: authCompany._id,
    versions: [
      {
        createdAt: '2018-12-04T16:34:04.144Z',
        grossHourlyRate: 10.28,
        startDate: '2018-12-03T23:00:00.000Z',
        weeklyHours: 9,
        _id: new ObjectID(),
      },
    ],
  },
  {
    createdAt: '2018-12-04T16:34:04.144Z',
    user: contractUsers[1]._id,
    startDate: '2018-12-03T23:00:00.000Z',
    endDate: '2019-02-03T23:00:00.000Z',
    status: 'contract_with_customer',
    _id: new ObjectID(),
    company: authCompany._id,
    customer: contractCustomer._id,
    versions: [
      {
        createdAt: '2018-12-04T16:34:04.144Z',
        grossHourlyRate: 10.28,
        startDate: '2018-12-03T23:00:00.000Z',
        weeklyHours: 9,
        _id: new ObjectID(),
      },
    ],
  },
  {
    createdAt: '2018-12-04T16:34:04.144Z',
    user: contractUsers[1]._id,
    startDate: '2018-12-03T23:00:00.000Z',
    status: 'contract_with_customer',
    _id: new ObjectID(),
    company: authCompany._id,
    customer: customerFromOtherCompany._id,
    versions: [
      {
        createdAt: '2018-12-04T16:34:04.144Z',
        grossHourlyRate: 10.28,
        startDate: '2018-12-03T23:00:00.000Z',
        weeklyHours: 9,
        _id: new ObjectID(),
      },
    ],
  },
  {
    createdAt: '2018-08-02T17:12:55.144Z',
    endDate: null,
    company: authCompany._id,
    user: getUser('auxiliary')._id,
    startDate: '2018-08-02T17:12:55.144Z',
    status: 'contract_with_company',
    _id: new ObjectID(),
    versions: [
      {
        createdAt: '2018-08-02T17:12:55.144Z',
        endDate: null,
        grossHourlyRate: 10.12,
        startDate: '2018-08-02T17:12:55.144Z',
        weeklyHours: 15,
        _id: new ObjectID(),
      },
    ],
  },
  {
    createdAt: '2018-08-02T17:12:55.144Z',
    user: getUser('auxiliary')._id,
    startDate: '2018-08-02T17:12:55.144Z',
    endDate: '2018-09-02T17:12:55.144Z',
    status: 'contract_with_company',
    _id: new ObjectID(),
    company: authCompany._id,
    versions: [
      {
        createdAt: '2018-08-02T17:12:55.144Z',
        endDate: '2018-09-02T17:12:55.144Z',
        grossHourlyRate: 10.12,
        startDate: '2018-08-02T17:12:55.144Z',
        weeklyHours: 15,
        _id: new ObjectID(),
      },
    ],
  },
  {
    createdAt: '2017-08-02T17:12:55.144Z',
    user: contractUsers[2]._id,
    startDate: '2017-08-02T17:12:55.144Z',
    endDate: '2017-09-02T17:12:55.144Z',
    status: 'contract_with_company',
    _id: new ObjectID(),
    company: authCompany._id,
    versions: [
      {
        createdAt: '2017-08-02T17:12:55.144Z',
        endDate: '2017-09-02T17:12:55.144Z',
        grossHourlyRate: 10.12,
        startDate: '2017-08-02T17:12:55.144Z',
        weeklyHours: 15,
        _id: new ObjectID(),
      },
    ],
  },
  {
    createdAt: '2018-08-02T17:12:55.144Z',
    user: contractUsers[3]._id,
    startDate: '2018-08-02T17:12:55.144Z',
    status: 'contract_with_company',
    _id: new ObjectID(),
    company: authCompany._id,
    versions: [
      {
        createdAt: '2018-08-02T17:12:55.144Z',
        grossHourlyRate: 10.12,
        startDate: '2018-08-02T17:12:55.144Z',
        weeklyHours: 15,
        _id: new ObjectID(),
      },
    ],
  },
  {
    createdAt: '2018-08-02T17:12:55.144Z',
    user: getUser('auxiliary_without_company')._id,
    startDate: '2018-08-02T17:12:55.144Z',
    status: 'contract_with_company',
    _id: new ObjectID(),
    company: authCompany._id,
    versions: [
      {
        createdAt: '2018-08-02T17:12:55.144Z',
        grossHourlyRate: 10.12,
        startDate: '2018-08-02T17:12:55.144Z',
        weeklyHours: 15,
        _id: new ObjectID(),
      },
    ],
  },
];

const contractEvents = [
  {
    _id: new ObjectID(),
    company: authCompany._id,
    sector: new ObjectID(),
    type: 'internalHour',
    startDate: '2019-08-08T14:00:18.653Z',
    endDate: '2019-08-08T16:00:18.653Z',
    auxiliary: contractUsers[0]._id,
    customer: contractCustomer._id,
    createdAt: '2019-01-05T15:24:18.653Z',
    internalHour: { _id: new ObjectID(), name: 'Formation' },
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    sector: new ObjectID(),
    type: 'absence',
    absence: PAID_LEAVE,
    absenceNature: DAILY,
    startDate: '2019-01-19T14:00:18.653Z',
    endDate: '2019-01-19T17:00:18.653Z',
    auxiliary: contractUsers[0]._id,
    createdAt: '2019-01-11T08:38:18.653Z',
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    sector: new ObjectID(),
    type: 'absence',
    absence: PAID_LEAVE,
    absenceNature: DAILY,
    startDate: '2019-07-06T14:00:18.653Z',
    endDate: '2019-07-10T17:00:18.653Z',
    auxiliary: contractUsers[0]._id,
    createdAt: '2019-01-11T08:38:18.653Z',
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    sector: new ObjectID(),
    type: 'intervention',
    status: 'contract_with_company',
    startDate: '2019-01-16T09:30:19.543Z',
    endDate: '2019-01-16T11:30:21.653Z',
    auxiliary: contractUsers[0]._id,
    customer: contractCustomer._id,
    createdAt: '2019-01-15T11:33:14.343Z',
    subscription: contractCustomer.subscriptions[0]._id,
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    sector: new ObjectID(),
    type: 'intervention',
    status: 'contract_with_company',
    startDate: '2019-01-17T14:30:19.543Z',
    endDate: '2019-01-17T16:30:19.543Z',
    auxiliary: contractUsers[0]._id,
    customer: contractCustomer._id,
    createdAt: '2019-01-16T14:30:19.543Z',
    subscription: contractCustomer.subscriptions[0]._id,
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
];

const populateDB = async () => {
  await Contract.deleteMany({});
  await User.deleteMany({});
  await Customer.deleteMany({});
  await Event.deleteMany({});
  await Sector.deleteMany({});
  await SectorHistory.deleteMany({});

  await populateDBForAuthentication();
  await User.insertMany([...contractUsers, otherCompanyContractUser, userFromOtherCompany]);
  await (new User(userForContractCustomer)).save();
  await new Sector(sector).save();
  await new Customer(contractCustomer).save();
  await new Customer(customerFromOtherCompany).save();
  await Contract.insertMany([...contractsList, otherCompanyContract]);
  await Event.insertMany(contractEvents);
  await SectorHistory.insertMany(sectorHistories);
};

module.exports = {
  contractsList,
  populateDB,
  contractUsers,
  contractCustomer,
  contractEvents,
  otherCompanyContract,
  customerFromOtherCompany,
  otherCompanyContractUser,
  userFromOtherCompany,
  userForContractCustomer,
};
