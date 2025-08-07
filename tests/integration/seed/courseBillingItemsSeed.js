const { ObjectId } = require('mongodb');
const CourseBillingItem = require('../../../src/models/CourseBillingItem');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseFundingOrganisation = require('../../../src/models/CourseFundingOrganisation');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { PUBLISHED, INTRA, GLOBAL, GROUP } = require('../../../src/helpers/constants');
const { trainer, vendorAdmin, auxiliary } = require('../../seed/authUsersSeed');
const { authCompany } = require('../../seed/authCompaniesSeed');

const courseBillingItemsList = [
  { _id: new ObjectId(), name: 'frais formateur' },
  { _id: new ObjectId(), name: 'frais de certification' },
];

const steps = [{ _id: new ObjectId(), type: 'on_site', name: 'étape', status: PUBLISHED, theoreticalDuration: 60 }];

const subProgramList = [{ _id: new ObjectId(), name: 'subProgram 1', steps: [steps[0]._id], status: PUBLISHED }];

const courseFundingOrganisation = {
  _id: new ObjectId(),
  name: 'APA Paris',
  address: '1 avenue Denfert Rochereau 75014 Paris',
};

const coursesList = [
  {
    _id: new ObjectId(),
    type: INTRA,
    maxTrainees: 12,
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
    mainFee: { price: 2500, count: 1, countUnit: GROUP },
    companies: [authCompany._id],
    payer: { fundingOrganisation: courseFundingOrganisation._id },
    billingPurchaseList: [
      {
        _id: new ObjectId(),
        billingItem: courseBillingItemsList[1]._id,
        price: 120,
        count: 1,
        description: 'restaurant',
      },
    ],
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    CourseBillingItem.create(courseBillingItemsList),
    Step.create(steps),
    SubProgram.create(subProgramList),
    CourseFundingOrganisation.create(courseFundingOrganisation),
    Course.create(coursesList),
    CourseBill.create(courseBills),
  ]);
};

module.exports = {
  populateDB,
  courseBillingItemsList,
};
