const { ObjectId } = require('mongodb');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const Step = require('../../../src/models/Step');
const Activity = require('../../../src/models/Activity');
const Card = require('../../../src/models/Card');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const cardsList = [
  { _id: new ObjectId(), template: 'transition', title: 'do mi sol do' },
  { _id: new ObjectId(), template: 'fill_the_gaps' },
];

const activitiesList = [
  { _id: new ObjectId(), type: 'lesson', name: 'chanter', cards: [cardsList[0]] },
  { _id: new ObjectId(), type: 'video', name: 'gater le coin', cards: [cardsList[0]] },
  { _id: new ObjectId(), type: 'lesson', name: 'douche', cards: [cardsList[1]] },
  { _id: new ObjectId(), type: 'lesson', name: 'published activity', status: 'published', cards: [cardsList[0]] },
  { _id: new ObjectId(), type: 'lesson', name: 'activité liée à un sous-programme archivé', cards: [cardsList[0]] },
];

const stepsList = [
  { _id: new ObjectId(), type: 'on_site', name: 'etape 1', activities: [] },
  {
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'etape 2',
    activities: [activitiesList[0]._id, activitiesList[2]._id],
  },
  { _id: new ObjectId(), type: 'e_learning', name: 'etape 3', activities: [] },
  {
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'etape 4',
    status: 'published',
    activities: [activitiesList[3]._id],
    theoreticalDuration: 9000,
  },
  { _id: new ObjectId(), type: 'on_site', name: 'etape 5 - sans sous-prog', activities: [] },
  { // 5 - only in an archived subprogram
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'etape 6 - sous-programme archivé',
    activities: [activitiesList[4]._id],
  },
  { // 6 - shared between an archived and a non-archived subprogram, should stay editable
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'etape 7 - partagée entre sous-programme archivé et actif',
    activities: [activitiesList[1]._id],
  },
];

const subProgramList = [
  { _id: new ObjectId(), name: 'subProgram 1', steps: [stepsList[0]._id, stepsList[1]._id] },
  { _id: new ObjectId(), name: 'subProgram 2', steps: [stepsList[0]._id, stepsList[2]._id] },
  { _id: new ObjectId(), name: 'subProgram 3', steps: [stepsList[2]._id, stepsList[3]._id, stepsList[6]._id] },
  {
    _id: new ObjectId(),
    name: 'subProgram 4 - archivé',
    steps: [stepsList[5]._id, stepsList[6]._id],
    archivedAt: '2026-08-01T09:00:00.000Z',
  },
];

const programsList = [
  { _id: new ObjectId(), name: 'program 1', subPrograms: [subProgramList[0]._id, subProgramList[1]._id] },
  { _id: new ObjectId(), name: 'program 2', subPrograms: [subProgramList[2]._id, subProgramList[3]._id] },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Program.create(programsList),
    SubProgram.create(subProgramList),
    Step.create(stepsList),
    Activity.create(activitiesList),
    Card.create(cardsList),
  ]);
};

module.exports = {
  populateDB,
  programsList,
  stepsList,
  activitiesList,
  cardsList,
};
