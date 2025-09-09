const { ObjectId } = require('mongodb');
const Company = require('../../../src/models/Company');
const Holding = require('../../../src/models/Holding');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const holdings = [
  { _id: new ObjectId(), name: 'Test', address: '37 rue de ponthieu 75008 Paris' },
];

const companies = [
  {
    _id: new ObjectId(),
    name: 'Company',
    prefixNumber: 107,
    iban: 'FR3514508000505917721779B12',
    bic: 'RTYUFRPP',
    folderId: '1234567890',
    directDebitsFolderId: '1234567890',
    customersFolderId: 'qwerty',
    auxiliariesFolderId: 'asdfgh',
    subscriptions: { erp: false },
    debitMandates: [
      { _id: new ObjectId(), rum: 'R-10725060000188CF46476EE0F6F9B702', createdAt: '2025-06-03T14:00:00.000Z' },
    ],
  },
  {
    _id: new ObjectId(),
    name: 'Company2',
    prefixNumber: 108,
    iban: 'FR1814508000404462679354N69',
    bic: 'ERTYFRPP',
    folderId: '0987654321',
    directDebitsFolderId: '0987654321',
    customersFolderId: 'poiuyt',
    auxiliariesFolderId: 'qsdfgh',
    subscriptions: { erp: false },
    debitMandates: [
      { _id: new ObjectId(), rum: 'R-10825060000188CF46476EE0F6F9B712', createdAt: '2025-06-03T16:00:00.000Z' },
    ],
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Company.create(companies),
    Holding.create(holdings),
  ]);
};

module.exports = { populateDB, holdings, companies };
