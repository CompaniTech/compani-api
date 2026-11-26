const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const StudyTrack = require('../../../src/models/StudyTrack');
const StudyTrackHelper = require('../../../src/helpers/studyTracks');
const { VAEI_COACH } = require('../../../src/helpers/constants');

describe('create', () => {
  let create;
  beforeEach(() => {
    create = sinon.stub(StudyTrack, 'create');
  });
  afterEach(() => {
    create.restore();
  });

  it('should create a default study track', async () => {
    const payload = {
      name: 'Parcours type',
      subProgram: new ObjectId(),
      detailsPerStep: [
        { step: new ObjectId(), durations: [7200, 3600] },
        { step: new ObjectId(), durations: [3600, 1800] },
      ],
      milestones: [{ month: 0, label: 'Jalon 1', targets: [VAEI_COACH] }],
      eLearningDurations: [1800, 3600],
    };

    await StudyTrackHelper.create(payload);

    sinon.assert.calledOnceWithExactly(create, { ...payload, isDefault: true });
  });
});
