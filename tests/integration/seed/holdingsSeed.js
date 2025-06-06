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
    iban: '1234',
    bic: '5678',
    folderId: '1234567890',
    directDebitsFolderId: '1234567890',
    customersFolderId: 'qwerty',
    auxiliariesFolderId: 'asdfgh',
    subscriptions: { erp: false },
  },
  {
    _id: new ObjectId(),
    name: 'Company2',
    prefixNumber: 108,
    iban: '9876',
    bic: '5432',
    folderId: '0987654321',
    directDebitsFolderId: '0987654321',
    customersFolderId: 'poiuyt',
    auxiliariesFolderId: 'qsdfgh',
    subscriptions: { erp: false },
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
