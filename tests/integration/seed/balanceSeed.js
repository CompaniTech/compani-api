const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const moment = require('../../../src/extensions/moment');
const { HOURLY, WEBAPP } = require('../../../src/helpers/constants');
const Customer = require('../../../src/models/Customer');
const Service = require('../../../src/models/Service');
const Bill = require('../../../src/models/Bill');
const Helper = require('../../../src/models/Helper');
const ThirdPartyPayer = require('../../../src/models/ThirdPartyPayer');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const { helperRoleId } = require('../../seed/authRolesSeed');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const balanceThirdPartyPayer = {
  _id: new ObjectId(),
  name: 'Toto',
  company: authCompany._id,
  isApa: true,
  billingMode: 'direct',
};

const customerServiceList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    versions: [{
      defaultUnitAmount: 12,
      name: 'Service 1',
      startDate: '2019-01-16 17:58:15.519',
      vat: 12,
      exemptFromCharges: false,
    }],
    nature: HOURLY,
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    versions: [{
      defaultUnitAmount: 24,
      name: 'Service 2',
      startDate: '2019-01-18 19:58:15.519',
      vat: 12,
      exemptFromCharges: false,
    }],
    nature: HOURLY,
  },
];

const balanceCustomerList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    identity: { title: 'mr', firstname: 'Egan', lastname: 'Bernal' },
    contact: {
      primaryAddress: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
      phone: '0612345678',
      countryCode: '+33',
    },
    payment: {
      bankAccountOwner: 'Lance Amstrong',
      iban: 'FR3514508000505917721779B12',
      bic: 'BNMDHISOBD',
      mandates: [{ rum: 'R09876543456765432', _id: new ObjectId(), signedAt: '2020-01-23T00:00:00' }],
    },
    subscriptions: [{
      _id: new ObjectId(),
      service: customerServiceList[0]._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    }, {
      _id: new ObjectId(),
      service: customerServiceList[1]._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: moment().subtract(1, 'month').toDate(),
      }],
    }],
  },
  {
    _id: new ObjectId(),
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
      phone: '0612345678',
      countryCode: '+33',
    },
    subscriptions: [{
      _id: new ObjectId(),
      service: customerServiceList[0]._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    }],
    payment: {
      bankAccountOwner: 'David gaudu',
      iban: '',
      bic: '',
      mandates: [{ rum: 'R012345678903456789', _id: new ObjectId(), signedAt: '2020-01-23T00:00:00' }],
    },
  },
];

const authBillService = { serviceId: new ObjectId(), name: 'Temps de qualité - autonomie', nature: 'hourly' };

const balanceBillList = [
  {
    _id: new ObjectId(),
    type: 'automatic',
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
        eventId: new ObjectId(),
        startDate: '2019-01-16T10:30:19.543Z',
        endDate: '2019-01-16T12:30:21.653Z',
        auxiliary: new ObjectId(),
        inclTaxesCustomer: 12,
        exclTaxesCustomer: 10,
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
    _id: new ObjectId(),
    type: 'automatic',
    date: '2019-05-29',
    number: 'FACT-1905002',
    company: authCompany._id,
    customer: balanceCustomerList[1]._id,
    thirdPartyPayer: balanceThirdPartyPayer._id,
    netInclTaxes: 75.96,
    subscriptions: [{
      startDate: '2019-05-29',
      endDate: '2019-11-29',
      subscription: balanceCustomerList[1].subscriptions[0]._id,
      vat: 5.5,
      service: authBillService,
      events: [{
        eventId: new ObjectId(),
        startDate: '2019-01-16T09:30:19.543Z',
        endDate: '2019-01-16T11:30:21.653Z',
        auxiliary: new ObjectId(),
        inclTaxesCustomer: 12,
        exclTaxesCustomer: 10,
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

const balanceUserList = [{
  _id: new ObjectId(),
  identity: { firstname: 'HelperForCustomer', lastname: 'Test' },
  local: { email: 'helper_for_customer_balance@alenvi.io', password: '123456!eR' },
  refreshToken: uuidv4(),
  role: { client: helperRoleId },
  origin: WEBAPP,
}];

const balanceUserCompanies = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: balanceUserList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: balanceUserList[0]._id, company: authCompany._id },
];

const helpersList = [{
  customer: balanceCustomerList[0]._id,
  user: balanceUserList[0]._id,
  company: authCompany._id,
  referent: true,
}];

const customerFromOtherCompany = {
  _id: new ObjectId(),
  company: otherCompany._id,
  identity: { title: 'mr', firstname: 'test', lastname: 'toto' },
  contact: {
    primaryAddress: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    phone: '0612345678',
    countryCode: '+33',
  },
};

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Bill.create(balanceBillList),
    Customer.create(balanceCustomerList.concat(customerFromOtherCompany)),
    Helper.create(helpersList),
    Service.create(customerServiceList),
    ThirdPartyPayer.create(balanceThirdPartyPayer),
    User.create(balanceUserList),
    UserCompany.create(balanceUserCompanies),
  ]);
};

module.exports = {
  populateDB,
  balanceCustomerList,
  balanceUserList,
  customerFromOtherCompany,
};
