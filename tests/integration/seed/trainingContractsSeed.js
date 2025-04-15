const { ObjectId } = require('mongodb');
const Course = require('../../../src/models/Course');
const Program = require('../../../src/models/Program');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const TrainingContract = require('../../../src/models/TrainingContract');
const { authCompany, otherCompany, companyWithoutSubscription, otherHolding } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { vendorAdmin, helper, clientAdmin, coach, trainer, trainerAndCoach } = require('../../seed/authUsersSeed');
const { INTRA, INTER_B2B, PUBLISHED, INTRA_HOLDING, GLOBAL } = require('../../../src/helpers/constants');

const steps = [{ _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 }];

const subProgram = { _id: new ObjectId(), name: 'sous-programme 1', status: PUBLISHED, steps: [steps[0]._id] };

const program = {
  _id: new ObjectId(),
  name: 'program',
  learningGoals: 'on est là',
  description: 'Ceci est une description',
  subPrograms: [subProgram._id],
};

const courseList = [
  { // 0
    _id: new ObjectId(),
    subProgram: subProgram._id,
    misc: 'first session',
    trainers: [trainer._id, trainerAndCoach._id],
    trainees: [coach._id, helper._id],
    companies: [authCompany._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    companyRepresentative: trainerAndCoach._id,
    contact: trainerAndCoach._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: subProgram._id,
    misc: 'second session',
    trainers: [trainer._id],
    trainees: [clientAdmin._id, vendorAdmin._id],
    companies: [authCompany._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    companyRepresentative: trainerAndCoach._id,
    contact: trainerAndCoach._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // 2
    _id: new ObjectId(),
    subProgram: subProgram._id,
    misc: 'third session',
    trainers: [trainer._id],
    trainees: [],
    companies: [companyWithoutSubscription._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // 3 archived course
    _id: new ObjectId(),
    subProgram: subProgram._id,
    misc: 'fourth session',
    trainers: [trainer._id],
    trainees: [coach._id],
    companies: [authCompany._id, otherCompany._id],
    type: INTER_B2B,
    operationsRepresentative: vendorAdmin._id,
    archivedAt: '2023-01-03T14:00:00.000Z',
    certificateGenerationMode: GLOBAL,
  },
  { // 4 intra_holding course
    _id: new ObjectId(),
    subProgram: subProgram._id,
    misc: 'fifth session',
    trainers: [trainer._id],
    trainees: [],
    companies: [],
    type: INTRA_HOLDING,
    maxTrainees: 8,
    holding: otherHolding._id,
    operationsRepresentative: vendorAdmin._id,
    archivedAt: '2023-01-03T14:00:00.000Z',
    certificateGenerationMode: GLOBAL,
  },
];

const trainingContractList = [
  {
    _id: new ObjectId(),
    course: courseList[1]._id,
    company: authCompany._id,
    file: { publicId: '123test', link: 'ceciestunlien' },
  },
  {
    _id: new ObjectId(),
    course: courseList[3]._id,
    company: authCompany._id,
    file: { publicId: '124test', link: 'celaestunlien' },
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    SubProgram.create(subProgram),
    Program.create(program),
    Course.create(courseList),
    Step.create(steps),
    TrainingContract.create(trainingContractList),
  ]);
};

module.exports = {
  populateDB,
  courseList,
  trainingContractList,
};
