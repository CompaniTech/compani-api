const { ObjectId } = require('mongodb');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const StudyTrack = require('../../../src/models/StudyTrack');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { PUBLISHED, DRAFT, ON_SITE, REMOTE, E_LEARNING } = require('../../../src/helpers/constants');

const stepsList = [
  { _id: new ObjectId(), name: 'step présentiel', type: ON_SITE, theoreticalDuration: 9000, status: PUBLISHED },
  { _id: new ObjectId(), name: 'step distanciel', type: REMOTE, theoreticalDuration: 3600, status: PUBLISHED },
  { _id: new ObjectId(), name: 'step e-learning', type: E_LEARNING, theoreticalDuration: 1800, status: PUBLISHED },
  { _id: new ObjectId(), name: 'step autre sous-programme', type: ON_SITE, theoreticalDuration: 9000 },
];

const subProgramsList = [
  { // 0 - published, with e-learning, no study track
    _id: new ObjectId(),
    name: 'subProgram 0',
    status: PUBLISHED,
    steps: [stepsList[0]._id, stepsList[1]._id, stepsList[2]._id],
  },
  { // 1 - published, without e-learning, with a default study track
    _id: new ObjectId(),
    name: 'subProgram 1',
    status: PUBLISHED,
    steps: [stepsList[3]._id],
  },
  { _id: new ObjectId(), name: 'subProgram 2', status: DRAFT, steps: [stepsList[0]._id] },
  { _id: new ObjectId(), name: 'subProgram 3', status: PUBLISHED, steps: [stepsList[0]._id] },
];

const studyTracksList = [
  {
    _id: new ObjectId(),
    name: 'Parcours type',
    subProgram: subProgramsList[1]._id,
    isDefault: true,
    detailsPerStep: [{ step: stepsList[3]._id, durations: [3600, 7200] }],
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    Step.create(stepsList),
    SubProgram.create(subProgramsList),
    StudyTrack.create(studyTracksList),
  ]);
};

module.exports = { populateDB, stepsList, subProgramsList, studyTracksList };
