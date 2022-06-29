const expect = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const Repetition = require('../../../src/models/Repetition');
const EventsHelper = require('../../../src/helpers/events');
const RepetitionHelper = require('../../../src/helpers/repetitions');
const SinonMongoose = require('../sinonMongoose');

describe('updateRepetitions', () => {
  let findOneRepetition;
  let formatEditionPayloadStub;
  let findOneAndUpdateRepetition;
  beforeEach(() => {
    findOneRepetition = sinon.stub(Repetition, 'findOne');
    formatEditionPayloadStub = sinon.stub(EventsHelper, 'formatEditionPayload');
    findOneAndUpdateRepetition = sinon.stub(Repetition, 'findOneAndUpdate');
  });
  afterEach(() => {
    findOneRepetition.restore();
    formatEditionPayloadStub.restore();
    findOneAndUpdateRepetition.restore();
  });

  it('should update a repetition', async () => {
    const parentId = new ObjectId();
    const repetition = { startDate: '2021-01-01T09:10:00.000Z', endDate: '2021-01-01T11:10:00.000Z' };
    const eventPayload = {
      startDate: '2020-12-01T10:30:00.000Z',
      endDate: '2021-12-01T11:30:00.000Z',
      _id: new ObjectId(),
      test: 's',
    };
    findOneRepetition.returns(SinonMongoose.stubChainedQueries(repetition, ['lean']));
    formatEditionPayloadStub.returns({ payload: 'payload' });

    const result = await RepetitionHelper.updateRepetitions(eventPayload, parentId);

    expect(result).toBeUndefined();
    SinonMongoose.calledOnceWithExactly(
      findOneRepetition,
      [{ query: 'findOne', args: [{ parentId }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(findOneAndUpdateRepetition, { parentId }, { payload: 'payload' });
    sinon.assert.calledOnceWithExactly(
      formatEditionPayloadStub,
      repetition,
      { test: 's', startDate: '2021-01-01T10:30:00.000Z', endDate: '2021-01-01T11:30:00.000Z' },
      false
    );
  });

  it('should do nothing if repetition does not exist', async () => {
    const parentId = new ObjectId();
    findOneRepetition.returns(SinonMongoose.stubChainedQueries(null, ['lean']));

    const result = await RepetitionHelper.updateRepetitions({}, parentId);

    expect(result).toBeUndefined();
    SinonMongoose.calledOnceWithExactly(
      findOneRepetition,
      [{ query: 'findOne', args: [{ parentId }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(findOneAndUpdateRepetition);
    sinon.assert.notCalled(formatEditionPayloadStub);
  });
});

describe('formatPayloadForRepetitionCreation', () => {
  it('should format payload for repetition creation', async () => {
    const eventId = new ObjectId();
    const event = {
      _id: eventId,
      startDate: '2020-12-01T10:30:00.000Z',
      endDate: '2020-12-01T12:30:00.000Z',
    };
    const payload = {
      misc: 'Super note pour verifier que ce champ n\'est pas appliqué a la repetition au moment de la creation.',
      startDate: '2020-12-01T11:30:00.000Z',
      repetition: { startDate: '2020-01-01T09:10:00.000Z', endDate: '2020-01-01T11:10:00.000Z' },
    };
    const companyId = new ObjectId();

    const result = await RepetitionHelper.formatPayloadForRepetitionCreation(event, payload, companyId);

    expect(result).toEqual({
      startDate: '2020-12-01T11:30:00.000Z',
      company: companyId,
      repetition: { startDate: '2020-01-01T09:10:00.000Z', endDate: '2020-01-01T11:10:00.000Z', parentId: eventId },
    });
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(Repetition, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should list repetitions', async () => {
    const auxiliaryId = new ObjectId();
    const customerId = new ObjectId();
    const credentials = { company: { _id: new ObjectId() } };
    const query = { auxiliary: auxiliaryId };
    const repetitions = [
      {
        type: 'intervention',
        startDate: '2019-07-13T20:00:00.000Z',
        endDate: '2019-07-13T22:00:00.000Z',
        frequency: 'every_two_weeks',
        auxiliary: auxiliaryId,
        customer: customerId,
      },
      {
        type: 'internal_hour',
        startDate: '2019-07-29T14:00:00.000Z',
        endDate: '2019-07-29T16:00:00.000Z',
        frequency: 'every_week',
        auxiliary: auxiliaryId,
      },
      {
        type: 'unavailability',
        startDate: '2019-07-24T08:00:00.000Z',
        endDate: '2019-07-13T09:00:00.000Z',
        frequency: 'every_day',
        auxiliary: new ObjectId(),
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries([repetitions[0], repetitions[1]]));

    const result = await RepetitionHelper.list(query, credentials);

    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [
            { auxiliary: query.auxiliary, company: credentials.company._id },
            { attachement: 0, misc: 0, address: 0, sector: 0 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'customer',
            select: 'identity subscriptions.service subscriptions._id',
            populate: { path: 'subscriptions.service', select: 'versions.name versions.createdAt' },
          }],
        },
        { query: 'populate', args: [{ path: 'internalHour', select: 'name' }] },
        { query: 'lean' },
      ]
    );
    expect(result).toEqual([repetitions[0], repetitions[1]]);
  });
});

describe('remove', () => {
  let findOne;
  let deleteEventsAndRepetition;
  beforeEach(() => {
    findOne = sinon.stub(Repetition, 'findOne');
    deleteEventsAndRepetition = sinon.stub(EventsHelper, 'deleteEventsAndRepetition');
  });
  afterEach(() => {
    findOne.restore();
    deleteEventsAndRepetition.restore();
  });

  it('should delete a repetition', async () => {
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const repetitionId = new ObjectId();
    const parentId = new ObjectId();
    const startDate = '2019-07-15T00:00:00.000Z';

    const repetition = {
      _id: repetitionId,
      type: 'intervention',
      startDate: '2019-07-13T20:00:00.000Z',
      endDate: '2019-07-13T22:00:00.000Z',
      frequency: 'every_two_weeks',
      auxiliary: new ObjectId(),
      customer: new ObjectId(),
      parentId,
      company: companyId,
    };

    findOne.returns(SinonMongoose.stubChainedQueries(repetition, ['lean']));

    await RepetitionHelper.remove(repetitionId, startDate, credentials);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: repetitionId, company: companyId }, { parentId: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(
      deleteEventsAndRepetition,
      { 'repetition.parentId': parentId, startDate: { $gte: startDate }, company: companyId },
      true,
      credentials
    );
  });
});
