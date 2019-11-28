const { ObjectID } = require('mongodb');
const moment = require('moment');
const uuidv4 = require('uuid/v4');
const { COMPANY_CONTRACT, CUSTOMER_CONTRACT, HOURLY } = require('../../../src/helpers/constants');
const Customer = require('../../../src/models/Customer');
const Company = require('../../../src/models/Company');
const Service = require('../../../src/models/Service');
const Bill = require('../../../src/models/Bill');
const ThirdPartyPayer = require('../../../src/models/ThirdPartyPayer');
const User = require('../../../src/models/User');
const { populateDBForAuthentication, rolesList, authCompany } = require('./authenticationSeed');

const balanceThirdPartyPayer = {
  _id: new ObjectID(),
  name: 'Toto',
  company: authCompany._id,
};

const company = {
  _id: new ObjectID('5d3eb871dd552f11866eea7b'),
  name: 'Test',
  tradeName: 'To',
  rhConfig: {
    internalHours: [
      { name: 'Formation', default: true, _id: new ObjectID() },
      { name: 'Code', default: false, _id: new ObjectID() },
      { name: 'Gouter', default: false, _id: new ObjectID() },
    ],
    feeAmount: 12,
  },
  iban: 'FR3514508000505917721779B12',
  bic: 'RTYUIKJHBFRG',
  ics: '12345678',
  directDebitsFolderId: '1234567890',
};

const customerServiceList = [
  {
    _id: new ObjectID(),
    type: COMPANY_CONTRACT,
    company: authCompany._id,
    versions: [{
      defaultUnitAmount: 12,
      name: 'Service 1',
      startDate: '2019-01-16 17:58:15.519',
      vat: 12,
    }],
    nature: HOURLY,
  },
  {
    _id: new ObjectID(),
    type: CUSTOMER_CONTRACT,
    company: authCompany._id,
    versions: [{
      defaultUnitAmount: 24,
      name: 'Service 2',
      startDate: '2019-01-18 19:58:15.519',
      vat: 12,
    }],
    nature: HOURLY,
  },
];

const balanceCustomerList = [
  {
    _id: new ObjectID(),
    company: authCompany._id,
    email: 'tito@ty.com',
    identity: {
      title: 'mr',
      firstname: 'Egan',
      lastname: 'Bernal',
    },
    contact: {
      primaryAddress: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
      },
      phone: '0612345678',
    },
    payment: {
      bankAccountOwner: 'Lance Amstrong',
      iban: 'FR3514508000505917721779B12',
      bic: 'BNMDHISOBD',
      mandates: [
        { rum: 'R09876543456765432', _id: new ObjectID(), signedAt: moment().toDate() },
      ],
    },
    subscriptions: [
      {
        _id: new ObjectID(),
        service: customerServiceList[0]._id,
        versions: [{
          unitTTCRate: 12,
          estimatedWeeklyVolume: 12,
          evenings: 2,
          sundays: 1,
          startDate: '2018-01-01T10:00:00.000+01:00',
        }],
      },
      {
        _id: new ObjectID(),
        service: customerServiceList[1]._id,
        versions: [{
          unitTTCRate: 12,
          estimatedWeeklyVolume: 12,
          evenings: 2,
          sundays: 1,
          startDate: moment().subtract(1, 'month').toDate(),
        }],
      },
    ],
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    email: 'fake@test.com',
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
      },
      phone: '0612345678',
    },
    subscriptions: [
      {
        _id: new ObjectID(),
        service: customerServiceList[0]._id,
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
      mandates: [
        { rum: 'R012345678903456789', _id: new ObjectID() },
      ],
    },
  },
];

const authBillService = {
  serviceId: new ObjectID(),
  name: 'Temps de qualité - autonomie',
};

const balanceBillList = [
  {
    _id: new ObjectID(),
    date: '2019-05-25',
    number: 'FACT-1905001',
    company: authCompany._id,
    customer: balanceCustomerList[0]._id,
    netInclTaxes: 101.28,
    subscriptions: [{
      startDate: '2019-05-25',
      endDate: '2019-11-25',
      subscription: balanceCustomerList[0].subscriptions[0]._id,
      vat: 5.5,
      events: [{
        eventId: new ObjectID(),
        startDate: '2019-01-16T10:30:19.543Z',
        endDate: '2019-01-16T12:30:21.653Z',
        auxiliary: new ObjectID(),
      }],
      service: authBillService,
      hours: 4,
      unitExclTaxes: 24,
      unitInclTaxes: 25.32,
      exclTaxes: 96,
      inclTaxes: 101.28,
      discount: 0,
    }],
  },
  {
    _id: new ObjectID(),
    date: '2019-05-29',
    number: 'FACT-1905002',
    company: authCompany._id,
    customer: balanceCustomerList[1]._id,
    client: balanceThirdPartyPayer._id,
    netInclTaxes: 75.96,
    subscriptions: [{
      startDate: '2019-05-29',
      endDate: '2019-11-29',
      subscription: balanceCustomerList[1].subscriptions[0]._id,
      vat: 5.5,
      service: authBillService,
      events: [{
        eventId: new ObjectID(),
        startDate: '2019-01-16T09:30:19.543Z',
        endDate: '2019-01-16T11:30:21.653Z',
        auxiliary: new ObjectID(),
      }],
      hours: 8,
      unitExclTaxes: 9,
      unitInclTaxes: 9.495,
      exclTaxes: 72,
      inclTaxes: 75.96,
      discount: 0,
    }],
  },
];

const balanceUserList = [
  {
    _id: new ObjectID(),
    identity: { firstname: 'HelperForCustomer', lastname: 'Test' },
    local: { email: 'helper_for_customer_balance@alenvi.io', password: '123456' },
    refreshToken: uuidv4(),
    role: rolesList.find(role => role.name === 'helper')._id,
    customers: [balanceCustomerList[0]._id],
    company: authCompany._id,
  },
];

const populateDB = async () => {
  await Service.deleteMany({});
  await Company.deleteMany({});
  await Customer.deleteMany({});
  await ThirdPartyPayer.deleteMany({});
  await Bill.deleteMany({});
  await User.deleteMany({});

  await populateDBForAuthentication();

  await (new Company(company)).save();
  await (new ThirdPartyPayer(balanceThirdPartyPayer)).save();
  await Service.insertMany(customerServiceList);
  await Customer.insertMany(balanceCustomerList);
  await Bill.insertMany(balanceBillList);
  for (const user of balanceUserList) {
    await (new User(user).save());
  }
};

module.exports = {
  populateDB,
  balanceCustomerList,
  balanceBillList,
  balanceThirdPartyPayer,
  balanceUserList,
};
