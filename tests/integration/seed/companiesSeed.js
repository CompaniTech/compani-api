const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Company = require('../../../src/models/Company');
const Event = require('../../../src/models/Event');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const CompanyHolding = require('../../../src/models/CompanyHolding');
const VendorCompany = require('../../../src/models/VendorCompany');
const { authCompany, companyWithoutSubscription, otherCompany, otherHolding } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { clientAdminRoleId } = require('../../seed/authRolesSeed');
const { INTERVENTION, MOBILE, WEBAPP } = require('../../../src/helpers/constants');

const vendorCompany = {
  name: 'Compani',
  siret: '12345678901234',
  iban: 'FR9210096000302523177152Q14',
  bic: 'BPCEFRPP',
  ics: 'FR1234567894D',
  activityDeclarationNumber: '13736343575',
  address: {
    fullAddress: '32 Rue du Loup 33000 Bordeaux',
    street: '32 Rue du Loup',
    city: 'Bordeaux',
    zipCode: '33000',
    location: { type: 'Point', coordinates: [-0.573054, 44.837914] },
  },
  shareCapital: 123000,
  debitMandateTemplate: { driveId: '123456789', link: 'unlienversledoc' },
};

const companies = [
  {
    _id: new ObjectId(),
    name: 'Test',
    prefixNumber: 104,
    folderId: '0987654321',
    directDebitsFolderId: '1234567890',
    customersFolderId: 'mnbvcxz',
    auxiliariesFolderId: 'kjhgf',
    debitMandates: [
      { _id: new ObjectId(), rum: 'R-10425060000188CF46476EE0F6F9B702', createdAt: '2025-06-03T14:00:00.000Z' },
      {
        _id: new ObjectId(),
        rum: 'R-10425060000288CF46476EE0F6F9B702',
        createdAt: '2025-06-13T14:00:00.000Z',
        file: { driveId: '12345674578', link: 'https://unlien' },
      },

    ],
  },
  {
    _id: new ObjectId(),
    name: 'Test 2',
    prefixNumber: 105,
    folderId: '0987654321',
    directDebitsFolderId: '1234567890',
    customersFolderId: 'mnbvcxz',
    auxiliariesFolderId: 'kjhgf',
    debitMandates: [
      { _id: new ObjectId(), rum: 'R-1052507000011E5B79EB6E993416B4EA', createdAt: '2025-07-03T14:00:00.000Z' },
    ],
  },
];

const event = {
  startDate: '2019-12-11',
  endDate: '2019-12-11',
  auxiliary: new ObjectId(),
  customer: new ObjectId(),
  subscription: new ObjectId(),
  type: INTERVENTION,
  company: authCompany._id,
  address: {
    fullAddress: '37 rue de ponthieu 75008 Paris',
    zipCode: '75008',
    city: 'Paris',
    street: '37 rue de Ponthieu',
    location: { type: 'Point', coordinates: [2.377133, 48.801389] },
  },
};

const usersList = [
  {
    _id: new ObjectId(),
    identity: { firstname: 'client_admin', lastname: 'Chef' },
    refreshToken: uuidv4(),
    local: { email: 'client_admin@alenvi.io', password: '123456!eR' },
    role: { client: clientAdminRoleId },
    origin: MOBILE,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Futur', lastname: 'Chargé de factu' },
    local: { email: 'sfjgp@tt.com', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: clientAdminRoleId },
    origin: WEBAPP,
  },
];

const userCompanies = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: usersList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: usersList[0]._id, company: companies[0]._id },
  { _id: new ObjectId(), user: usersList[1]._id, company: otherCompany._id },
];

const companyHoldings = [
  {
    _id: new ObjectId(),
    holding: otherHolding._id,
    company: companies[0]._id,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Company.create(companies),
    Event.create(event),
    CompanyHolding.create(companyHoldings),
    User.create(usersList),
    UserCompany.create(userCompanies),
    VendorCompany.create(vendorCompany),
  ]);
};

module.exports = { companies, usersList, populateDB };
