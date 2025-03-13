const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const BillingItem = require('../../../src/models/BillingItem');
const CreditNote = require('../../../src/models/CreditNote');
const Customer = require('../../../src/models/Customer');
const Event = require('../../../src/models/Event');
const User = require('../../../src/models/User');
const Service = require('../../../src/models/Service');
const ThirdPartyPayer = require('../../../src/models/ThirdPartyPayer');
const Helper = require('../../../src/models/Helper');
const UserCompany = require('../../../src/models/UserCompany');
const { HOURLY, WEBAPP } = require('../../../src/helpers/constants');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { helperRoleId, auxiliaryRoleId, clientAdminRoleId } = require('../../seed/authRolesSeed');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');
const FundingHistory = require('../../../src/models/FundingHistory');

const billingItemList = [
  {
    _id: new ObjectId(),
    defaultUnitAmount: 12,
    company: authCompany._id,
    type: 'per_intervention',
    vat: 10,
    name: 'Billing Idol',
  },
  {
    _id: new ObjectId(),
    defaultUnitAmount: 25,
    company: authCompany._id,
    type: 'manual',
    vat: 10,
    name: 'Billing Jean',
  },
];

const creditNoteThirdPartyPayer = {
  _id: new ObjectId(),
  name: 'Toto',
  company: authCompany._id,
  isApa: true,
  billingMode: 'direct',
};

const creditNoteService = {
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
};

const subId = new ObjectId();
const fundingId = new ObjectId();
const creditNoteCustomer = {
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
    mandates: [{ rum: 'R09876543456765432', _id: new ObjectId(), signedAt: CompaniDate().toISO() }],
  },
  subscriptions: [
    {
      _id: subId,
      service: creditNoteService._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    },
  ],
  fundings: [
    {
      _id: fundingId,
      nature: 'hourly',
      subscription: subId,
      thirdPartyPayer: creditNoteThirdPartyPayer._id,
      frequency: 'once',
      versions: [{
        amountTTC: 0,
        unitTTCRate: 20,
        careHours: 24,
        careDays: [0, 1, 2, 3, 4, 5, 6, 7],
        customerParticipationRate: 0.45,
        folderNumber: 'poiuytre',
        fundingPlanId: 'qwertyuiop',
        startDate: '2018-01-01T10:00:00.000+01:00',
        createdAt: '2018-01-01T10:00:00.000+01:00',
      }],
    },
  ],
};

const archivedCustomer = {
  _id: new ObjectId(),
  company: authCompany._id,
  identity: { title: 'mr', firstname: 'Gérard', lastname: 'Chivé' },
  stopReason: 'hospitalization',
  stoppedAt: '2021-10-10T21:59:59',
  archivedAt: '2021-10-17T11:58:14',
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
    bankAccountOwner: 'Gérard Chivé',
    iban: 'FR3514508000505917721779B12',
    bic: 'BNMDHISOBD',
    mandates: [{ rum: 'R09876543456765432', _id: new ObjectId(), signedAt: CompaniDate().toISO() }],
  },
  subscriptions: [
    {
      _id: new ObjectId(),
      service: creditNoteService._id,
      versions: [{
        unitTTCRate: 12,
        weeklyHours: 12,
        evenings: 2,
        sundays: 1,
        startDate: '2018-01-01T10:00:00.000+01:00',
      }],
    },
  ],
};

const creditNoteUserList = [
  {
    _id: new ObjectId(),
    identity: { firstname: 'HelperForCustomer', lastname: 'Test' },
    local: { email: 'helper_for_customer_creditnote@alenvi.io', password: '123456!eR' },
    refreshToken: uuidv4(),
    role: { client: helperRoleId },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Tata', lastname: 'Toto' },
    local: { email: 'toto@alenvi.io' },
    refreshToken: uuidv4(),
    role: { client: auxiliaryRoleId },
    origin: WEBAPP,
  },
];

const creditNoteEvent = {
  _id: new ObjectId(),
  company: authCompany._id,
  sector: new ObjectId(),
  type: 'intervention',
  startDate: '2019-01-16T09:30:19.543Z',
  endDate: '2019-01-16T11:30:21.653Z',
  auxiliary: creditNoteUserList[1]._id,
  customer: creditNoteCustomer._id,
  createdAt: '2019-01-15T11:33:14.343Z',
  subscription: creditNoteCustomer.subscriptions[0]._id,
  isBilled: true,
  bills: {
    thirdPartyPayer: creditNoteThirdPartyPayer._id,
    inclTaxesCustomer: '20',
    exclTaxesCustomer: '15',
    inclTaxesTpp: '10',
    exclTaxesTpp: '5',
    fundingId,
    nature: 'hourly',
    careHours: '2',
  },
  address: {
    fullAddress: '37 rue de ponthieu 75008 Paris',
    zipCode: '75008',
    city: 'Paris',
    street: '37 rue de Ponthieu',
    location: { type: 'Point', coordinates: [2.377133, 48.801389] },
  },
  origin: 'compani',
};

const creditNotesList = [
  {
    _id: new ObjectId(),
    date: '2019-01-16T09:30:19.543Z',
    startDate: '2019-01-10T09:30:19.543Z',
    endDate: '2019-01-23T09:30:19.543Z',
    customer: creditNoteCustomer._id,
    exclTaxesCustomer: '100',
    inclTaxesCustomer: 112,
    events: [{
      eventId: creditNoteEvent._id,
      auxiliary: creditNoteEvent.auxiliary,
      startDate: creditNoteEvent.startDate,
      endDate: creditNoteEvent.endDate,
      serviceName: 'toto',
      bills: { inclTaxesCustomer: '10', exclTaxesCustomer: '8' },
    }],
    subscription: {
      _id: creditNoteCustomer.subscriptions[0]._id,
      service: { serviceId: creditNoteService._id, nature: 'fixed', name: 'toto' },
      vat: 5.5,
    },
    origin: 'compani',
    company: authCompany._id,
  },
  { // 1
    _id: new ObjectId(),
    date: '2019-01-12T09:30:19.543Z',
    startDate: '2019-01-08T09:30:19.543Z',
    endDate: '2019-01-30T09:30:19.543Z',
    customer: creditNoteCustomer._id,
    exclTaxesCustomer: '100',
    inclTaxesCustomer: 112,
    events: [{
      eventId: creditNoteEvent._id,
      auxiliary: creditNoteEvent.auxiliary,
      startDate: creditNoteEvent.startDate,
      endDate: creditNoteEvent.endDate,
      serviceName: 'toto',
      bills: {
        inclTaxesCustomer: '10',
        exclTaxesCustomer: '8',
      },
    }],
    subscription: {
      _id: creditNoteCustomer.subscriptions[0]._id,
      service: { serviceId: creditNoteService._id, nature: 'fixed', name: 'toto' },
      vat: 5.5,
    },
    origin: 'ogust',
    company: authCompany._id,
  },
  { // 2
    _id: new ObjectId(),
    date: '2020-01-01T00:00:00.000Z',
    startDate: '2019-01-01T00:00:00.000Z',
    endDate: '2020-01-12T23:59:59.999Z',
    customer: creditNoteCustomer._id,
    exclTaxesCustomer: '100',
    inclTaxesCustomer: 112,
    events: [{
      eventId: creditNoteEvent._id,
      auxiliary: creditNoteEvent.auxiliary,
      startDate: creditNoteEvent.startDate,
      endDate: creditNoteEvent.endDate,
      serviceName: 'toto',
      bills: { inclTaxesCustomer: '10', exclTaxesCustomer: '8' },
    }],
    subscription: {
      _id: creditNoteCustomer.subscriptions[0]._id,
      service: { serviceId: creditNoteService._id, nature: 'fixed', name: 'toto' },
      vat: 5.5,
    },
    isEditable: false,
    origin: 'ogust',
    company: authCompany._id,
  },
  { // 3 - with archived customer
    _id: new ObjectId(),
    date: '2020-01-01T00:00:00.000Z',
    startDate: '2019-01-01T00:00:00.000Z',
    endDate: '2020-01-01T00:00:00.000Z',
    customer: archivedCustomer._id,
    exclTaxesCustomer: '100',
    inclTaxesCustomer: 112,
    events: [{
      eventId: creditNoteEvent._id,
      auxiliary: creditNoteEvent.auxiliary,
      startDate: creditNoteEvent.startDate,
      endDate: creditNoteEvent.endDate,
      serviceName: 'toto',
      bills: { inclTaxesCustomer: '10', exclTaxesCustomer: '8' },
    }],
    subscription: {
      _id: archivedCustomer.subscriptions[0]._id,
      service: { serviceId: creditNoteService._id, nature: 'fixed', name: 'toto' },
      vat: 5.5,
    },
    origin: 'compani',
    company: authCompany._id,
    isEditable: true,
  },
  { // 4 - with billing items
    _id: new ObjectId(),
    date: '2020-01-01T00:00:00.000Z',
    startDate: '2019-01-01T00:00:00.000Z',
    endDate: '2020-01-01T00:00:00.000Z',
    customer: creditNoteCustomer._id,
    exclTaxesCustomer: '100',
    inclTaxesCustomer: 112,
    billingItemList: [{
      billingItem: billingItemList[1]._id,
      unitInclTaxes: 35,
      name: 'Billing Jean',
      count: 2,
      vat: 10,
      inclTaxes: 30,
      exclTaxes: '25',
    }],
    origin: 'compani',
    company: authCompany._id,
    isEditable: true,
  },
];

const otherCompanyThirdPartyPayer = {
  _id: new ObjectId(),
  name: 'Titi',
  company: otherCompany._id,
  isApa: false,
  billingMode: 'direct',
};

const otherCompanyService = {
  _id: new ObjectId(),
  company: otherCompany._id,
  versions: [{
    defaultUnitAmount: 24,
    name: 'Service 2',
    startDate: '2019-01-16 17:58:15.519',
    vat: 5.5,
    exemptFromCharges: false,
  }],
  nature: HOURLY,
};

const otherCompanyCustomer = {
  _id: new ObjectId(),
  company: otherCompany._id,
  identity: { title: 'mr', firstname: 'Jean', lastname: 'Bonbeurre' },
  contact: {
    primaryAddress: {
      fullAddress: '23 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '23 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    phone: '0623675432',
    countryCode: '+33',
  },
  payment: {
    bankAccountOwner: 'Jean Bonbeurre',
    iban: 'FR9514708000505917721779B13',
    bic: 'AGMDHISOBD',
    mandates: [{ rum: 'R19879533456767438', _id: new ObjectId(), signedAt: CompaniDate().toISO() }],
  },
  subscriptions: [{
    _id: new ObjectId(),
    service: otherCompanyService._id,
    versions: [{
      unitTTCRate: 24,
      weeklyHours: 6,
      evenings: 0,
      sundays: 1,
      startDate: '2018-01-01T10:00:00.000+01:00',
    }],
  }],
};

const otherCompanyUser = {
  _id: new ObjectId(),
  identity: { firstname: 'Renégat', lastname: 'Toto' },
  local: { email: 'other_user@alenvi.io', password: '123456!eR' },
  refreshToken: uuidv4(),
  role: { client: clientAdminRoleId },
  origin: WEBAPP,
};

const otherCompanyEvent = {
  _id: new ObjectId(),
  company: otherCompany._id,
  sector: new ObjectId(),
  type: 'intervention',
  startDate: '2019-01-16T09:30:19.543Z',
  endDate: '2019-01-16T11:30:21.653Z',
  auxiliary: new ObjectId(),
  customer: otherCompanyCustomer._id,
  createdAt: '2019-01-15T11:33:14.343Z',
  subscription: otherCompanyCustomer.subscriptions[0]._id,
  isBilled: true,
  address: {
    fullAddress: '37 rue de ponthieu 75008 Paris',
    zipCode: '75008',
    city: 'Paris',
    street: '37 rue de Ponthieu',
    location: { type: 'Point', coordinates: [2.377133, 48.801389] },
  },
  bills: {
    thirdPartyPayer: otherCompanyThirdPartyPayer._id,
    inclTaxesCustomer: 20,
    exclTaxesCustomer: 15,
    inclTaxesTpp: 10,
    exclTaxesTpp: 5,
    fundingId: new ObjectId(),
    nature: 'hourly',
    careHours: 2,
  },
  origin: 'compani',
};

const otherCompanyCreditNote = {
  _id: new ObjectId(),
  date: '2019-01-16T09:30:19.543Z',
  startDate: '2019-01-10T09:30:19.543Z',
  endDate: '2019-01-19T09:30:19.543Z',
  customer: otherCompanyCustomer._id,
  exclTaxesCustomer: '100',
  inclTaxesCustomer: 112,
  events: [{
    eventId: otherCompanyEvent._id,
    auxiliary: new ObjectId(),
    startDate: otherCompanyEvent.startDate,
    endDate: otherCompanyEvent.endDate,
    serviceName: 'titi',
    bills: { inclTaxesCustomer: '10', exclTaxesCustomer: '8' },
  }],
  subscription: {
    _id: otherCompanyCustomer.subscriptions[0]._id,
    service: { serviceId: otherCompanyService._id, nature: 'fixed', name: 'toto' },
    vat: 5.5,
  },
  origin: 'compani',
  company: otherCompany._id,
};

const helpersList = [{
  customer: creditNoteCustomer._id,
  user: creditNoteUserList[0]._id,
  company: authCompany._id,
  referent: true,
}];

const userCompanies = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: creditNoteUserList[0]._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), user: creditNoteUserList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), user: creditNoteUserList[1]._id, company: authCompany._id },
  { _id: new ObjectId(), user: otherCompanyUser._id, company: otherCompany._id },
];

const fundingHistoryList = [{ company: authCompany._id, fundingId, amountTTC: 0, careHours: 12 }];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    BillingItem.create(billingItemList),
    CreditNote.create([...creditNotesList, otherCompanyCreditNote]),
    Customer.create([creditNoteCustomer, otherCompanyCustomer, archivedCustomer]),
    Event.create([creditNoteEvent, otherCompanyEvent]),
    FundingHistory.create(fundingHistoryList),
    Helper.create(helpersList),
    Service.create([creditNoteService, otherCompanyService]),
    ThirdPartyPayer.create([creditNoteThirdPartyPayer, otherCompanyThirdPartyPayer]),
    User.create([...creditNoteUserList, otherCompanyUser]),
    UserCompany.create(userCompanies),
  ]);
};

module.exports = {
  creditNotesList,
  billingItemList,
  populateDB,
  creditNoteCustomer,
  archivedCustomer,
  creditNoteEvent,
  creditNoteUserList,
  creditNoteThirdPartyPayer,
  otherCompanyCustomer,
  otherCompanyThirdPartyPayer,
  otherCompanyEvent,
  otherCompanyUser,
  otherCompanyCreditNote,
};
