const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const moment = require('../../../src/extensions/moment');
const Attendance = require('../../../src/models/Attendance');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const Event = require('../../../src/models/Event');
const Customer = require('../../../src/models/Customer');
const User = require('../../../src/models/User');
const Bill = require('../../../src/models/Bill');
const CreditNote = require('../../../src/models/CreditNote');
const Service = require('../../../src/models/Service');
const ThirdPartyPayer = require('../../../src/models/ThirdPartyPayer');
const Payment = require('../../../src/models/Payment');
const Pay = require('../../../src/models/Pay');
const Sector = require('../../../src/models/Sector');
const SectorHistory = require('../../../src/models/SectorHistory');
const Step = require('../../../src/models/Step');
const InternalHour = require('../../../src/models/InternalHour');
const FinalPay = require('../../../src/models/FinalPay');
const ReferentHistory = require('../../../src/models/ReferentHistory');
const Contract = require('../../../src/models/Contract');
const Establishment = require('../../../src/models/Establishment');
const EventHistory = require('../../../src/models/EventHistory');
const Helper = require('../../../src/models/Helper');
const UserCompany = require('../../../src/models/UserCompany');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const Course = require('../../../src/models/Course');
const CourseSlot = require('../../../src/models/CourseSlot');
const CourseSmsHistory = require('../../../src/models/CourseSmsHistory');
const { authCompany } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/authentication');
const {
  PAYMENT,
  REFUND,
  FIXED,
  HOURLY,
  PAID_LEAVE,
  INVOICED_AND_PAID,
  DAILY,
  INTERNAL_HOUR,
  INTERVENTION,
  ABSENCE,
  UNJUSTIFIED,
  AUXILIARY_INITIATIVE,
  EVERY_DAY,
  MISTER,
  MONTHLY,
  ONCE,
  WEBAPP,
  MANUAL_TIME_STAMPING,
  QRCODE_MISSING,
  QR_CODE_TIME_STAMPING,
  INTRA,
  INTER_B2B,
  ON_SITE,
  REMOTE,
  E_LEARNING,
} = require('../../../src/helpers/constants');
const { auxiliaryRoleId, helperRoleId } = require('../../seed/authRolesSeed');

const sector = { _id: new ObjectId(), name: 'Etoile', company: authCompany._id };

const surcharge = { _id: new ObjectId(), name: 'test' };

const serviceList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    versions: [{
      name: 'Service 1',
      surcharge: surcharge._id,
      exemptFromCharges: false,
      startDate: '2019-01-16 17:58:15.519',
      defaultUnitAmount: 24,
    }],
    nature: HOURLY,
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    versions: [{
      defaultUnitAmount: 24,
      name: 'Service 2',
      surcharge: surcharge._id,
      exemptFromCharges: false,
      startDate: '2019-01-18 19:58:15.519',
      vat: 12,
    }],
    nature: HOURLY,
  },
];

const authBillService = { serviceId: new ObjectId(), name: 'Temps de qualité - autonomie', nature: 'fixed' };

const contract1Id = new ObjectId();
const contract2Id = new ObjectId();
const contract3Id = new ObjectId();

const establishment = {
  _id: new ObjectId(),
  name: 'Toto',
  siret: '12345678901234',
  address: {
    street: '15, rue du test',
    fullAddress: '15, rue du test 75007 Paris',
    zipCode: '75007',
    city: 'Paris',
    location: { type: 'Point', coordinates: [4.849302, 2.90887] },
  },
  phone: '0123456789',
  workHealthService: 'MT01',
  urssafCode: '117',
  company: authCompany,
};

const auxiliaryList = [{
  _id: new ObjectId(),
  establishment: establishment._id,
  identity: {
    firstname: 'Lulu',
    lastname: 'Uiui',
    title: MISTER,
    birthDate: moment('1992-01-01').toDate(),
    birthCountry: 'FR',
    birthState: '75',
    birthCity: 'Paris',
    nationality: 'FR',
    socialSecurityNumber: '012345678912345',
  },
  contact: {
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    phone: '0123456789',
  },
  role: { client: auxiliaryRoleId },
  local: { email: 'export_auxiliary_1@alenvi.io' },
  refreshToken: uuidv4(),
  contracts: [contract1Id, contract2Id],
  origin: WEBAPP,
}, {
  _id: new ObjectId(),
  establishment: establishment._id,
  identity: {
    firstname: 'Lili',
    lastname: 'Lolo',
    title: MISTER,
    birthDate: moment('1992-01-01').toDate(),
    birthCountry: 'FR',
    birthState: '75',
    birthCity: 'Paris',
    nationality: 'FR',
    socialSecurityNumber: '012345678912345',
  },
  contact: {
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    phone: '0123456789',
  },
  role: { client: auxiliaryRoleId },
  local: { email: 'export_auxiliary_2@alenvi.io' },
  refreshToken: uuidv4(),
  contracts: [contract3Id],
  origin: WEBAPP,
}];

const contractList = [{
  _id: contract1Id,
  serialNumber: 'safsdgsdgsd',
  user: auxiliaryList[0]._id,
  versions: [
    { weeklyHours: 12, grossHourlyRate: 10, startDate: '2018-01-01T00:00:00', endDate: '2020-01-01T00:00:00' },
  ],
  startDate: '2018-01-01T00:00:00',
  endDate: '2020-01-01T00:00:00',
  endNotificationDate: '2020-01-01t00:00:00',
  endReason: 'mutation',
  company: authCompany._id,
}, {
  _id: contract2Id,
  serialNumber: 'sfasdfsdf',
  user: auxiliaryList[0]._id,
  versions: [{ weeklyHours: 12, grossHourlyRate: 10, startDate: '2020-02-01' }],
  startDate: '2020-02-01T00:00:00',
  company: authCompany._id,
}, {
  _id: contract3Id,
  serialNumber: 'nckxavhsasidf',
  user: auxiliaryList[1]._id,
  versions: [{ weeklyHours: 12, grossHourlyRate: 10, startDate: '2020-02-01' }],
  startDate: '2020-02-01',
  company: authCompany._id,
}];

const sectorHistories = [
  { auxiliary: auxiliaryList[0]._id, sector: sector._id, company: authCompany._id, startDate: '2018-12-10T00:00:00' },
];

const internalHour = { _id: new ObjectId(), name: 'planning', company: authCompany._id };

const subscriptionId = new ObjectId();

const thirdPartyPayer = {
  _id: new ObjectId(),
  name: 'Toto',
  company: authCompany._id,
  isApa: true,
  billingMode: 'direct',
};

const customerSubscriptionId = new ObjectId();
const customersList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    identity: { title: 'mr', firstname: 'Christopher', lastname: 'Froome', birthDate: moment('1940-01-01').toDate() },
    contact: {
      primaryAddress: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
      phone: '0612345678',
    },
    subscriptions: [
      {
        _id: subscriptionId,
        service: serviceList[0]._id,
        versions: [{ unitTTCRate: 12, estimatedWeeklyVolume: 30, evenings: 1, sundays: 2 }],
      },
      { _id: new ObjectId(), service: serviceList[1]._id, versions: [{ startDate: '2018-01-05T15:00:00.000+01:00' }] },
    ],
    fundings: [{
      _id: new ObjectId(),
      nature: FIXED,
      thirdPartyPayer: thirdPartyPayer._id,
      subscription: subscriptionId,
      frequency: MONTHLY,
      versions: [{
        startDate: '2018-02-03T22:00:00.000+01:00',
        folderNumber: '12345',
        unitTTCRate: 10,
        amountTTC: 21,
        customerParticipationRate: 12,
        careHours: 9,
        careDays: [0, 1, 2],
      }],
    }],
    payment: { bankAccountOwner: 'Test Toto', iban: 'FR6930003000405885475816L80', bic: 'ABNAFRPP' },
    followUp: { situation: 'home', misc: '123456789', environment: 'test', objectives: 'toto' },
    stoppedAt: '2021-02-03T22:00:00.000+01:00',
    stopReason: 'death',
    archivedAt: '2021-06-03T22:00:00.000+01:00',
  },
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
    },
    followUp: { situation: 'nursing_home' },
    stoppedAt: '2021-06-10T22:00:00.000+01:00',
    stopReason: 'quality',
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    identity: { title: 'mr', firstname: 'Julian', lastname: 'Alaphilippe' },
    contact: {
      primaryAddress: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
      phone: '0612345678',
    },
    followUp: { situation: 'home' },
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    identity: { title: 'mr', firstname: 'Romain', lastname: 'Bardet' },
    contact: {
      primaryAddress: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
      phone: '0123456789',
    },
    subscriptions: [{
      _id: customerSubscriptionId,
      service: serviceList[0]._id,
      versions: [
        { unitTTCRate: 12, estimatedWeeklyVolume: 12, evenings: 2, sundays: 1, createdAt: '2020-01-01T23:00:00' },
        { unitTTCRate: 10, estimatedWeeklyVolume: 8, evenings: 0, sundays: 2, createdAt: '2019-06-01T23:00:00' },
      ],
    }],
    fundings: [
      {
        _id: new ObjectId(),
        nature: FIXED,
        thirdPartyPayer: thirdPartyPayer._id,
        subscription: customerSubscriptionId,
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
  },
];

const referentList = [
  {
    auxiliary: auxiliaryList[0]._id,
    customer: customersList[0]._id,
    company: customersList[0].company,
    startDate: '2020-01-31T00:00:00',
  },
  {
    auxiliary: auxiliaryList[1]._id,
    customer: customersList[0]._id,
    company: customersList[0].company,
    startDate: '2019-03-12T00:00:00',
    endDate: '2020-01-30T00:00:00',
  },
  {
    auxiliary: auxiliaryList[0]._id,
    customer: customersList[1]._id,
    company: customersList[1].company,
    startDate: '2019-06-23T00:00:00',
  },
];

const eventList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector,
    type: ABSENCE,
    absence: PAID_LEAVE,
    absenceNature: DAILY,
    startDate: '2019-01-19T00:00:00',
    endDate: '2019-01-21T22:59:00',
    auxiliary: auxiliaryList[0]._id,
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector,
    type: ABSENCE,
    absence: UNJUSTIFIED,
    absenceNature: HOURLY,
    startDate: moment('2019-01-19T14:00:00').toDate(),
    endDate: moment('2019-01-19T16:00:00').toDate(),
    auxiliary: auxiliaryList[0]._id,
    misc: 'test absence',
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector,
    type: INTERVENTION,
    startDate: '2019-01-16T09:30:19.543Z',
    endDate: '2019-01-16T11:30:21.653Z',
    auxiliary: auxiliaryList[0]._id,
    customer: customersList[3]._id,
    isCancelled: true,
    misc: 'test',
    cancel: { condition: INVOICED_AND_PAID, reason: AUXILIARY_INITIATIVE },
    createdAt: '2019-01-15T11:33:14.343Z',
    subscription: customersList[3].subscriptions[0]._id,
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
    sector,
    type: INTERVENTION,
    startDate: '2019-01-17T14:30:19.543Z',
    endDate: '2019-01-17T16:30:19.543Z',
    customer: customersList[3]._id,
    createdAt: '2019-01-16T14:30:19.543Z',
    subscription: customersList[3].subscriptions[0]._id,
    repetition: { frequency: EVERY_DAY, parentId: new ObjectId() },
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    transportMode: 'public',
    kmDuringEvent: 23,
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector,
    type: INTERVENTION,
    startDate: '2020-01-17T14:30:19.543Z',
    endDate: '2020-01-17T16:30:19.543Z',
    customer: customersList[0]._id,
    createdAt: '2020-01-16T14:30:19.543Z',
    subscription: customersList[3].subscriptions[0]._id,
    repetition: { frequency: EVERY_DAY, parentId: new ObjectId() },
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
    isBilled: true,
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector,
    auxiliary: auxiliaryList[0]._id,
    type: INTERNAL_HOUR,
    internalHour: internalHour._id,
    startDate: '2019-01-17T14:30:19.543Z',
    endDate: '2019-01-17T16:30:19.543Z',
    createdAt: '2019-01-16T14:30:19.543Z',
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    sector,
    type: INTERVENTION,
    startDate: '2019-01-11T09:30:19.543Z',
    endDate: '2019-01-11T11:30:21.653Z',
    auxiliary: auxiliaryList[0]._id,
    customer: customersList[3]._id,
    createdAt: '2019-01-09T11:33:14.343Z',
    subscription: customersList[3].subscriptions[0]._id,
    address: {
      fullAddress: '37 rue de ponthieu 75008 Paris',
      zipCode: '75008',
      city: 'Paris',
      street: '37 rue de Ponthieu',
      location: { type: 'Point', coordinates: [2.377133, 48.801389] },
    },
  },
];

const eventHistoriesList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    event: { eventId: eventList[3]._id },
    action: MANUAL_TIME_STAMPING,
    manualTimeStampingReason: QRCODE_MISSING,
    update: { startHour: { from: '2019-01-17T14:30:19.543Z', to: '2019-01-17T14:35:19.543Z' } },
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    event: { eventId: eventList[3]._id },
    action: QR_CODE_TIME_STAMPING,
    update: { endHour: { from: '2019-01-17T16:30:19.543Z', to: '2019-01-17T16:35:19.543Z' } },
  },
];

const billsList = [
  {
    _id: new ObjectId(),
    type: 'automatic',
    date: '2019-05-29',
    number: 'FACT-1905002',
    company: authCompany._id,
    customer: customersList[3]._id,
    thirdPartyPayer: thirdPartyPayer._id,
    netInclTaxes: 75.96,
    subscriptions: [{
      startDate: '2019-05-29',
      endDate: '2019-11-29',
      subscription: customersList[3].subscriptions[0]._id,
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
  {
    _id: new ObjectId(),
    type: 'automatic',
    date: '2019-05-25',
    number: 'FACT-1905003',
    company: authCompany._id,
    customer: customersList[3]._id,
    netInclTaxes: 101.28,
    subscriptions: [{
      startDate: '2019-05-25',
      endDate: '2019-11-25',
      subscription: customersList[3].subscriptions[0]._id,
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
];

const paymentsList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    number: 'REG-1903201',
    date: '2019-05-26T19:47:42',
    customer: customersList[3]._id,
    thirdPartyPayer: thirdPartyPayer._id,
    netInclTaxes: 190,
    nature: PAYMENT,
    type: 'direct_debit',
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    number: 'REG-1903202',
    date: '2019-05-24T15:47:42',
    customer: customersList[3]._id,
    netInclTaxes: 390,
    nature: PAYMENT,
    type: 'check',
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    number: 'REG-1903203',
    date: '2019-05-27T09:10:20',
    customer: customersList[3]._id,
    thirdPartyPayer: thirdPartyPayer._id,
    netInclTaxes: 220,
    nature: REFUND,
    type: 'direct_debit',
  },
];

const payList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    additionalHours: 0,
    auxiliary: auxiliaryList[0]._id,
    bonus: 0,
    contractHours: 151,
    diff: {
      hoursBalance: 8,
      notSurchargedAndNotExempt: 2,
      notSurchargedAndExempt: 2,
      surchargedAndExempt: 2,
      surchargedAndExemptDetails: [],
      surchargedAndNotExempt: 2,
      surchargedAndNotExemptDetails: [],
      workedHours: 0,
      paidTransportHours: 3,
      internalHours: 9,
      absencesHours: 5,
    },
    endDate: '2019-01-31T14:00:18',
    hoursBalance: -8,
    hoursCounter: -20,
    hoursToWork: 30,
    holidaysHours: 12,
    notSurchargedAndExempt: 97,
    notSurchargedAndNotExempt: 43,
    surchargedAndExempt: 0,
    surchargedAndExemptDetails: [],
    surchargedAndNotExempt: 3,
    surchargedAndNotExemptDetails: [],
    month: '01-2019',
    mutual: false,
    phoneFees: 0,
    overtimeHours: 0,
    startDate: '2019-01-01T14:00:18',
    transport: 10,
    paidKm: 12,
    travelledKm: 14,
    workedHours: 143,
    paidTransportHours: 3,
    internalHours: 9,
    absencesHours: 5,
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    additionalHours: 0,
    auxiliary: auxiliaryList[0]._id,
    bonus: 0,
    contractHours: 151,
    diff: {
      hoursBalance: 8,
      notSurchargedAndNotExempt: 2,
      notSurchargedAndExempt: 2,
      surchargedAndExempt: 2,
      surchargedAndExemptDetails: [],
      surchargedAndNotExempt: 2,
      surchargedAndNotExemptDetails: [],
      workedHours: 0,
      paidTransportHours: 3,
      internalHours: 9,
      absencesHours: 5,
    },
    endDate: '2019-02-28T14:00:18',
    holidaysHours: 12,
    hoursBalance: -8,
    hoursCounter: -20,
    hoursToWork: 20,
    month: '02-2019',
    mutual: false,
    notSurchargedAndExempt: 97,
    notSurchargedAndNotExempt: 43,
    surchargedAndExempt: 0,
    surchargedAndExemptDetails: [],
    surchargedAndNotExempt: 3,
    surchargedAndNotExemptDetails: [],
    phoneFees: 0,
    overtimeHours: 0,
    startDate: '2019-01-01T14:00:18',
    transport: 10,
    paidKm: 12,
    travelledKm: 14,
    workedHours: 143,
    paidTransportHours: 3,
    internalHours: 9,
    absencesHours: 5,
  },
];

const finalPayList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    additionalHours: 0,
    auxiliary: auxiliaryList[0]._id,
    bonus: 0,
    compensation: 10,
    contractHours: 151,
    diff: {
      hoursBalance: 8,
      notSurchargedAndNotExempt: 2,
      notSurchargedAndExempt: 2,
      surchargedAndExempt: 2,
      surchargedAndExemptDetails: [],
      surchargedAndNotExempt: 2,
      surchargedAndNotExemptDetails: [],
      workedHours: 0,
      paidTransportHours: 3,
      internalHours: 9,
      absencesHours: 5,
    },
    endDate: '2019-01-31T14:00:18',
    endNotificationDate: '2019-01-25T14:00:18',
    endReason: 'salut',
    holidaysHours: 12,
    hoursBalance: -8,
    hoursCounter: -20,
    hoursToWork: 20,
    month: '01-2019',
    mutual: false,
    notSurchargedAndExempt: 97,
    notSurchargedAndNotExempt: 43,
    surchargedAndExempt: 0,
    surchargedAndExemptDetails: [],
    surchargedAndNotExempt: 3,
    surchargedAndNotExemptDetails: [],
    overtimeHours: 0,
    phoneFees: 0,
    startDate: '2019-01-01T14:00:18',
    transport: 10,
    paidKm: 12,
    travelledKm: 14,
    workedHours: 143,
    paidTransportHours: 3,
    internalHours: 9,
    absencesHours: 5,
  },
  {
    _id: new ObjectId(),
    company: authCompany._id,
    additionalHours: 0,
    auxiliary: auxiliaryList[0]._id,
    bonus: 0,
    compensation: 10,
    contractHours: 151,
    diff: {
      hoursBalance: 8,
      notSurchargedAndNotExempt: 2,
      notSurchargedAndExempt: 2,
      surchargedAndExempt: 2,
      surchargedAndExemptDetails: [],
      surchargedAndNotExempt: 2,
      surchargedAndNotExemptDetails: [],
      workedHours: 0,
      paidTransportHours: 3,
      internalHours: 9,
      absencesHours: 5,
    },
    endDate: '2019-02-28T14:00:18',
    endNotificationDate: '2019-02-25T14:00:18',
    endReason: 'salut',
    holidaysHours: 12,
    hoursBalance: -8,
    hoursCounter: -20,
    hoursToWork: 20,
    month: '02-2019',
    mutual: false,
    notSurchargedAndExempt: 97,
    notSurchargedAndNotExempt: 43,
    phoneFees: 0,
    overtimeHours: 0,
    startDate: '2019-01-01T14:00:18',
    surchargedAndExempt: 0,
    surchargedAndExemptDetails: [],
    surchargedAndNotExempt: 3,
    surchargedAndNotExemptDetails: [],
    transport: 10,
    paidKm: 12,
    travelledKm: 14,
    workedHours: 143,
    paidTransportHours: 3,
    internalHours: 9,
    absencesHours: 5,
  },
];

const creditNotesList = [
  {
    _id: new ObjectId(),
    company: authCompany._id,
    date: '2019-05-28',
    startDate: '2019-05-27',
    endDate: '2019-11-25',
    customer: customersList[3]._id,
    thirdPartyPayer: thirdPartyPayer._id,
    exclTaxesCustomer: 100,
    inclTaxesCustomer: 112,
    exclTaxesTpp: 10,
    inclTaxesTpp: 90,
    events: [{
      eventId: new ObjectId(),
      serviceName: 'Temps de qualité - autonomie',
      startDate: '2019-01-16T10:30:19.543Z',
      endDate: '2019-01-16T12:30:21.653Z',
      auxiliary: new ObjectId(),
      bills: {
        inclTaxesCustomer: 10,
        exclTaxesCustomer: 8,
      },
    }],
    origin: 'compani',
    subscription: {
      _id: customersList[3].subscriptions[0]._id,
      service: {
        serviceId: new ObjectId(),
        nature: 'fixed',
        name: 'toto',
      },
      vat: 5.5,
    },
  },
];

const user = {
  _id: new ObjectId(),
  contact: { phone: '0123456789' },
  identity: { firstname: 'test', lastname: 'Toto' },
  local: { email: 'toto@alenvi.io' },
  refreshToken: uuidv4(),
  role: { client: helperRoleId },
  origin: WEBAPP,
};

const helpersList = [
  { customer: customersList[0]._id, user: user._id, company: authCompany._id, referent: true },
];

const userCompanies = [
  { _id: new ObjectId(), user: auxiliaryList[0]._id, company: authCompany._id },
  { _id: new ObjectId(), user: auxiliaryList[1]._id, company: authCompany._id },
  { _id: new ObjectId(), user: user._id, company: authCompany._id },
];

const subProgramList = [{ _id: new ObjectId(), name: 'subProgram 1' }, { _id: new ObjectId(), name: 'subProgram 2' }];

const programList = [
  { _id: new ObjectId(), name: 'Program 1', subPrograms: [subProgramList[0]._id] },
  { _id: new ObjectId(), name: 'Program 2', subPrograms: [subProgramList[1]._id] },
];

const trainer = {
  _id: new ObjectId(),
  identity: { firstname: 'Gilles', lastname: 'Formateur' },
  origin: WEBAPP,
  local: { email: 'formateur@compani.fr' },
};
const salesRepresentative = {
  _id: new ObjectId(),
  identity: { firstname: 'Aline', lastname: 'Contact-Com' },
  origin: WEBAPP,
  local: { email: 'srepresentative@compani.fr' },
};

const traineeList = [
  {
    _id: new ObjectId(),
    identity: { firstname: 'Jacques', lastname: 'Trainee' },
    origin: WEBAPP,
    local: { email: 'trainee1@compani.fr' },
    firstMobileConnection: new Date(),
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Paul', lastname: 'Trainee' },
    origin: WEBAPP,
    local: { email: 'trainee2@compani.fr' },
    firstMobileConnection: new Date(),
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Marie', lastname: 'Trainee' },
    local: { email: 'trainee3@compani.fr' },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Annie', lastname: 'Trainee' },
    local: { email: 'trainee4@compani.fr' },
    origin: WEBAPP,
  },
  {
    _id: new ObjectId(),
    identity: { firstname: 'Luc', lastname: 'Trainee' },
    local: { email: 'trainee5@compani.fr' },
    origin: WEBAPP,
  },
];

const courseList = [
  {
    _id: new ObjectId(),
    type: INTRA,
    company: authCompany._id,
    subProgram: subProgramList[0]._id,
    misc: 'group 1',
    trainer: trainer._id,
    salesRepresentative: salesRepresentative._id,
    contact: salesRepresentative._id,
    trainees: [traineeList[0]._id, traineeList[1]._id, traineeList[2]._id],

  },
  {
    _id: new ObjectId(),
    type: INTER_B2B,
    subProgram: subProgramList[1]._id,
    misc: 'group 2',
    trainer: trainer._id,
    salesRepresentative: salesRepresentative._id,
    contact: salesRepresentative._id,
    trainees: [traineeList[3]._id, traineeList[4]._id],
  },
];

const stepList = [
  { _id: new ObjectId(), name: 'étape 1', type: ON_SITE },
  { _id: new ObjectId(), name: 'étape 2', type: REMOTE },
  { _id: new ObjectId(), name: 'étape 3', type: E_LEARNING },
  { _id: new ObjectId(), name: 'étape 4', type: ON_SITE },
];

const slotAddress = {
  street: '24 Avenue Daumesnil',
  fullAddress: '24 Avenue Daumesnil 75012 Paris',
  zipCode: '75012',
  city: 'Paris',
  location: { type: 'Point', coordinates: [2.37345, 48.848024] },
};

const courseSlotList = [
  {
    _id: new ObjectId(),
    course: courseList[0]._id,
    step: stepList[0]._id,
    startDate: new Date('2021-05-01T08:00:00.000Z'),
    endDate: new Date('2021-05-01T10:00:00.000Z'),
    address: slotAddress,
    createdAt: new Date('2020-12-12T10:00:00.000Z'),
  },
  {
    _id: new ObjectId(),
    course: courseList[0]._id,
    step: stepList[1]._id,
    startDate: new Date('2021-05-01T14:00:00.000Z'),
    endDate: new Date('2021-05-01T16:00:00.000Z'),
    meetingLink: 'https://meet.google.com',
    createdAt: new Date('2020-12-12T10:00:01.000Z'),
  },
  {
    _id: new ObjectId(),
    course: courseList[1]._id,
    step: stepList[0]._id,
    startDate: new Date('2021-02-01T08:00:00.000Z'),
    endDate: new Date('2021-02-01T10:00:00.000Z'),
    address: slotAddress,
    createdAt: new Date('2020-12-12T10:00:02.000Z'),
  },
  {
    _id: new ObjectId(),
    course: courseList[1]._id,
    step: stepList[2]._id,
    startDate: new Date('2021-02-02T08:00:00.000Z'),
    endDate: new Date('2021-02-02T10:00:00.000Z'),
    createdAt: new Date('2020-12-12T10:00:03.000Z'),
  },
  {
    _id: new ObjectId(),
    course: courseList[1]._id,
    step: stepList[3]._id,
    address: slotAddress,
    createdAt: new Date('2020-12-12T10:00:04.000Z'),
  },
];

const attendanceList = [
  { trainee: traineeList[0]._id, courseSlot: courseSlotList[0]._id },
  { trainee: traineeList[0]._id, courseSlot: courseSlotList[1]._id },
  { trainee: traineeList[1]._id, courseSlot: courseSlotList[1]._id },
  { trainee: traineeList[1]._id, courseSlot: courseSlotList[2]._id },
  { trainee: traineeList[1]._id, courseSlot: courseSlotList[3]._id },
  { trainee: traineeList[3]._id, courseSlot: courseSlotList[2]._id },
  { trainee: traineeList[3]._id, courseSlot: courseSlotList[3]._id },
];

const attendanceSheetList = [
  { course: courseList[0]._id, trainee: traineeList[0]._id, file: { link: 'link', publicId: '123' } },
];

const smsList = [
  { _id: new ObjectId(), type: 'convocation', message: 'SMS 1', sender: traineeList[0]._id, course: courseList[0]._id },
  { _id: new ObjectId(), type: 'convocation', message: 'SMS 2', sender: traineeList[1]._id, course: courseList[0]._id },
  { _id: new ObjectId(), type: 'convocation', message: 'SMS 3', sender: traineeList[3]._id, course: courseList[1]._id },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Bill.create(billsList),
    Contract.create(contractList),
    CreditNote.create(creditNotesList),
    Customer.create(customersList),
    Establishment.create(establishment),
    Event.create(eventList),
    EventHistory.create(eventHistoriesList),
    FinalPay.create(finalPayList),
    Helper.create(helpersList),
    InternalHour.create(internalHour),
    Payment.create(paymentsList),
    Pay.create(payList),
    ReferentHistory.create(referentList),
    Sector.create(sector),
    SectorHistory.create(sectorHistories),
    Service.create(serviceList),
    ThirdPartyPayer.create(thirdPartyPayer),
    User.create([...auxiliaryList, ...traineeList, user, trainer, salesRepresentative]),
    UserCompany.create(userCompanies),
    SubProgram.create(subProgramList),
    Program.create(programList),
    Course.create(courseList),
    CourseSlot.create(courseSlotList),
    CourseSmsHistory.create(smsList),
    Attendance.create(attendanceList),
    AttendanceSheet.create(attendanceSheetList),
    Step.create(stepList),
  ]);
};

module.exports = {
  populateDB,
  paymentsList,
  customersList,
  user,
  billsList,
  creditNotesList,
  auxiliaryList,
  establishment,
  thirdPartyPayer,
  courseList,
  courseSlotList,
};
