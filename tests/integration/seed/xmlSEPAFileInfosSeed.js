const { ObjectId } = require('mongodb');
const {
  PAYMENT,
  DIRECT_DEBIT,
  PENDING, INTRA,
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
const Company = require('../../../src/models/Company');
const VendorCompany = require('../../../src/models/VendorCompany');

const programId = new ObjectId();

const stepList = [
  { _id: new ObjectId(), name: 'étape 1', type: ON_SITE, status: PUBLISHED, theoreticalDuration: 9000 },
  { _id: new ObjectId(), name: 'étape 2', type: REMOTE, status: PUBLISHED, theoreticalDuration: 9000 },
];

const subProgram = {
  _id: new ObjectId(),
  name: 'subProgram 1',
  program: programId,
  steps: [stepList[0]._id, stepList[1]._id],
  status: PUBLISHED,
};

const course = {
  _id: new ObjectId(),
  type: INTRA,
  maxTrainees: 8,
  subProgram: subProgram._id,
  misc: 'group 1',
  trainers: [trainer._id, trainerAndCoach._id],
  operationsRepresentative: userList[7]._id,
  contact: userList[7]._id,
  expectedBillsCount: 3,
  trainees: [userList[0]._id],
  companies: [authCompany._id],
  archivedAt: '2024-07-07T22:00:00.000Z',
  createdAt: '2018-01-07T22:00:00.000Z',
  certificateGenerationMode: GLOBAL,
  prices: [{ global: 3000, company: authCompany._id }],
};

const courseFundingOrganisation = {
  _id: new ObjectId(),
  name: 'APA Paris',
  address: '1 avenue Denfert Rochereau 75014 Paris',
};

const companyList = [
  {
    _id: new ObjectId(),
    name: 'Alenvi',
    iban: 'FR3514508000505917721779B12',
    customersFolderId: 'asfdhljk',
    auxiliariesFolderId: 'erqutop',
    prefixNumber: 34,
    folderId: '0987654321',
    directDebitsFolderId: '1234567890',
    debitMandates: [
      { rum: '12345678', signedAt: '2025-07-07T22:00:00.000Z', file: { driveId: '1345', link: 'UnLien' } },
    ],
  },
  {
    _id: new ObjectId(),
    name: 'ADAF',
    bic: 'ABCDFRPP',
    customersFolderId: 'asfdhljk',
    auxiliariesFolderId: 'erqutop',
    prefixNumber: 35,
    folderId: '0987654321',
    directDebitsFolderId: '1234567890',
    debitMandates: [
      { rum: 'abcdefghij', signedAt: '2025-07-07T22:00:00.000Z', file: { driveId: '1345', link: 'UnLien' } },
    ],
  },
];

const courseBillList = [
  { // 0
    _id: new ObjectId(),
    course: course._id,
    mainFee: { price: 1200, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { company: authCompany._id },
    billedAt: '2025-03-08T00:00:00.000Z',
    number: 'FACT-00001',
  },
  { // 1
    _id: new ObjectId(),
    course: course._id,
    mainFee: { price: 1200, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { fundingOrganisation: courseFundingOrganisation._id },
    billedAt: '2025-03-08T00:00:00.000Z',
    number: 'FACT-00002',
  },
  { // 2 - payer has no signed debit mandate
    _id: new ObjectId(),
    course: course._id,
    mainFee: { price: 1200, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { company: otherCompany._id },
    billedAt: '2025-03-08T00:00:00.000Z',
    number: 'FACT-00003',
  },
  { // 3 - payer has no BIC
    _id: new ObjectId(),
    course: course._id,
    mainFee: { price: 1200, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { company: companyList[0]._id },
    billedAt: '2025-03-08T00:00:00.000Z',
    number: 'FACT-00004',
  },
  { // 4 - payer has no IBAN
    _id: new ObjectId(),
    course: course._id,
    mainFee: { price: 1200, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { company: companyList[1]._id },
    billedAt: '2025-03-08T00:00:00.000Z',
    number: 'FACT-00005',
  },
];

const courseBillNumber = { _id: new ObjectId(), seq: 5 };

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
    courseBill: courseBillList[0]._id,
    netInclTaxes: 200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: RECEIVED,
  },
  { // 6
    _id: new ObjectId(),
    number: 'REG-00007',
    date: '2025-03-11T00:00:00.000Z',
    companies: [authCompany._id],
    courseBill: courseBillList[2]._id,
    netInclTaxes: 200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: PENDING,
  },
  { // 7
    _id: new ObjectId(),
    number: 'REG-00008',
    date: '2025-03-11T00:00:00.000Z',
    companies: [companyList[0]._id],
    courseBill: courseBillList[3]._id,
    netInclTaxes: 200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: PENDING,
  },
  { // 8
    _id: new ObjectId(),
    number: 'REG-00009',
    date: '2025-03-11T00:00:00.000Z',
    companies: [companyList[1]._id],
    courseBill: courseBillList[4]._id,
    netInclTaxes: 200,
    nature: PAYMENT,
    type: DIRECT_DEBIT,
    status: PENDING,
  },
];

const coursePaymentNumber = { _id: new ObjectId(), seq: 9, nature: PAYMENT };

const xmlSEPAFileInfos = { coursePayments: [coursePaymentList[4]._id], name: 'sepaInfos' };

const vendorCompany = {
  _id: new ObjectId(),
  name: 'Vendor Company',
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

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Company.create(companyList),
    Course.create(course),
    CourseBill.create(courseBillList),
    CourseBillsNumber.create(courseBillNumber),
    CourseFundingOrganisation.create(courseFundingOrganisation),
    CoursePayment.create(coursePaymentList),
    CoursePaymentNumber.create(coursePaymentNumber),
    Step.create(stepList),
    SubProgram.create(subProgram),
    VendorCompany.create(vendorCompany),
    XmlSEPAFileInfos.create(xmlSEPAFileInfos),
  ]);
};

module.exports = { populateDB, coursePaymentList };
