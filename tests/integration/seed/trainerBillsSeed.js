const { ObjectId } = require('mongodb');
const Course = require('../../../src/models/Course');
const CourseSlot = require('../../../src/models/CourseSlot');
const TrainerBill = require('../../../src/models/TrainerBill');
const Program = require('../../../src/models/Program');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const { authCompany } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { vendorAdmin, trainer, trainerAndCoach } = require('../../seed/authUsersSeed');
const { INTRA, PUBLISHED, GLOBAL, INVOICED, PAID } = require('../../../src/helpers/constants');

const step = { _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 };

const subProgram = {
  _id: new ObjectId(),
  name: 'sous-programme',
  status: PUBLISHED,
  steps: [step._id],
  priceVersions: [{ effectiveDate: '2020-01-01T00:00:00', prices: [{ step: step._id, hourlyAmount: 50 }] }],
};

const program = { _id: new ObjectId(), name: 'program', subPrograms: [subProgram._id] };

const course = {
  _id: new ObjectId(),
  subProgram: subProgram._id,
  misc: 'session',
  trainers: [trainer._id],
  trainees: [],
  companies: [authCompany._id],
  type: INTRA,
  maxTrainees: 8,
  operationsRepresentative: vendorAdmin._id,
  certificateGenerationMode: GLOBAL,
  tradeName: 'nom',
};

const trainerBillId = new ObjectId();
const paidTrainerBillId = new ObjectId();

const courseSlotsList = [
  { // 0 not invoiced, belongs to the trainer
    _id: new ObjectId(),
    startDate: '2023-01-10T09:00:00.000Z',
    endDate: '2023-01-10T11:00:00.000Z',
    course: course._id,
    step: step._id,
    trainers: [trainer._id],
  },
  { // 1 not invoiced, belongs to the trainer
    _id: new ObjectId(),
    startDate: '2023-01-11T09:00:00.000Z',
    endDate: '2023-01-11T11:00:00.000Z',
    course: course._id,
    step: step._id,
    trainers: [trainer._id],
  },
  { // 2 already invoiced
    _id: new ObjectId(),
    startDate: '2023-01-12T09:00:00.000Z',
    endDate: '2023-01-12T11:00:00.000Z',
    course: course._id,
    step: step._id,
    trainers: [trainer._id],
    trainerBillings: [{ trainer: trainer._id, trainerBill: trainerBillId }],
  },
  { // 3 belongs to another trainer
    _id: new ObjectId(),
    startDate: '2023-01-13T09:00:00.000Z',
    endDate: '2023-01-13T11:00:00.000Z',
    course: course._id,
    step: step._id,
    trainers: [trainerAndCoach._id],
  },
  { // 4 already invoiced and paid
    _id: new ObjectId(),
    startDate: '2023-01-14T09:00:00.000Z',
    endDate: '2023-01-14T11:00:00.000Z',
    course: course._id,
    step: step._id,
    trainers: [trainer._id],
    trainerBillings: [{ trainer: trainer._id, trainerBill: paidTrainerBillId }],
  },
];

const trainerBillList = [
  {
    _id: trainerBillId,
    trainer: trainer._id,
    number: 'FACT_0001',
    status: INVOICED,
    courseSlots: [courseSlotsList[2]._id],
    amount: 100,
    submittedAt: '2023-01-01T10:00:00.000Z',
  },
  {
    _id: paidTrainerBillId,
    trainer: trainer._id,
    number: 'FACT_0099',
    status: PAID,
    courseSlots: [courseSlotsList[4]._id],
    amount: 100,
    submittedAt: '2023-01-02T10:00:00.000Z',
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    SubProgram.create(subProgram),
    Program.create(program),
    Course.create(course),
    Step.create(step),
    CourseSlot.create(courseSlotsList),
    TrainerBill.create(trainerBillList),
  ]);
};

module.exports = { populateDB, course, courseSlotsList, trainerBillId, paidTrainerBillId };
