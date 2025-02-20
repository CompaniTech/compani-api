const { ObjectId } = require('mongodb');
const { PAYMENT, DIRECT_DEBIT, INTRA, PUBLISHED, GROUP, GLOBAL } = require('../../../src/helpers/constants');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const CoursePaymentNumber = require('../../../src/models/CoursePaymentNumber');
const CoursePayment = require('../../../src/models/CoursePayment');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const { authCompany } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { trainer, vendorAdmin, auxiliary } = require('../../seed/authUsersSeed');

const steps = [{ _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 }];

const subProgramList = [{ _id: new ObjectId(), name: 'subProgram 1', steps: [steps[0]._id], status: PUBLISHED }];

const coursesList = [
  {
    _id: new ObjectId(),
    type: INTRA,
    subProgram: subProgramList[0]._id,
    misc: 'group inter',
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    expectedBillsCount: 2,
    maxTrainees: 2,
    certificateGenerationMode: GLOBAL,
  },
];

const courseBillsList = [
  { // 0
    _id: new ObjectId(),
    course: coursesList[0]._id,
    companies: [authCompany._id],
    mainFee: { price: 1200.20, count: 1, countUnit: GROUP },
    billedAt: '2022-03-06T00:00:00.000Z',
    number: 'FACT-00001',
    payer: { company: authCompany._id },
  },
  { // 1
    _id: new ObjectId(),
    course: coursesList[0]._id,
    companies: [authCompany._id],
    mainFee: { price: 1200, count: 1, description: 'Lorem ipsum', countUnit: GROUP },
    payer: { company: authCompany._id },
  },
];

const courseBillNumber = { _id: new ObjectId(), seq: 1 };

const coursePaymentNumber = {
  _id: new ObjectId(),
  seq: 1,
  nature: PAYMENT,
};

const coursePaymentsList = [
  { // 0
    _id: new ObjectId(),
    number: 'REG-00001',
    date: '2022-03-07T00:00:00.000Z',
    companies: [authCompany._id],
    courseBill: courseBillsList[0]._id,
    netInclTaxes: 1200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Course.create(coursesList),
    CourseBill.create(courseBillsList),
    CourseBillsNumber.create(courseBillNumber),
    CoursePayment.create(coursePaymentsList),
    CoursePaymentNumber.create(coursePaymentNumber),
    Step.create(steps),
    SubProgram.create(subProgramList),
  ]);
};

module.exports = {
  populateDB,
  courseBillsList,
  coursePaymentsList,
};
