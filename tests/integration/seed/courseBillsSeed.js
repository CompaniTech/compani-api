const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { INTRA, INTER_B2B, WEBAPP } = require('../../../src/helpers/constants');
const Company = require('../../../src/models/Company');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillingItem = require('../../../src/models/CourseBillingItem');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const CourseCreditNote = require('../../../src/models/CourseCreditNote');
const CourseFundingOrganisation = require('../../../src/models/CourseFundingOrganisation');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const VendorCompany = require('../../../src/models/VendorCompany');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const { auxiliaryRoleId } = require('../../seed/authRolesSeed');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { trainer, vendorAdmin, auxiliary } = require('../../seed/authUsersSeed');

const subProgramList = [{ _id: new ObjectId(), name: 'subProgram 1', steps: [] }];

const programList = [{ _id: new ObjectId(), name: 'Program 1', subPrograms: [subProgramList[0]._id] }];

const vendorCompany = {
  _id: new ObjectId(),
  name: 'Vendor Company',
  siret: '12345678901234',
  activityDeclarationNumber: '13736343575',
  address: {
    fullAddress: '32 Rue du Loup 33000 Bordeaux',
    street: '32 Rue du Loup',
    city: 'Bordeaux',
    zipCode: '33000',
    location: { type: 'Point', coordinates: [-0.573054, 44.837914] },
  },
};

const companyWithoutAddress = {
  _id: ObjectId(),
  name: 'Structure sans adresse',
  prefixNumber: 45,
  folderId: '0987654321',
  directDebitsFolderId: '1234567890',
  customersFolderId: 'asfdhljk',
  auxiliariesFolderId: 'erqutop',
};

const traineeFromAuthCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Fred', lastname: 'Astaire' },
  local: { email: 'traineeAuthCompany@alenvi.io' },
  role: { client: auxiliaryRoleId },
  contact: { phone: '0734856751' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const traineeFromOtherCompany = {
  _id: new ObjectId(),
  identity: { firstname: 'Tom', lastname: 'de Savoie' },
  local: { email: 'tomdesavoie@alenvi.io' },
  role: { client: auxiliaryRoleId },
  contact: { phone: '0734856752' },
  refreshToken: uuidv4(),
  origin: WEBAPP,
};

const userList = [traineeFromAuthCompany, traineeFromOtherCompany];

const userCompanies = [
  // old inactive user company
  {
    _id: new ObjectId(),
    user: traineeFromAuthCompany._id,
    company: companyWithoutSubscription._id,
    startDate: '2022-01-01T23:00:00.000Z',
    endDate: '2022-11-30T23:00:00.000Z',
  },
  { _id: new ObjectId(), company: authCompany._id, user: traineeFromAuthCompany._id },
  { _id: new ObjectId(), company: otherCompany._id, user: traineeFromOtherCompany._id },
];

const coursesList = [
  { // 0 - linked to bill 0 and 8, linked to creditNote 1, expectedBillsCount is 1
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 1',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [auxiliary._id],
    expectedBillsCount: 1,
    companies: [authCompany._id],
  },
  { // 1 - linked to bill 1 and 7, linked to creditNote 0, expectedBillsCount is 2
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 2',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [auxiliary._id],
    expectedBillsCount: 2,
    companies: [authCompany._id],
  },
  { // 2 - without bill, expectedBillsCount is 1
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 3',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [traineeFromOtherCompany._id],
    expectedBillsCount: 1,
    companies: [otherCompany._id],
  },
  { // 3 - linked to bill 2
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 4',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [traineeFromAuthCompany._id],
    expectedBillsCount: 1,
    companies: [authCompany._id],
  },
  { // 4 - linked to bill 3
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 5',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [traineeFromAuthCompany._id],
    expectedBillsCount: 1,
    companies: [authCompany._id],
  },
  { // 5 - linked to bill 4
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 6',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [traineeFromAuthCompany._id],
    expectedBillsCount: 1,
    companies: [authCompany._id],
  },
  { // 6 - linked to bill 5
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 7',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [],
    expectedBillsCount: 1,
    companies: [companyWithoutAddress._id],
  },
  { // 7 - linked to bill 6
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 7',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [],
    expectedBillsCount: 1,
    companies: [otherCompany._id],
  },
  { // 8 - linked to bill 7
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group 7',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [],
    expectedBillsCount: 1,
    companies: [otherCompany._id],
  },
  { // 9 - inter without bill
    _id: new ObjectId(),
    type: INTER_B2B,
    subProgram: subProgramList[0]._id,
    misc: 'group 8',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [traineeFromOtherCompany._id],
    companies: [otherCompany._id],
  },
  { // 10 - without bill, expectedBillsCount is 0
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    companies: [otherCompany._id],
    subProgram: subProgramList[0]._id,
    misc: 'group 7',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [traineeFromOtherCompany._id],
    expectedBillsCount: 0,
  },
];

const courseFundingOrganisationList = [
  { _id: new ObjectId(), name: 'APA Paris', address: '1 avenue Denfert Rochereau 75014 Paris' },
  { _id: new ObjectId(), name: 'APA Lyon', address: '1 avenue Denfert Rochereau 69002 Lyon' },
];

const billingItemList = [
  { _id: new ObjectId(), name: 'frais formateur' },
  { _id: new ObjectId(), name: 'forfait salle' },
  { _id: new ObjectId(), name: 'petit déjeuner' },
];

const courseBillNumber = { _id: new ObjectId(), seq: 4 };

const courseBillsList = [
  { // 0
    _id: new ObjectId(),
    course: coursesList[0]._id,
    company: authCompany._id,
    mainFee: { price: 120, count: 1 },
    payer: { company: authCompany._id },
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 90, count: 1 },
      { _id: new ObjectId(), billingItem: billingItemList[1]._id, price: 400, count: 1 },
    ],
  },
  { // 1 - with funder and mainFee description
    _id: new ObjectId(),
    course: coursesList[1]._id,
    company: authCompany._id,
    mainFee: { price: 120, count: 1, description: 'Lorem ipsum' },
    payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
  },
  { // 2 - already billed without funder
    _id: new ObjectId(),
    course: coursesList[3]._id,
    company: authCompany._id,
    payer: { company: authCompany._id },
    mainFee: { price: 120, count: 1, description: 'Lorem ipsum' },
    billedAt: '2022-03-07T00:00:00.000Z',
    number: 'FACT-00001',
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 9, count: 1, description: 'BN du goûter' },
    ],
  },
  { // 3 - purchase with description
    _id: new ObjectId(),
    course: coursesList[4]._id,
    company: authCompany._id,
    payer: { company: authCompany._id },
    mainFee: { price: 10, count: 1 },
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 12, count: 7, description: 'soupe du soir' },
    ],
  },
  { // 4 - already billed with funder
    _id: new ObjectId(),
    course: coursesList[5]._id,
    company: authCompany._id,
    mainFee: { price: 200, count: 2, description: 'Salut' },
    billedAt: '2022-04-07T00:00:00.000Z',
    number: 'FACT-00002',
    payer: { fundingOrganisation: courseFundingOrganisationList[0]._id },
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 9, count: 1 },
    ],
  },
  { // 5 - client company without address
    _id: new ObjectId(),
    course: coursesList[6]._id,
    company: companyWithoutAddress._id,
    payer: { company: companyWithoutAddress._id },
    mainFee: { price: 200, count: 2, description: 'yoyo' },
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 9, count: 1 },
    ],
  },
  { // 6 - payer is other company
    _id: new ObjectId(),
    course: coursesList[7]._id,
    company: otherCompany._id,
    payer: { company: authCompany._id },
    mainFee: { price: 200, count: 2, description: 'yoyo' },
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 9, count: 1 },
    ],
    billedAt: '2022-04-07T00:00:00.000Z',
    number: 'FACT-00003',
  },
  { // 7 - payer and company is other company
    _id: new ObjectId(),
    course: coursesList[8]._id,
    company: otherCompany._id,
    payer: { company: otherCompany._id },
    mainFee: { price: 200, count: 2, description: 'yoyo' },
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 9, count: 1 },
    ],
    billedAt: '2022-04-07T00:00:00.000Z',
    number: 'FACT-00004',
  },
  { // 8
    _id: new ObjectId(),
    course: coursesList[1]._id,
    company: authCompany._id,
    payer: { company: authCompany._id },
    mainFee: { price: 200, count: 2, description: 'yoyo' },
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 9, count: 1 },
    ],
    billedAt: '2022-04-07T00:00:00.000Z',
    number: 'FACT-00005',
  },
  { // 9
    _id: new ObjectId(),
    course: coursesList[0]._id,
    company: authCompany._id,
    payer: { company: authCompany._id },
    mainFee: { price: 200, count: 2, description: 'yoyo' },
    billingPurchaseList: [
      { _id: new ObjectId(), billingItem: billingItemList[0]._id, price: 9, count: 1 },
    ],
    billedAt: '2022-04-07T00:00:00.000Z',
    number: 'FACT-00006',
  },
];

const courseCreditNoteList = [
  {
    _id: new ObjectId(),
    number: 'AV-00001',
    courseBill: courseBillsList[8]._id,
    date: '2022-04-15T10:00:00.000Z',
    misc: 'wesh',
    company: authCompany._id,
  },
  {
    _id: new ObjectId(),
    number: 'AV-00002',
    courseBill: courseBillsList[9]._id,
    date: '2022-04-15T10:00:00.000Z',
    misc: 'wesh',
    company: authCompany._id,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Company.create(companyWithoutAddress),
    Course.create(coursesList),
    CourseBill.create(courseBillsList),
    CourseBillingItem.create(billingItemList),
    CourseBillsNumber.create(courseBillNumber),
    CourseCreditNote.create(courseCreditNoteList),
    CourseFundingOrganisation.create(courseFundingOrganisationList),
    Program.create(programList),
    SubProgram.create(subProgramList),
    VendorCompany.create(vendorCompany),
    User.create(userList),
    UserCompany.create(userCompanies),
  ]);
};

module.exports = {
  populateDB,
  courseBillsList,
  courseFundingOrganisationList,
  coursesList,
  billingItemList,
};
