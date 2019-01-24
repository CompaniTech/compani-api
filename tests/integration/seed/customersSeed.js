const { ObjectID } = require('mongodb');
const faker = require('faker');
const moment = require('moment');

const Customer = require('../../../models/Customer');
const { companiesList } = require('./companiesSeed');
const { MONTHLY, ONE_TIME } = require('../../../helpers/constants');

faker.locale = 'fr';

const customersList = [
  {
    _id: new ObjectID(),
    email: faker.internet.email(),
    identity: {
      title: faker.name.title(),
      firstname: faker.name.firstName(),
      lastname: faker.name.lastName(),
      birthDate: faker.date.past()
    },
    sectors: ['1e*'],
    contact: {
      ogustAddressId: faker.random.number({ max: 8 }).toString(),
      address: {
        street: faker.address.streetAddress(),
        zipCode: faker.address.zipCode(),
        city: faker.address.city(),
        location: [faker.address.latitude(), faker.address.longitude()]
      },
      phone: faker.phone.phoneNumber()
    },
    followUp: {
      pathology: faker.lorem.word(),
      comments: faker.lorem.sentences(4),
      details: faker.lorem.paragraph(4),
      misc: faker.lorem.sentence()
    },
    payment: {
      bankAccountOwner: `${faker.name.firstName()} ${faker.name.lastName()}`,
      iban: faker.finance.iban(),
      bic: faker.finance.bic(),
      mandates: [
        {
          rum: faker.helpers.randomize(),
          _id: new ObjectID(),
        },
      ],
    },
    subscriptions: [
      {
        _id: new ObjectID(),
        service: companiesList[0].customersConfig.services[0]._id,
        versions: [{
          unitTTCRate: 12,
          estimatedWeeklyVolume: 12,
          evenings: 2,
          sundays: 1,
        }],
      }
    ],
    quotes: [{
      _id: new ObjectID(),
      subscriptions: [{
        serviceName: 'Test',
        unitTTCRate: 23,
        estimatedWeeklyVolume: 3
      }, {
        serviceName: 'Test2',
        unitTTCRate: 30,
        estimatedWeeklyVolume: 10
      }]
    }]
  },
  {
    _id: new ObjectID(),
    email: faker.internet.email(),
    identity: {
      title: faker.name.title(),
      firstname: faker.name.firstName(),
      lastname: faker.name.lastName(),
      birthDate: faker.date.past()
    },
    sectors: ['1e*'],
    contact: {
      ogustAddressId: faker.random.number({ max: 8 }).toString(),
      address: {
        street: faker.address.streetAddress(),
        zipCode: faker.address.zipCode(),
        city: faker.address.city(),
        location: [faker.address.latitude(), faker.address.longitude()]
      },
      phone: faker.phone.phoneNumber()
    },
    followUp: {
      pathology: faker.lorem.word(),
      comments: faker.lorem.sentences(4),
      details: faker.lorem.paragraph(4),
      misc: faker.lorem.sentence()
    },
    payment: {
      bankAccountOwner: `${faker.name.firstName()} ${faker.name.lastName()}`,
      iban: faker.finance.iban(),
      bic: faker.finance.bic(),
      mandates: [
        { rum: faker.helpers.randomize() },
      ],
    },
    fundings: [
      {
        _id: new ObjectID(),
        nature: ONE_TIME,
        versions: [{
          thirdPartyPayer: companiesList[0].customersConfig.thirdPartyPayers[0]._id,
          folderNumber: 'D123456',
          frequency: MONTHLY,
          startDate: moment.utc().toDate(),
          endDate: moment.utc().add(6, 'months').toDate(),
          amountTTC: 120,
          customerParticipationRate: 10,
          careDays: [2, 5],
          services: [companiesList[0].customersConfig.services[0]._id]
        }]
      }
    ]
  },
  {
    _id: new ObjectID(),
    email: faker.internet.email(),
    identity: {
      title: faker.name.title(),
      firstname: faker.name.firstName(),
      lastname: faker.name.lastName(),
      birthDate: faker.date.past()
    },
    sectors: ['1e*'],
    contact: {
      ogustAddressId: faker.random.number({ max: 8 }).toString(),
      address: {
        street: faker.address.streetAddress(),
        zipCode: faker.address.zipCode(),
        city: faker.address.city(),
        location: [faker.address.latitude(), faker.address.longitude()]
      },
      phone: faker.phone.phoneNumber()
    },
    followUp: {
      pathology: faker.lorem.word(),
      comments: faker.lorem.sentences(4),
      details: faker.lorem.paragraph(4),
      misc: faker.lorem.sentence()
    },
    payment: {
      bankAccountOwner: `${faker.name.firstName()} ${faker.name.lastName()}`,
      iban: '',
      bic: '',
      mandates: [
        { rum: faker.helpers.randomize() },
      ],
    }
  }
];

const populateCustomers = async () => {
  await Customer.remove({});
  await Customer.insertMany(customersList);
};

module.exports = { customersList, populateCustomers };
