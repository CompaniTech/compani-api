const { ObjectId } = require('mongodb');
const {
  PAYMENT,
  DIRECT_DEBIT,
  PENDING, INTRA,
  INTER_B2B,
  ON_SITE,
  PUBLISHED,
  REMOTE,
  GLOBAL,
  GROUP,
  BANK_TRANSFER,
  XML_GENERATED,
  RECEIVED,
} = require('../../../src/helpers/constants');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const CourseFundingOrganisation = require('../../../src/models/CourseFundingOrganisation');
const CoursePayment = require('../../../src/models/CoursePayment');
const CoursePaymentNumber = require('../../../src/models/CoursePaymentNumber');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const XmlSEPAFileInfos = require('../../../src/models/XmlSEPAFileInfos');
const { authCompany, otherCompany } = require('../../seed/authCompaniesSeed');
const { trainerAndCoach, trainer, userList } = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const programIdList = [new ObjectId(), new ObjectId()];

const stepList = [
  { _id: new ObjectId(), name: 'étape 1', type: ON_SITE, status: PUBLISHED, theoreticalDuration: 9000 },
  { _id: new ObjectId(), name: 'étape 2', type: REMOTE, status: PUBLISHED, theoreticalDuration: 9000 },
  { _id: new ObjectId(), name: 'étape 3', type: ON_SITE, status: PUBLISHED, theoreticalDuration: 9000 },
];

const subProgramList = [
  {
    _id: new ObjectId(),
    name: 'subProgram 1',
    program: programIdList[0],
    steps: [stepList[0]._id, stepList[1]._id],
    status: PUBLISHED,
  },
  {
    _id: new ObjectId(),
    name: 'subProgram 2',
    program: programIdList[1],
    steps: [stepList[0]._id, stepList[2]._id],
    status: PUBLISHED,
  },
];

const coursesList = [
  { // 0 with 1 bill
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 1',
    trainers: [trainer._id, trainerAndCoach._id],
    operationsRepresentative: userList[7]._id,
    contact: userList[7]._id,
    expectedBillsCount: 1,
    trainees: [userList[0]._id],
    companies: [authCompany._id],
    archivedAt: '2024-07-07T22:00:00.000Z',
    createdAt: '2018-01-07T22:00:00.000Z',
    certificateGenerationMode: GLOBAL,
    prices: [{ global: 3000, company: authCompany._id }],
  },
  { // 1 with 1 bill
    _id: new ObjectId(),
    type: INTER_B2B,
    subProgram: subProgramList[1]._id,
    trainers: [trainer._id],
    operationsRepresentative: userList[7]._id,
    contact: userList[7]._id,
    trainees: [userList[14]._id],
    estimatedStartDate: '2019-01-01T08:00:00.000Z',
    companies: [authCompany._id, otherCompany._id],
    createdAt: '2018-01-07T22:00:00.000Z',
    certificateGenerationMode: GLOBAL,
    prices: [
      { global: 2500, trainerFees: 250, company: authCompany._id },
      { global: 2500, company: otherCompany._id },
    ],
  },
];

const courseFundingOrganisation = {
  _id: new ObjectId(),
  name: 'APA Paris',
  address: '1 avenue Denfert Rochereau 75014 Paris',
};

const courseBillList = [
  { // 0
    _id: new ObjectId(),
    course: coursesList[0]._id,
    mainFee: { price: 1200, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { company: authCompany._id },
    billedAt: '2025-03-08T00:00:00.000Z',
    number: 'FACT-00001',
  },
  { // 1
    _id: new ObjectId(),
    course: coursesList[1]._id,
    mainFee: { price: 1200, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { fundingOrganisation: courseFundingOrganisation._id },
    billedAt: '2025-03-08T00:00:00.000Z',
    number: 'FACT-00003',
  },
];

const courseBillNumber = { _id: new ObjectId(), seq: 2 };

const coursePaymentList = [
  { // 0
    _id: new ObjectId(),
    number: 'REG-00001',
    date: '2025-03-09T00:00:00.000Z',
    companies: [authCompany._id],
    courseBill: courseBillList[0]._id,
    netInclTaxes: 1200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: PENDING,
  },
  { // 1
    _id: new ObjectId(),
    number: 'REG-00002',
    date: '2025-06-09T00:00:00.000Z',
    companies: [authCompany._id],
    courseBill: courseBillList[0]._id,
    netInclTaxes: 400,
    nature: PAYMENT,
    type: BANK_TRANSFER,
    status: PENDING,
  },
  { // 2
    _id: new ObjectId(),
    number: 'REG-00003',
    date: '2025-06-11T00:00:00.000Z',
    companies: [authCompany._id],
    courseBill: courseBillList[0]._id,
    netInclTaxes: 200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: PENDING,
  },
  { // 3
    _id: new ObjectId(),
    number: 'REG-00004',
    date: '2025-03-11T00:00:00.000Z',
    companies: [authCompany._id],
    courseBill: courseBillList[1]._id,
    netInclTaxes: 200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: PENDING,
  },
  { // 4 coursePayment linked to xmlSEPAFileInfos
    _id: new ObjectId(),
    number: 'REG-00005',
    date: '2025-06-11T00:00:00.000Z',
    companies: [authCompany._id],
    courseBill: courseBillList[0]._id,
    netInclTaxes: 200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: XML_GENERATED,
  },
  { // 5
    _id: new ObjectId(),
    number: 'REG-00006',
    date: '2025-03-11T00:00:00.000Z',
    companies: [authCompany._id],
    courseBill: courseBillList[1]._id,
    netInclTaxes: 200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: RECEIVED,
  },
];

const coursePaymentNumber = { _id: new ObjectId(), seq: 6, nature: PAYMENT };

const xmlSEPAFileInfos = { coursePayments: [coursePaymentList[4]._id], name: 'sepaInfos' };

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Course.create(coursesList),
    CourseBill.create(courseBillList),
    CourseBillsNumber.create(courseBillNumber),
    CourseFundingOrganisation.create(courseFundingOrganisation),
    CoursePayment.create(coursePaymentList),
    CoursePaymentNumber.create(coursePaymentNumber),
    Step.create(stepList),
    SubProgram.create(subProgramList),
    XmlSEPAFileInfos.create(xmlSEPAFileInfos),
  ]);
};

module.exports = { populateDB, coursePaymentList };
