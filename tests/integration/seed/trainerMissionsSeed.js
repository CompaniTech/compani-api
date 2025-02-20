const { ObjectId } = require('mongodb');
const Course = require('../../../src/models/Course');
const Program = require('../../../src/models/Program');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const TrainerMission = require('../../../src/models/TrainerMission');
const { authCompany, otherCompany, companyWithoutSubscription } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { vendorAdmin, trainer, trainerAndCoach } = require('../../seed/authUsersSeed');
const { INTRA, INTER_B2B, PUBLISHED, GENERATION, GLOBAL } = require('../../../src/helpers/constants');

const step = { _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 };

const subProgram = { _id: new ObjectId(), name: 'sous-programme 1', status: PUBLISHED, steps: [step._id] };

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
    trainers: [trainer._id],
    trainees: [],
    companies: [authCompany._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // 1
    _id: new ObjectId(),
    subProgram: subProgram._id,
    misc: 'second session',
    trainers: [trainer._id],
    trainees: [],
    companies: [authCompany._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // 2
    _id: new ObjectId(),
    subProgram: subProgram._id,
    misc: 'third session',
    trainers: [trainerAndCoach._id],
    trainees: [],
    companies: [companyWithoutSubscription._id],
    type: INTRA,
    maxTrainees: 8,
    operationsRepresentative: vendorAdmin._id,
    expectedBillsCount: 2,
    certificateGenerationMode: GLOBAL,
  },
  { // 3
    _id: new ObjectId(),
    subProgram: subProgram._id,
    misc: 'fourth session',
    trainers: [trainer._id, trainerAndCoach._id],
    trainees: [],
    companies: [authCompany._id, otherCompany._id],
    type: INTER_B2B,
    operationsRepresentative: vendorAdmin._id,
    certificateGenerationMode: GLOBAL,
  },
];

const trainerMissionList = [
  {
    _id: new ObjectId(),
    courses: [courseList[3]._id],
    trainer: trainer._id,
    date: '2023-01-02T23:00:00.000Z',
    fee: 1200,
    createdBy: vendorAdmin._id,
    file: { publicId: '123test', link: 'ceciestunlien' },
    creationMethod: GENERATION,
  },
  {
    _id: new ObjectId(),
    courses: [courseList[0]._id],
    trainer: trainer._id,
    date: '2023-01-02T23:00:00.000Z',
    cancelledAt: '2023-01-05T23:00:00.000Z',
    fee: 1200,
    createdBy: vendorAdmin._id,
    file: { publicId: '123test', link: 'ceciestunlien' },
    creationMethod: GENERATION,
  },
  {
    _id: new ObjectId(),
    courses: [courseList[2]._id],
    trainer: trainerAndCoach._id,
    date: '2023-01-02T23:00:00.000Z',
    cancelledAt: '2023-01-05T23:00:00.000Z',
    fee: 1200,
    createdBy: vendorAdmin._id,
    file: { publicId: '123test', link: 'ceciestunlien' },
    creationMethod: GENERATION,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    SubProgram.create(subProgram),
    Program.create(program),
    Course.create(courseList),
    Step.create(step),
    TrainerMission.create(trainerMissionList),
  ]);
};

module.exports = { populateDB, courseList, trainerMissionList };
