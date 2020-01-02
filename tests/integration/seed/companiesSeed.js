const { ObjectID } = require('mongodb');
const Company = require('../../../src/models/Company');
const Event = require('../../../src/models/Event');
const { populateDBForAuthentication, authCompany } = require('./authenticationSeed');
const { INTERVENTION, COMPANY_CONTRACT } = require('../../../src/helpers/constants');

const company = {
  _id: new ObjectID('5d3eb871dd552f11866eea7b'),
  name: 'Test',
  tradeName: 'TT',
  rhConfig: {
    feeAmount: 12,
  },
  iban: 'FR3514508000505917721779B12',
  bic: 'RTYUIKJHBFRG',
  ics: '12345678',
  folderId: '0987654321',
  directDebitsFolderId: '1234567890',
  customersConfig: {
    billingPeriod: 'two_weeks',
  },
  customersFolderId: 'mnbvcxz',
  prefixNumber: 103,
};

const event = {
  startDate: '2019-12-11',
  endDate: '2019-12-11',
  auxiliary: new ObjectID(),
  customer: new ObjectID(),
  subscription: new ObjectID(),
  type: INTERVENTION,
  company: authCompany._id,
  status: COMPANY_CONTRACT,
};

const populateDB = async () => {
  await Company.deleteMany({});
  await Event.deleteMany({});

  await populateDBForAuthentication();
  await (new Company(company)).save();
  await (new Event(event)).save();
};

module.exports = { company, populateDB };
