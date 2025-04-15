const { ObjectId } = require('mongodb');
const CourseBill = require('../../../src/models/CourseBill');
const Course = require('../../../src/models/Course');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const CourseFundingOrganisation = require('../../../src/models/CourseFundingOrganisation');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { authCompany } = require('../../seed/authCompaniesSeed');
const { INTRA, PUBLISHED, GROUP, GLOBAL } = require('../../../src/helpers/constants');
const { trainer, vendorAdmin, auxiliary } = require('../../seed/authUsersSeed');

const courseFundingOrganisationsList = [
  { _id: new ObjectId(), name: 'APA Paris', address: '1 avenue Denfert Rochereau 75014 Paris' },
  { _id: new ObjectId(), name: 'APA Gironde', address: '30 cours de la Marne 33000 Bordeaux' },
];

const steps = [{ _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 }];

const subProgramList = [{ _id: new ObjectId(), name: 'subProgram 1', steps: [steps[0]._id], status: PUBLISHED }];

const coursesList = [
  {
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 8,
    subProgram: subProgramList[0]._id,
    misc: 'group intra',
    trainers: [trainer._id],
    operationsRepresentative: vendorAdmin._id,
    contact: vendorAdmin._id,
    trainees: [auxiliary._id],
    companies: [authCompany._id],
    expectedBillsCount: 1,
    certificateGenerationMode: GLOBAL,
  },
];
const courseBills = [
  {
    _id: new ObjectId(),
    course: coursesList[0]._id,
    mainFee: { price: 1000, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { fundingOrganisation: courseFundingOrganisationsList[1]._id },
    billingPurchaseList: [],
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    CourseFundingOrganisation.create(courseFundingOrganisationsList),
    CourseBill.create(courseBills),
    Course.create(coursesList),
    Step.create(steps),
    SubProgram.create(subProgramList),
  ]);
};

module.exports = {
  populateDB,
  courseFundingOrganisationsList,
};
