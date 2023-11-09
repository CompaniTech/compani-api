const { ObjectId } = require('mongodb');
const { INTRA, INTER_B2B, PUBLISHED } = require('../../../src/helpers/constants');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const Course = require('../../../src/models/Course');
const CourseCreditNote = require('../../../src/models/CourseCreditNote');
const CourseCreditNoteNumber = require('../../../src/models/CourseCreditNoteNumber');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const VendorCompany = require('../../../src/models/VendorCompany');
const Program = require('../../../src/models/Program');
const { authCompany, otherCompany } = require('../../seed/authCompaniesSeed');
const { trainer, vendorAdmin, auxiliary } = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const steps = [{ _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 }];

const subProgramList = [{ _id: new ObjectId(), name: 'subProgram 1', steps: [steps[0]._id], status: PUBLISHED }];

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

const coursesList = [
  { // 0 - linked to bill 2 3 4
    _id: new ObjectId(),
    type: INTER_B2B,
    subProgram: subProgramList[0]._id,
    misc: 'group inter',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [auxiliary._id],
    companies: [authCompany._id, otherCompany._id],
  },
  { // 1 - linked to bill 0 1
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group intra',
    trainer: trainer._id,
    salesRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    expectedBillsCount: 2,
  },
];

const courseBillsList = [
  { // 0 valid bill
    _id: new ObjectId(),
    course: coursesList[1]._id,
    companies: [authCompany._id],
    payer: { company: authCompany._id },
    mainFee: { price: 44.88, count: 2 },
    billedAt: '2022-04-07T00:00:00.000Z',
    number: 'FACT-00001',
  },
  { // 1 draft bill
    _id: new ObjectId(),
    course: coursesList[1]._id,
    companies: [authCompany._id],
    payer: { company: authCompany._id },
    mainFee: { price: 65, count: 3, description: 'Salut à toi' },
  },
  { // 2 bill cancelled by credit note
    _id: new ObjectId(),
    course: coursesList[0]._id,
    companies: [authCompany._id],
    payer: { company: authCompany._id },
    mainFee: { price: 73, count: 1 },
    billedAt: '2022-05-30T10:00:00.000Z',
    number: 'FACT-00002',
  },
  { // 3 bill cancelled by credit note (otherCompany but autCompany as payer)
    _id: new ObjectId(),
    course: coursesList[0]._id,
    companies: [otherCompany._id],
    payer: { company: authCompany._id },
    mainFee: { price: 73, count: 1 },
    billedAt: '2022-05-30T10:00:00.000Z',
    number: 'FACT-00003',
  },
  { // 4 bill cancelled by credit note (otherCompany)
    _id: new ObjectId(),
    course: coursesList[0]._id,
    companies: [otherCompany._id],
    payer: { company: otherCompany._id },
    mainFee: { price: 73, count: 1 },
    billedAt: '2022-05-30T10:00:00.000Z',
    number: 'FACT-00004',
  },
];

const courseBillNumber = { _id: new ObjectId(), seq: 4 };

const courseCreditNote = [
  {
    _id: new ObjectId(),
    number: 'AV-00001',
    courseBill: courseBillsList[2]._id,
    date: '2022-06-08T10:00:00.000Z',
    misc: 'wesh',
    companies: [authCompany._id],
  },
  {
    _id: new ObjectId(),
    number: 'AV-00002',
    courseBill: courseBillsList[3]._id,
    date: '2022-06-08T10:00:00.000Z',
    misc: 'wesh',
    companies: [otherCompany._id],
  },
  {
    _id: new ObjectId(),
    number: 'AV-00003',
    courseBill: courseBillsList[4]._id,
    date: '2022-06-08T10:00:00.000Z',
    misc: 'wesh',
    companies: [otherCompany._id],
  },
];

const courseCreditNoteNumber = { _id: new ObjectId(), seq: 3 };

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    CourseBill.create(courseBillsList),
    CourseBillsNumber.create(courseBillNumber),
    Course.create(coursesList),
    CourseCreditNote.create(courseCreditNote),
    CourseCreditNoteNumber.create(courseCreditNoteNumber),
    Program.create(programList),
    Step.create(steps),
    SubProgram.create(subProgramList),
    VendorCompany.create(vendorCompany),
  ]);
};

module.exports = {
  populateDB,
  courseBillsList,
  courseCreditNote,
};
