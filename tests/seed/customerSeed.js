const { ObjectID } = require('mongodb');
const { authCompany } = require('./companySeed');
const { serviceList } = require('./serviceSeed');
const { thirdPartyPayerList } = require('./thirdPartyPayerSeed');
const { FIXED, ONCE } = require('../../src/helpers/constants');

const subscriptionId = new ObjectID();

const authCustomer = {
  _id: new ObjectID(),
  company: authCompany._id,
  identity: {
    title: 'mr',
    firstname: 'Romain',
    lastname: 'Bardet',
  },
  contact: {
    primaryAddress: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    secondaryAddress: {
      fullAddress: '27 rue des renaudes 75017 Paris',
      zipCode: '75017',
      city: 'Paris',
      street: '27 rue des renaudes',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    phone: '0123456789',
    accessCodes: 'porte c3po',
  },
  followUp: {
    environment: 'ne va pas bien',
    objectives: 'preparer le dejeuner + balade',
    misc: 'code porte: 1234',
  },
  subscriptions: [{
    _id: subscriptionId,
    service: serviceList[0]._id,
    versions: [
      {
        unitTTCRate: 12,
        estimatedWeeklyVolume: 12,
        evenings: 2,
        sundays: 1,
        createdAt: '2020-01-01T23:00:00',
      },
      {
        unitTTCRate: 10,
        estimatedWeeklyVolume: 8,
        evenings: 0,
        sundays: 2,
        createdAt: '2019-06-01T23:00:00',
      },
    ],
  }],
  subscriptionsHistory: [],
  payment: {
    bankAccountOwner: 'David gaudu',
    iban: '',
    bic: '',
    mandates: [
      { rum: 'R012345678903456789' },
    ],
  },
  quotes: [],
  fundings: [
    {
      _id: new ObjectID(),
      nature: FIXED,
      thirdPartyPayer: thirdPartyPayerList[0]._id,
      subscription: subscriptionId,
      frequency: ONCE,
      versions: [{
        folderNumber: 'D123456',
        startDate: new Date('2019-10-01'),
        createdAt: new Date('2019-10-01'),
        endDate: new Date('2020-02-01'),
        effectiveDate: new Date('2019-10-01'),
        amountTTC: 1200,
        customerParticipationRate: 66,
        careDays: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        folderNumber: 'D123456',
        startDate: new Date('2020-02-02'),
        createdAt: new Date('2020-02-02'),
        effectiveDate: new Date('2020-02-02'),
        amountTTC: 1600,
        customerParticipationRate: 66,
        careDays: [0, 1, 2, 3, 4, 5],
      }],
    },
  ],
};

module.exports = { authCustomer };
