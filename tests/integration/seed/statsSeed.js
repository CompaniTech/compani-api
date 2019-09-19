const { ObjectID } = require('mongodb');
const User = require('../../../models/User');
const Customer = require('../../../models/Customer');
const Service = require('../../../models/Service');
const Event = require('../../../models/Event');
const Sector = require('../../../models/Sector');
const Contract = require('../../../models/Contract');
const { rolesList, populateDBForAuthentification } = require('./authentificationSeed');

const sectorList = [{
  _id: new ObjectID(),
}];

const contractList = [{
  _id: new ObjectID(),
}];

const userList = [
  {
    _id: new ObjectID(),
    identity: { firstname: 'Auxiliary', lastname: 'White' },
    local: { email: 'white@alenvi.io', password: '123456' },
    role: rolesList.find(role => role.name === 'auxiliary')._id,
    inactivityDate: null,
    sector: sectorList[0]._id,
    contracts: [contractList[0]._id],
  },
];

const serviceList = [{
  _id: new ObjectID(),
  nature: 'hourly',
}];

const customerList = [
  {
    _id: new ObjectID(),
    subscriptions: [{
      _id: new ObjectID(),
      service: serviceList[0]._id,
    }],
    identity: { lastname: 'Giscard d\'Estaing' },
  },
];

const eventList = [
  {
    _id: new ObjectID(),
    type: 'intervention',
    customer: customerList[0]._id,
    subscription: customerList[0].subscriptions[0]._id,
    auxiliary: userList[0]._id,
    startDate: '2019-07-01T08:00:00.000+00:00',
    endDate: '2019-07-01T09:00:00.000+00:00',
  },
  {
    _id: new ObjectID(),
    type: 'intervention',
    customer: customerList[0]._id,
    subscription: customerList[0].subscriptions[0]._id,
    auxiliary: userList[0]._id,
    startDate: '2019-07-02T09:00:00.000+00:00',
    endDate: '2019-07-02T10:30:00.000+00:00',
  },
];

const populateDB = async () => {
  await User.deleteMany({});
  await Customer.deleteMany({});
  await Service.deleteMany({});
  await Event.deleteMany({});
  await Sector.deleteMany({});
  await Contract.deleteMany({});

  await populateDBForAuthentification();
  for (const user of userList) {
    await new User(user).save();
  }
  await Customer.insertMany(customerList);
  await Service.insertMany(serviceList);
  await Event.insertMany(eventList);
  await Sector.insertMany(sectorList);
  await Contract.insertMany(contractList);
};

module.exports = {
  customerList,
  populateDB,
};
