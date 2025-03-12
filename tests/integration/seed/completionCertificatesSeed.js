const { ObjectId } = require('mongodb');
const Course = require('../../../src/models/Course');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const { INTER_B2B, PUBLISHED, MONTHLY } = require('../../../src/helpers/constants');
const { authCompany } = require('../../seed/authCompaniesSeed');
const { trainer, trainerAndCoach, noRole, trainerOrganisationManager, auxiliary } = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const stepList = [
  { _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 },
  { _id: new ObjectId(), type: 'on_site', name: 'autre étape', status: PUBLISHED, theoreticalDuration: 60 },
];

const subProgramList = [
  { _id: new ObjectId(), name: 'Subprogram 1', steps: [stepList[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'Subprogram 2', steps: [stepList[1]._id], status: PUBLISHED },
];

const courseList = [
  { // 0 Course with monthly certificateGenerationMode
    _id: new ObjectId(),
    subProgram: subProgramList[1]._id,
    type: INTER_B2B,
    trainees: [noRole._id],
    companies: [authCompany._id],
    operationsRepresentative: trainerOrganisationManager._id,
    trainers: [trainer._id, trainerAndCoach._id],
    certificateGenerationMode: MONTHLY,
  },
  { // 1 Course with monthly certificateGenerationMode
    _id: new ObjectId(),
    subProgram: subProgramList[0]._id,
    type: INTER_B2B,
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    operationsRepresentative: trainerOrganisationManager._id,
    trainers: [trainer._id],
    certificateGenerationMode: MONTHLY,
  },
];

const completionCertificateList = [
  { _id: new ObjectId(), course: courseList[0]._id, trainee: noRole._id, month: '12-2024' },
  { _id: new ObjectId(), course: courseList[0]._id, trainee: noRole._id, month: '01-2025' },
  { _id: new ObjectId(), course: courseList[0]._id, trainee: noRole._id, month: '02-2025' },
  { _id: new ObjectId(), course: courseList[1]._id, trainee: auxiliary._id, month: '01-2025' },
  { _id: new ObjectId(), course: courseList[1]._id, trainee: auxiliary._id, month: '02-2025' },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Course.create(courseList),
    CompletionCertificate.create(completionCertificateList),
    Step.create(stepList),
    SubProgram.create(subProgramList),
  ]);
};

module.exports = { populateDB, courseList };
