const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Repetition = require('../../../src/models/Repetition');
const User = require('../../../src/models/User');
const Event = require('../../../src/models/Event');
const Sector = require('../../../src/models/Sector');
const SectorHistory = require('../../../src/models/SectorHistory');
const Customer = require('../../../src/models/Customer');
const { WEBAPP } = require('../../../src/helpers/constants');
const UserCompany = require('../../../src/models/UserCompany');
const { authCompany } = require('../../seed/authCompaniesSeed');
const { auxiliaryRoleId } = require('../../seed/authRolesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/authentication');

const auxiliariesIdList = [new ObjectId(), new ObjectId()];
const customersIdList = [new ObjectId()];

const sector = { _id: new ObjectId(), company: authCompany._id, name: 'Super equipe' };

const sectorHistory = {
  _id: new ObjectId(),
  company: authCompany._id,
  auxiliary: auxiliariesIdList[0],
  startDate: '2021-11-11T10:30:00.000Z',
  sector: sector._id,
};

const customer = {
  _id: customersIdList[0],
  identity: { title: 'mr', firstname: 'test', lastname: 'Couciy' },
  company: authCompany._id,
  contact: {
    primaryAddress: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
  subscriptions: [{
    _id: new ObjectId(),
    service: new ObjectId(),
    versions: [
      { unitTTCRate: 10, weeklyHours: 8, evenings: 0, sundays: 2, createdAt: '2019-06-01T23:00:00' },
    ],
  }],
};

const auxiliaryList = [
  {
    _id: auxiliariesIdList[0],
    identity: { firstname: 'Toto', lastname: 'Zero' },
    local: { email: 'toto@p.com', password: '123456!eR' },
    administrative: { driveFolder: { driveId: '123456890' }, transportInvoice: { transportType: 'public' } },
    refreshToken: uuidv4(),
    role: { client: auxiliaryRoleId },
    contracts: [new ObjectId()],
    origin: WEBAPP,
  },
  {
    _id: auxiliariesIdList[1],
    identity: { firstname: 'TomTom', lastname: 'Nana' },
    local: { email: 'tom@p.com', password: '123456!eR' },
    administrative: { driveFolder: { driveId: '12345690' }, transportInvoice: { transportType: 'public' } },
    refreshToken: uuidv4(),
    role: { client: auxiliaryRoleId },
    contracts: [new ObjectId()],
    origin: WEBAPP,
  },
];

const repetitionList = [
  {
    _id: new ObjectId(),
    type: 'intervention',
    startDate: '2021-11-11T10:30:00.000Z',
    endDate: '2021-11-11T12:30:00.000Z',
    auxiliary: auxiliariesIdList[0],
    customer: customersIdList[0],
    frequency: 'every_day',
    company: authCompany._id,
    address: {
      street: '37 rue de Ponthieu',
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    parentId: new ObjectId(),
    subscription: customer.subscriptions[0]._id,
  },
  {
    _id: new ObjectId(),
    type: 'internal_hour',
    startDate: '2021-11-10T10:30:00.000Z',
    endDate: '2021-11-10T12:30:00.000Z',
    auxiliary: auxiliariesIdList[0],
    frequency: 'every_week',
    company: authCompany._id,
    parentId: new ObjectId(),
  },
];

const eventList = [
  {
    repetition: { frequency: 'every_day' },
    startDate: '2021-11-11T10:30:00.000Z',
    endDate: '2021-11-11T12:30:00.000Z',
    company: authCompany._id,
    auxiliary: auxiliariesIdList[0],
    customer: customersIdList[0],
    type: 'intervention',
    address: {
      street: '37 rue de Ponthieu',
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    subscription: customer.subscriptions[0]._id,
  },
  {
    repetition: { parentId: repetitionList[0].parentId, frequency: 'every_week' },
    startDate: '2022-07-28T10:30:00.000Z',
    endDate: '2022-07-28T12:30:00.000Z',
    company: authCompany._id,
    auxiliary: auxiliariesIdList[0],
    customer: customersIdList[0],
    type: 'intervention',
    address: {
      street: '37 rue de Ponthieu',
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    subscription: customer.subscriptions[0]._id,
  },
];

const userCompanies = [
  { _id: new ObjectId(), user: auxiliariesIdList[0], company: authCompany._id },
  { _id: new ObjectId(), user: auxiliariesIdList[1], company: authCompany._id },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Repetition.create(repetitionList),
    User.create(auxiliaryList),
    UserCompany.create(userCompanies),
    Event.create(eventList),
    Customer.create(customer),
    Sector.create(sector),
    SectorHistory.create(sectorHistory),
  ]);
};

module.exports = {
  repetitionList,
  eventList,
  auxiliariesIdList,
  customersIdList,
  customer,
  authCompany,
  populateDB,
};
