const { ObjectId } = require('mongodb');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const Step = require('../../../src/models/Step');
const Activity = require('../../../src/models/Activity');
const Card = require('../../../src/models/Card');
const {
  TRANSITION,
  FLASHCARD,
  TITLE_TEXT,
  TITLE_TEXT_MEDIA,
  FILL_THE_GAPS,
  ORDER_THE_SEQUENCE,
  PUBLISHED,
} = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const cardsList = [
  { _id: new ObjectId(), template: TRANSITION, title: 'ceci est un titre' },
  { _id: new ObjectId(), template: TITLE_TEXT, title: 'ceci est un titre', text: 'test' },
  {
    _id: new ObjectId(),
    template: TITLE_TEXT_MEDIA,
    title: 'ceci est un titre',
    text: 'text',
    media: { type: 'video', link: 'lien', publicId: 'id' },
  },
  { _id: new ObjectId(), template: FLASHCARD, backText: 'ceci est un backText', text: 'ceci est un text' },
  { _id: new ObjectId(), template: TITLE_TEXT, title: 'title', text: 'text' },
  { _id: new ObjectId(), template: TRANSITION, title: 'title' },
  { _id: new ObjectId(), template: FILL_THE_GAPS },
  {
    _id: new ObjectId(),
    template: ORDER_THE_SEQUENCE,
    question: 'question ?',
    explanation: 'explanation',
    orderedAnswers: [
      { _id: new ObjectId(), text: 'rien' },
      { _id: new ObjectId(), text: 'des trucs' },
      { _id: new ObjectId(), text: 'des choses' },
    ],
  },
  { _id: new ObjectId(), template: TRANSITION, title: 'archivée' },
  { _id: new ObjectId(), template: TRANSITION, title: 'partagée' },
];

const activitiesList = [
  {
    _id: new ObjectId(),
    name: 'manger',
    type: 'quiz',
    status: 'draft',
    cards: [cardsList[0]._id, cardsList[1]._id, cardsList[2]._id, cardsList[3]._id],
  },
  { _id: new ObjectId(), name: 'bouger', type: 'lesson' },
  { _id: new ObjectId(), name: 'fumer', type: 'video', cards: [cardsList[6]._id, cardsList[7]._id] },
  {
    _id: new ObjectId(),
    name: 'publiée',
    type: 'video',
    status: PUBLISHED,
    cards: [cardsList[4]._id, cardsList[5]._id],
  },
  { // 4 - only reachable through an archived subProgram
    _id: new ObjectId(),
    name: 'archivée',
    type: 'lesson',
    cards: [cardsList[8]._id],
  },
  { // 5 - reachable through both an archived and a non-archived subProgram
    _id: new ObjectId(),
    name: 'partagée',
    type: 'lesson',
    cards: [cardsList[9]._id],
  },
];

const stepsList = [
  {
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'rouge',
    activities: [activitiesList[0]._id, activitiesList[1]._id, activitiesList[5]._id],
  },
  { // 1 - only in an archived subProgram
    _id: new ObjectId(),
    type: 'e_learning',
    name: 'noire - archivée',
    activities: [activitiesList[4]._id, activitiesList[5]._id],
  },
];

const subProgramsList = [
  { _id: new ObjectId(), name: '2_7_4124', steps: [stepsList[0]._id] },
  { // 1 - archived
    _id: new ObjectId(),
    name: 'archivé',
    steps: [stepsList[1]._id],
    archivedAt: '2026-08-01T09:00:00.000Z',
  },
];

const programsList = [
  { _id: new ObjectId(), name: 'au programme télévisé', subPrograms: [subProgramsList[0]._id] },
  { _id: new ObjectId(), name: 'programme archivé test', subPrograms: [subProgramsList[1]._id] },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Activity.create(activitiesList),
    Card.create(cardsList),
    Program.create(programsList),
    Step.create(stepsList),
    SubProgram.create(subProgramsList),
  ]);
};

module.exports = {
  populateDB,
  cardsList,
  activitiesList,
};
