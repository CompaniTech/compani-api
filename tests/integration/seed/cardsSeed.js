const { ObjectId } = require('mongodb');
const Card = require('../../../src/models/Card');
const Activity = require('../../../src/models/Activity');
const Questionnaire = require('../../../src/models/Questionnaire');
const {
  TRANSITION,
  TITLE_TEXT_MEDIA,
  TITLE_TEXT,
  TEXT_MEDIA,
  FLASHCARD,
  FILL_THE_GAPS,
  MULTIPLE_CHOICE_QUESTION,
  SINGLE_CHOICE_QUESTION,
  ORDER_THE_SEQUENCE,
  SURVEY,
  OPEN_QUESTION,
  QUESTION_ANSWER,
  PUBLISHED,
} = require('../../../src/helpers/constants');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const cardsList = [
  // 0
  { _id: new ObjectId(), template: TRANSITION, title: 'Lala' },
  // 1
  { _id: new ObjectId(), template: TITLE_TEXT_MEDIA, media: { type: 'video', link: 'link', publicId: 'publicId' } },
  // 2
  { _id: new ObjectId(), template: TITLE_TEXT },
  // 3
  { _id: new ObjectId(), template: TEXT_MEDIA },
  // 4
  { _id: new ObjectId(), template: FLASHCARD, text: 'text', backText: 'back text' },
  { // 5
    _id: new ObjectId(),
    template: FILL_THE_GAPS,
    gapAnswers: [
      { _id: new ObjectId(), text: 'ase', isCorrect: false },
      { _id: new ObjectId(), text: 'énué', isCorrect: false },
      { _id: new ObjectId(), text: 'test', isCorrect: true },
    ],
  },
  { // 6
    _id: new ObjectId(),
    template: MULTIPLE_CHOICE_QUESTION,
    qcAnswers: [
      { _id: new ObjectId(), isCorrect: false, text: 'mex' },
      { _id: new ObjectId(), isCorrect: true, text: 'Avery' },
      { _id: new ObjectId(), isCorrect: true, text: 'erne' },
      { _id: new ObjectId(), isCorrect: true, text: 'j\'ai pas d\'autres jeux de mots' },
    ],
    question: 'what is the question ?',
    explanation: 'explanation',
  },
  { // 7
    _id: new ObjectId(),
    template: SINGLE_CHOICE_QUESTION,
    qcAnswers: [
      { _id: new ObjectId(), text: 'uel', isCorrect: true },
      { _id: new ObjectId(), text: 'ile', isCorrect: false },
      { _id: new ObjectId(), text: 'o', isCorrect: false },
      { _id: new ObjectId(), text: 'test', isCorrect: false },
    ],
    question: 'what is the question ?',
  },
  { // 8
    _id: new ObjectId(),
    template: ORDER_THE_SEQUENCE,
    question: 'question ?',
    explanation: 'explanation',
    orderedAnswers: [
      { _id: new ObjectId(), text: 'rien' },
      { _id: new ObjectId(), text: 'des trucs' },
      { _id: new ObjectId(), text: 'encore des trucs' },
    ],
  },
  // 9
  { _id: new ObjectId(), template: SURVEY, labels: { 1: 'first', 5: 'last' }, question: 'question ?' },
  // 10
  { _id: new ObjectId(), template: OPEN_QUESTION },
  { // 11
    _id: new ObjectId(),
    template: QUESTION_ANSWER,
    qcAnswers: [{ text: 'hallo', _id: new ObjectId() }, { text: 'shalom', _id: new ObjectId() }],
  },
  { // 12
    _id: new ObjectId(),
    template: QUESTION_ANSWER,
    qcAnswers: [
      { text: 'bye bye', _id: new ObjectId() },
      { text: 'bye bye', _id: new ObjectId() },
      { text: 'bye bye', _id: new ObjectId() },
      { text: 'bye bye', _id: new ObjectId() },
    ],
  },
  { // 13
    _id: new ObjectId(),
    template: QUESTION_ANSWER,
    question: 'what is the question ?',
    qcAnswers: [{ text: 'hallo', _id: new ObjectId() }, { text: 'shalom', _id: new ObjectId() }],
  },
  // 14
  { _id: new ObjectId(), template: SINGLE_CHOICE_QUESTION, qcAnswers: [{ _id: new ObjectId(), text: 'uel' }] },
  { // 15
    _id: new ObjectId(),
    template: MULTIPLE_CHOICE_QUESTION,
    qcAnswers: [
      { _id: new ObjectId(), isCorrect: false, text: 'mex' },
      { _id: new ObjectId(), isCorrect: true, text: 'Avery' },
    ],
  },
  { // 16
    _id: new ObjectId(),
    template: ORDER_THE_SEQUENCE,
    question: 'question ?',
    orderedAnswers: [
      { _id: new ObjectId(), text: 'rien' },
      { _id: new ObjectId(), text: 'des trucs' },
      { _id: new ObjectId(), text: 'des choses' },
    ],
  },
  { // 17
    _id: new ObjectId(),
    template: FILL_THE_GAPS,
    gappedText: '<trou> et <trou> sont dans un bateau',
    explanation: 'rien',
    gapAnswers: [
      { _id: new ObjectId(), text: 'ase', isCorrect: false },
      { _id: new ObjectId(), text: 'énué', isCorrect: false },
      { _id: new ObjectId(), text: 'olard', isCorrect: false },
      { _id: new ObjectId(), text: 'ension', isCorrect: false },
      { _id: new ObjectId(), text: 'rien', isCorrect: false },
      { _id: new ObjectId(), text: 'des trucs', isCorrect: true },
      { _id: new ObjectId(), text: 'des choses', isCorrect: true },
      { _id: new ObjectId(), text: 'des machins', isCorrect: false },
    ],
  },
  { // 18
    _id: new ObjectId(),
    template: SURVEY,
    labels: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' },
    question: 'question ?',
  },
  { // 19
    _id: new ObjectId(),
    template: FILL_THE_GAPS,
    gapAnswers: [
      { _id: new ObjectId(), text: 'ase', isCorrect: false },
      { _id: new ObjectId(), text: 'énué', isCorrect: false },
      { _id: new ObjectId(), text: 'test', isCorrect: true },
      { _id: new ObjectId(), text: 'truc', isCorrect: false },
    ],
  },
];

const activitiesList = [
  {
    _id: new ObjectId(),
    name: 'Coucou toi',
    cards: [
      cardsList[0]._id,
      cardsList[1]._id,
      cardsList[11]._id,
      cardsList[12]._id,
      cardsList[8]._id,
      cardsList[16]._id,
      cardsList[5]._id,
      cardsList[19]._id,
    ],
    type: 'video',
    status: 'draft',
  },
  {
    _id: new ObjectId(),
    name: 'la peche',
    cards: [cardsList[4]._id, cardsList[13]._id, cardsList[17]._id],
    type: 'quiz',
    status: 'published',
  },
];

const questionnairesList = [
  {
    _id: new ObjectId(),
    name: 'test',
    status: PUBLISHED,
    type: 'expectations',
    cards: [cardsList[6]._id, cardsList[9]._id],
    publishedAt: '2021-01-01T00:00:00.000Z',
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Card.create(cardsList),
    Activity.create(activitiesList),
    Questionnaire.create(questionnairesList),
  ]);
};

module.exports = {
  populateDB,
  cardsList,
};
