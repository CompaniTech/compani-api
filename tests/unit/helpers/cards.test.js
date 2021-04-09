const sinon = require('sinon');
const expect = require('expect');
const flat = require('flat');
const { ObjectID } = require('mongodb');
const Card = require('../../../src/models/Card');
const CardHelper = require('../../../src/helpers/cards');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const {
  QUESTION_ANSWER,
  SINGLE_CHOICE_QUESTION,
  MULTIPLE_CHOICE_QUESTION,
  FILL_THE_GAPS,
  ORDER_THE_SEQUENCE,
  TRANSITION,
} = require('../../../src/helpers/constants');

describe('createCard', () => {
  let create;
  beforeEach(() => {
    create = sinon.stub(Card, 'create');
  });
  afterEach(() => {
    create.restore();
  });

  it('should create a transition card', async () => {
    const newCard = { template: 'transition' };

    await CardHelper.createCard(newCard);

    sinon.assert.calledOnceWithExactly(create, newCard);
  });
});

describe('updateCard', () => {
  let updateOne;
  const cardId = new ObjectID();
  const payload = { title: 'transition' };

  beforeEach(() => {
    updateOne = sinon.stub(Card, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should update card', async () => {
    await CardHelper.updateCard(cardId, payload);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: cardId }, { $set: payload });
  });
});

describe('addCardAnswer', () => {
  let updateOne;
  let getAnswerKeyToUpdate;
  beforeEach(() => {
    updateOne = sinon.stub(Card, 'updateOne');
    getAnswerKeyToUpdate = sinon.stub(CardHelper, 'getAnswerKeyToUpdate');
  });
  afterEach(() => {
    updateOne.restore();
    getAnswerKeyToUpdate.restore();
  });

  it('should add card answer without correct', async () => {
    const card = { _id: new ObjectID(), template: QUESTION_ANSWER };
    getAnswerKeyToUpdate.returns('qcAnswers');

    await CardHelper.addCardAnswer(card);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: card._id }, { $push: { qcAnswers: { text: '' } } });
  });

  it('should add card answer with correct', async () => {
    const card = { _id: new ObjectID(), template: MULTIPLE_CHOICE_QUESTION };
    getAnswerKeyToUpdate.returns('qcAnswers');

    await CardHelper.addCardAnswer(card);

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: card._id }, { $push: { qcAnswers: { text: '', correct: false } } }
    );
  });
});

describe('getAnswerKeyToUpdate', () => {
  it('should return qcAnswers if template is qcm, qcu or qa', async () => {
    const templateList = [
      { name: MULTIPLE_CHOICE_QUESTION, rep: 'qcAnswers' },
      { name: SINGLE_CHOICE_QUESTION, rep: 'qcAnswers' },
      { name: QUESTION_ANSWER, rep: 'qcAnswers' },
      { name: ORDER_THE_SEQUENCE, rep: 'orderedAnswers' },
      { name: FILL_THE_GAPS, rep: 'falsyGapAnswers' },
      { name: TRANSITION, rep: '' },
    ];

    for (const template of templateList) {
      const rep = CardHelper.getAnswerKeyToUpdate(template.name);

      expect(rep).toEqual(template.rep);
    }
  });
});

describe('updateCardAnswer', () => {
  let updateOne;
  let getAnswerKeyToUpdate;
  beforeEach(() => {
    updateOne = sinon.stub(Card, 'updateOne');
    getAnswerKeyToUpdate = sinon.stub(CardHelper, 'getAnswerKeyToUpdate');
  });
  afterEach(() => {
    updateOne.restore();
    getAnswerKeyToUpdate.restore();
  });

  it('should update card answer', async () => {
    const card = { _id: new ObjectID() };
    const params = { answerId: new ObjectID() };
    getAnswerKeyToUpdate.returns('qcAnswers');

    await CardHelper.updateCardAnswer(card, params, { text: 'test text' });

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: card._id, 'qcAnswers._id': params.answerId },
      { $set: flat({ 'qcAnswers.$': { text: 'test text' } }) }
    );
  });
});

describe('deleteCardAnswer', () => {
  let updateOne;
  let getAnswerKeyToUpdate;
  beforeEach(() => {
    updateOne = sinon.stub(Card, 'updateOne');
    getAnswerKeyToUpdate = sinon.stub(CardHelper, 'getAnswerKeyToUpdate');
  });
  afterEach(() => {
    updateOne.restore();
    getAnswerKeyToUpdate.restore();
  });

  it('should delete card answer', async () => {
    const card = { template: 'multiple_choice_question' };
    const params = { _id: new ObjectID(), answerId: new ObjectID() };
    getAnswerKeyToUpdate.returns('qcAnswers');

    await CardHelper.deleteCardAnswer(card, params);

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: params._id },
      { $pull: { qcAnswers: { _id: params.answerId } } }
    );
  });
});

describe('removeCard', () => {
  let deleteOne;
  beforeEach(() => {
    deleteOne = sinon.stub(Card, 'deleteOne');
  });
  afterEach(() => {
    deleteOne.restore();
  });

  it('should delete card', async () => {
    const cardId = new ObjectID();

    await CardHelper.removeCard(cardId);

    sinon.assert.calledOnceWithExactly(deleteOne, { _id: cardId });
  });
});

describe('uploadMedia', () => {
  let updateOneStub;
  let uploadMediaStub;
  beforeEach(() => {
    updateOneStub = sinon.stub(Card, 'updateOne');
    uploadMediaStub = sinon.stub(GCloudStorageHelper, 'uploadProgramMedia');
  });
  afterEach(() => {
    updateOneStub.restore();
    uploadMediaStub.restore();
  });

  it('should upload image', async () => {
    uploadMediaStub.returns({
      publicId: 'jesuisunsupernomdefichier',
      link: 'https://storage.googleapis.com/BucketKFC/myMedia',
    });

    const cardId = new ObjectID();
    const payload = { file: new ArrayBuffer(32), fileName: 'illustration' };

    await CardHelper.uploadMedia(cardId, payload);

    sinon.assert.calledOnceWithExactly(uploadMediaStub, { file: new ArrayBuffer(32), fileName: 'illustration' });
    sinon.assert.calledWithExactly(
      updateOneStub,
      { _id: cardId },
      {
        $set: flat({
          media: { publicId: 'jesuisunsupernomdefichier', link: 'https://storage.googleapis.com/BucketKFC/myMedia' },
        }),
      }
    );
  });
});

describe('deleteMedia', () => {
  let updateOne;
  let deleteMedia;
  beforeEach(() => {
    updateOne = sinon.stub(Card, 'updateOne');
    deleteMedia = sinon.stub(GCloudStorageHelper, 'deleteProgramMedia');
  });
  afterEach(() => {
    updateOne.restore();
    deleteMedia.restore();
  });

  it('should do nothing as publicId is not set', async () => {
    const cardId = new ObjectID();
    await CardHelper.deleteMedia(cardId, '');

    sinon.assert.notCalled(updateOne);
    sinon.assert.notCalled(deleteMedia);
  });

  it('should update card and delete media', async () => {
    const cardId = new ObjectID();
    await CardHelper.deleteMedia(cardId, 'publicId');

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: cardId },
      { $unset: { 'media.publicId': '', 'media.link': '' } }
    );
    sinon.assert.calledOnceWithExactly(deleteMedia, 'publicId');
  });
});
