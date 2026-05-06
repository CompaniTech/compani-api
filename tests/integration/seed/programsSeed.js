const { ObjectId } = require('mongodb');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const Step = require('../../../src/models/Step');
const Activity = require('../../../src/models/Activity');
const Category = require('../../../src/models/Category');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const Card = require('../../../src/models/Card');
const Course = require('../../../src/models/Course');
const { userList, vendorAdmin, coach } = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { INTER_B2C, PUBLISHED } = require('../../../src/helpers/constants');

const cards = [
  { _id: new ObjectId(), template: 'transition', title: 'skusku' },
  { _id: new ObjectId(), template: 'transition' },
];

const activitiesList = [
  { _id: new ObjectId(), name: 'activité 1', type: 'sharing_experience', cards: [cards[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'activité 2', type: 'quiz', cards: [cards[1]._id] },
  { _id: new ObjectId(), name: 'activité 3', type: 'quiz', cards: [] },
];

const categoriesList = [
  { _id: new ObjectId(), name: 'ma première catégorie' },
  { _id: new ObjectId(), name: 'ma seconde catégorie' },
];

const activityHistoriesList = [
  { _id: new ObjectId(), user: vendorAdmin._id, activity: activitiesList[0]._id },
];

const stepsList = [
  {
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'étape 1',
    activities: [activitiesList[0]._id],
    status: PUBLISHED,
    theoreticalDuration: 60,
  },
  { _id: new ObjectId(), type: 'e_learning', name: 'étape 2', activities: [activitiesList[0]._id] },
  { _id: new ObjectId(), type: 'on_site', name: 'étape 3', activities: [] },
  { _id: new ObjectId(), type: 'e_learning', name: 'étape 4 - sans act', activities: [] },
  { _id: new ObjectId(), type: 'e_learning', name: 'étape 5 - tout valide', activities: [activitiesList[0]._id] },
  { _id: new ObjectId(), type: 'e_learning', name: 'étape 6 - carte non valide', activities: [activitiesList[1]._id] },
  { _id: new ObjectId(), type: 'e_learning', name: 'étape 7 - sans carte', activities: [activitiesList[2]._id] },
  { _id: new ObjectId(), type: 'remote', name: 'étape 8', activities: [] },
];

const subProgramsList = [
  { _id: new ObjectId(), name: 'sous-programme 1', steps: [stepsList[2]._id] },
  { _id: new ObjectId(), name: 'sous-programme 2', steps: [stepsList[0]._id], status: PUBLISHED },
  { _id: new ObjectId(), name: 'sous-programme 3', steps: [stepsList[1]._id] },
  {
    _id: new ObjectId(),
    name: 'sous-programme 4',
    steps: [
      stepsList[2]._id,
      stepsList[3]._id,
      stepsList[4]._id,
      stepsList[5]._id,
      stepsList[6]._id,
      stepsList[7]._id,
    ],
  },
];

const programsList = [
  {
    _id: new ObjectId(),
    name: 'program',
    description: 'Je suis un super programme',
    learningGoals: 'Tellement cool ce qu\'on va apprendre ensemble',
    subPrograms: [subProgramsList[0]._id],
    image: { link: 'bonjour', publicId: 'au revoir' },
    categories: [categoriesList[0]._id],
    tradeNames: [{ _id: new ObjectId(), name: 'ma marque' }],
  },
  {
    _id: new ObjectId(),
    name: 'training program',
    subPrograms: [subProgramsList[2]._id],
    testers: [coach._id],
  },
  {
    _id: new ObjectId(),
    name: 'Je suis un programme eLearning',
    description: 'Vous apprendrez plein de choses',
    subPrograms: [subProgramsList[1]._id],
  },
  { _id: new ObjectId(), name: 'programme a vérifier', subPrograms: [subProgramsList[3]._id] },
];

const course = {
  _id: new ObjectId(),
  subProgram: subProgramsList[1]._id,
  type: INTER_B2C,
  format: 'strictly_e_learning',
  trainees: [userList[0]._id, vendorAdmin._id],
  tradeName: 'nom',
};

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    SubProgram.create(subProgramsList),
    Program.create(programsList),
    Step.create(stepsList),
    Activity.create(activitiesList),
    Category.create(categoriesList),
    ActivityHistory.create(activityHistoriesList),
    Card.create(cards),
    Course.create(course),
  ]);
};

module.exports = {
  populateDB,
  programsList,
  subProgramsList,
  course,
  activitiesList,
  activityHistoriesList,
  categoriesList,
  vendorAdmin,
};
