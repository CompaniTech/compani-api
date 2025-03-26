const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const {
  HOURLY,
  DAILY,
  PAID_LEAVE,
  INTERNAL_HOUR,
  ABSENCE,
  INTERVENTION,
  WEBAPP,
} = require('../../../src/helpers/constants');
const Bill = require('../../../src/models/Bill');
const BillingItem = require('../../../src/models/BillingItem');
const Service = require('../../../src/models/Service');
const Customer = require('../../../src/models/Customer');
const ThirdPartyPayer = require('../../../src/models/ThirdPartyPayer');
const BillNumber = require('../../../src/models/BillNumber');
const Event = require('../../../src/models/Event');
const User = require('../../../src/models/User');
const CreditNote = require('../../../src/models/CreditNote');
const Contract = require('../../../src/models/Contract');
const FundingHistory = require('../../../src/models/FundingHistory');
const Helper = require('../../../src/models/Helper');
const UserCompany = require('../../../src/models/UserCompany');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { helperRoleId, auxiliaryRoleId } = require('../../seed/authRolesSeed');

const billThirdPartyPayer = {
  _id: new ObjectId(),
  name: 'Toto',
  company: authCompany._id,
  isApa: true,
  billingMode: 'direct',
};

const otherCompanyBillThirdPartyPayer = {
  _id: new ObjectId(),
  name: 'Titi',
  company: otherCompany._id,
  billingMode: 'direct',
};

const billingItemList = [
  {
    _id: new ObjectId(),
    name: 'Billing Joel',
    type: 'manual',
    defaultUnitAmount: 12,
    vat: 15,
    company: authCompany._id,
  },
  {
    _id: new ObjectId(),
    name: 'Boule et Billing',
    type: 'per_intervention',
    defaultUnitAmount: 12,
    vat: 15,
    company: authCompany._id,
  },
  {
    _id: new ObjectId(),
    name: 'Billingbo Le Hobbit',
    type: 'per_intervention',
    defaultUnitAmount: 12,
    vat: 15,
    company: otherCompany._id,
  },
];

const billServices = [{
  _id: new ObjectId(),
  company: authCompany._id,
  versions: [{
    defaultUnitAmount: 12,
    name: 'Service 1',
    startDate: '2019-01-16T17:58:15.519',
    vat: 12,
    exemptFromCharges: false,
    billingItems: [billingItemList[0]._id],
  }],
  nature: HOURLY,
}, {
  _id: new ObjectId(),
  company: otherCompany._id,
  versions: [{
    defaultUnitAmount: 12,
    name: 'Service 2',
    startDate: '2019-01-16T17:58:15.519',
    vat: 12,
    exemptFromCharges: false,
  }],
  nature: HOURLY,
}];

const billCustomerList = [
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
      mandates: [{ rum: 'R09876543456765432', _id: new ObjectId(), signedAt: moment().toDate() }],
    },
    subscriptions: [{
      _id: new ObjectId(),
      service: billServices[0]._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    }, {
      _id: new ObjectId(),
      service: billServices[1]._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    }],
  },
  { // 1
    _id: new ObjectId(),
    company: authCompany._id,
    identity: { title: 'mr', firstname: 'Pere', lastname: 'Noel' },
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
      service: billServices[0]._id,
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
      mandates: [{ rum: 'R012345678903456789', _id: new ObjectId() }],
    },
  },
  { // 2
    _id: new ObjectId(),
    company: otherCompany._id,
    identity: { title: 'mr', firstname: 'Roberto', lastname: 'Alagna' },
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
      service: billServices[1]._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    }],
    payment: {
      bankAccountOwner: 'Roberto Alagna',
      mandates: [{ rum: 'R014345658903456780', _id: new ObjectId() }],
    },
  },
  { // 3 - archived
    _id: new ObjectId(),
    company: authCompany._id,
    identity: { title: 'mr', firstname: 'Benard', lastname: 'Chived' },
    stopReason: 'hospitalization',
    stoppedAt: '2021-10-10T21:59:59',
    archivedAt: '2021-11-07T11:58:14',
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
      service: billServices[1]._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    }],
    payment: {
      bankAccountOwner: 'Benard Chived',
      mandates: [{ rum: 'R014345658903456780', _id: new ObjectId() }],
    },
  },
];

const billUserList = [
  {
    _id: new ObjectId(),
    identity: { firstname: 'HelperForCustomer', lastname: 'Test' },
    local: { email: 'helper_for_customer_bill@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: helperRoleId },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Youpi', lastname: 'Toto' },
    local: { email: 'toto@alenvi.io' },
    refreshToken: uuidv4(),
    role: { client: auxiliaryRoleId },
    contracts: [new ObjectId()],
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Bravo', lastname: 'Toto' },
    local: { email: 'tutu@alenvi.io' },
    refreshToken: uuidv4(),
    role: { client: auxiliaryRoleId },
    contracts: [new ObjectId()],
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Tata', lastname: 'Toto' },
    local: { email: 'toto2@alenvi.io' },
    refreshToken: uuidv4(),
    role: { client: auxiliaryRoleId },
    contracts: [new ObjectId()],
    origin: WEBAPP,
  },
];

const userCompanies = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: billUserList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: billUserList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), user: billUserList[1]._id, company: authCompany._id },
  { _id: new ObjectId(), user: billUserList[2]._id, company: otherCompany._id },
  { _id: new ObjectId(), user: billUserList[3]._id, company: authCompany._id },
];

const contracts = [
  {
    createdAt: '2018-12-04T16:34:04.144Z',
    user: billUserList[1]._id,
    serialNumber: 'poijhgfghjsd',
    startDate: '2018-12-03T23:00:00.000Z',
    _id: billUserList[1].contracts[0],
    company: authCompany._id,
    versions: [
      {
        createdAt: '2018-12-04T16:34:04.144Z',
        grossHourlyRate: 10.28,
        startDate: '2018-12-03T23:00:00.000Z',
        weeklyHours: 9,
        _id: new ObjectId(),
      },
    ],
  },
  {
    createdAt: '2018-12-04T16:34:04.144Z',
    serialNumber: 'knbgyujnbvgfhj',
    user: billUserList[2]._id,
    startDate: '2018-12-03T23:00:00.000Z',
    _id: billUserList[2].contracts[0],
    company: otherCompany._id,
    versions: [
      {
        createdAt: '2018-12-04T16:34:04.144Z',
        grossHourlyRate: 10.28,
        startDate: '2018-12-03T23:00:00.000Z',
        weeklyHours: 9,
        _id: new ObjectId(),
      },
    ],
  },
  {
    createdAt: '2018-12-04T16:34:04.144Z',
    serialNumber: 'knalkdsflkdsjlk',
    user: billUserList[2]._id,
    startDate: '2018-12-03T23:00:00.000Z',
    endDate: '2018-12-03T22:59:59.000Z',
    endNotificationDate: '2018-12-03T22:59:59.000Z',
    endReason: 'mutation',
    _id: billUserList[3].contracts[0],
    company: otherCompany._id,
    versions: [
      {
        createdAt: '2018-12-04T16:34:04.144Z',
        grossHourlyRate: 10.28,
        startDate: '2018-12-03T23:00:00.000Z',
        weeklyHours: 9,
        _id: new ObjectId(),
      },
    ],
  },
];

const authBillList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    type: 'automatic',
    number: 'FACT-1807001',
    date: '2019-05-29',
    customer: billCustomerList[0]._id,
    thirdPartyPayer: billThirdPartyPayer._id,
    netInclTaxes: 75.96,
    subscriptions: [{
      startDate: '2019-05-29',
      endDate: '2019-11-29',
      subscription: billCustomerList[0].subscriptions[0]._id,
      service: { serviceId: new ObjectId(), name: 'Temps de qualité - autonomie', nature: 'fixed' },
      vat: 5.5,
      events: [{
        eventId: new ObjectId(),
        startDate: '2019-01-16T09:30:19.543Z',
        endDate: '2019-01-16T11:30:21.653Z',
        auxiliary: billUserList[1]._id,
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
  {
    _id: new ObjectId(),
    company: authCompany._id,
    type: 'automatic',
    number: 'FACT-1807002',
    date: '2019-05-25',
    customer: billCustomerList[1]._id,
    netInclTaxes: 101.28,
    subscriptions: [{
      startDate: '2019-05-25',
      endDate: '2019-11-25',
      subscription: billCustomerList[1].subscriptions[0]._id,
      vat: 5.5,
      events: [{
        eventId: new ObjectId(),
        startDate: '2019-01-16T10:30:19.543Z',
        endDate: '2019-01-16T12:30:21.653Z',
        auxiliary: billUserList[1]._id,
        inclTaxesCustomer: 12,
        exclTaxesCustomer: 10,
      }],
      service: { serviceId: new ObjectId(), name: 'Temps de qualité - autonomie', nature: 'fixed' },
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
    company: authCompany._id,
    type: 'manual',
    number: 'FACT-1901002',
    date: '2019-06-01',
    customer: billCustomerList[1]._id,
    netInclTaxes: 100,
    billingItemList: [{
      billingItem: billingItemList[0],
      unitInclTaxes: 1000,
      name: 'article de factu',
      count: 2,
      inclTaxes: 2000,
      exclTaxes: 200,
      vat: 5,
    }],
  },
];

const billList = [
  {
    _id: new ObjectId(),
    company: otherCompany._id,
    type: 'automatic',
    number: 'FACT-1901001',
    date: '2019-05-29',
    customer: billCustomerList[2]._id,
    netInclTaxes: 75.96,
    subscriptions: [{
      startDate: '2019-05-29',
      endDate: '2019-11-29',
      subscription: billCustomerList[2].subscriptions[0]._id,
      service: { serviceId: new ObjectId(), name: 'Temps de qualité - autonomie', nature: 'fixed' },
      vat: 5.5,
      events: [{
        eventId: new ObjectId(),
        startDate: '2019-01-16T09:30:19.543Z',
        endDate: '2019-01-16T11:30:21.653Z',
        auxiliary: billUserList[2]._id,
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
  {
    _id: new ObjectId(),
    company: otherCompany._id,
    type: 'manual',
    number: 'FACT-1901003',
    date: '2019-06-01',
    customer: billCustomerList[2]._id,
    netInclTaxes: 100,
    billingItemList: [{
      billingItem: billingItemList[0],
      unitInclTaxes: 645,
      name: 'arctic',
      count: 2,
      inclTaxes: 4,
      exclTaxes: 2,
      vat: 2,
    }],
  },
];

const billNumbers = [
  { _id: new ObjectId(), seq: 2, prefix: '0519', company: authCompany._id },
  { _id: new ObjectId(), seq: 2, prefix: '0919', company: authCompany._id },
];

const eventList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector: new ObjectId(),
    type: INTERNAL_HOUR,
    startDate: '2019-01-17T10:30:18.653Z',
    endDate: '2019-01-17T12:00:18.653Z',
    auxiliary: billUserList[1]._id,
    customer: billCustomerList[0]._id,
    createdAt: '2019-01-05T15:24:18.653Z',
    internalHour: { _id: new ObjectId(), name: 'Formation' },
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector: new ObjectId(),
    type: ABSENCE,
    absence: PAID_LEAVE,
    absenceNature: DAILY,
    startDate: '2019-01-19T14:00:18.653Z',
    endDate: '2019-01-19T17:00:18.653Z',
    auxiliary: billUserList[1]._id,
    createdAt: '2019-01-11T08:38:18.653Z',
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector: new ObjectId(),
    type: INTERVENTION,
    startDate: '2019-01-16T09:30:19.543Z',
    endDate: '2019-01-16T11:30:21.653Z',
    auxiliary: billUserList[1]._id,
    customer: billCustomerList[0]._id,
    createdAt: '2019-01-15T11:33:14.343Z',
    subscription: billCustomerList[0].subscriptions[0]._id,
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector: new ObjectId(),
    type: INTERVENTION,
    startDate: '2019-01-17T14:30:19.543Z',
    endDate: '2019-01-17T16:30:19.543Z',
    auxiliary: billUserList[1]._id,
    customer: billCustomerList[0]._id,
    createdAt: '2019-01-16T14:30:19.543Z',
    subscription: billCustomerList[0].subscriptions[0]._id,
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector: new ObjectId(),
    type: INTERVENTION,
    startDate: '2019-01-18T14:30:19.543Z',
    endDate: '2019-01-18T16:30:19.543Z',
    auxiliary: billUserList[2]._id,
    customer: billCustomerList[0]._id,
    createdAt: '2019-01-16T14:30:19.543Z',
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    subscription: billCustomerList[0].subscriptions[0]._id,
  },
  {
    _id: new ObjectId(),
    company: otherCompany._id,
    sector: new ObjectId(),
    type: INTERVENTION,
    startDate: '2019-01-18T14:30:19.543Z',
    endDate: '2019-01-18T16:30:19.543Z',
    auxiliary: billUserList[2]._id,
    customer: billCustomerList[2]._id,
    createdAt: '2019-01-16T14:30:19.543Z',
    subscription: billCustomerList[2].subscriptions[0]._id,
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
  { // event not billed because auxilairy does not have an active contract
    _id: new ObjectId(),
    company: authCompany._id,
    sector: new ObjectId(),
    type: INTERVENTION,
    startDate: '2019-01-16T09:30:19.543Z',
    endDate: '2019-01-16T11:30:21.653Z',
    auxiliary: billUserList[3]._id,
    customer: billCustomerList[0]._id,
    createdAt: '2019-01-15T11:33:14.343Z',
    subscription: billCustomerList[0].subscriptions[0]._id,
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
];

const creditNote = {
  _id: new ObjectId(),
  date: '2020-01-01',
  startDate: '2020-01-01',
  endDate: '2020-01-12',
  customer: billCustomerList[0]._id,
  exclTaxesCustomer: 100,
  inclTaxesCustomer: 112,
  events: [{
    eventId: eventList[4]._id,
    auxiliary: eventList[4].auxiliary,
    startDate: eventList[4].startDate,
    endDate: eventList[4].endDate,
    bills: { inclTaxesCustomer: 10, exclTaxesCustomer: 8 },
    serviceName: billServices[0].versions[0].name,
  }],
  isEditable: true,
  company: authCompany._id,
};

const customerFromOtherCompany = {
  _id: new ObjectId(),
  company: otherCompany._id,
  identity: { title: 'mr', firstname: 'Romain', lastname: 'Bardet' },
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

const fundingHistory = {
  _id: new ObjectId(),
  fundingId: new ObjectId(),
  amountTTC: '12',
  nature: 'fixed',
  company: authCompany._id,
};

const helperList = [
  { customer: billCustomerList[0]._id, user: billUserList[0]._id, company: authCompany._id, referent: true },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Bill.create([...authBillList, ...billList]),
    BillingItem.create(billingItemList),
    BillNumber.create(billNumbers),
    Contract.create(contracts),
    CreditNote.create(creditNote),
    Customer.create(billCustomerList.concat(customerFromOtherCompany)),
    Event.create(eventList),
    FundingHistory.create(fundingHistory),
    Helper.create(helperList),
    Service.create(billServices),
    ThirdPartyPayer.create(billThirdPartyPayer),
    User.create(billUserList),
    UserCompany.create(userCompanies),
  ]);
};

module.exports = {
  authBillList,
  populateDB,
  billCustomerList,
  billUserList,
  billList,
  billServices,
  eventList,
  billThirdPartyPayer,
  otherCompanyBillThirdPartyPayer,
  customerFromOtherCompany,
  fundingHistory,
  billingItemList,
};
