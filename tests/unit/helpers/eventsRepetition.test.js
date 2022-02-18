const expect = require('expect');
const sinon = require('sinon');
const omit = require('lodash/omit');
const { ObjectId } = require('mongodb');
const moment = require('../../../src/extensions/moment');
const luxon = require('../../../src/helpers/dates/luxon');
const CompaniDatesHelper = require('../../../src/helpers/dates/companiDates');
const CompaniIntervalsHelper = require('../../../src/helpers/dates/companiIntervals');
const Event = require('../../../src/models/Event');
const User = require('../../../src/models/User');
const Repetition = require('../../../src/models/Repetition');
const Customer = require('../../../src/models/Customer');
const EventsHelper = require('../../../src/helpers/events');
const EventsRepetitionHelper = require('../../../src/helpers/eventsRepetition');
const EventsValidationHelper = require('../../../src/helpers/eventsValidation');
const CustomerAbsencesHelper = require('../../../src/helpers/customerAbsences');
const RepetitionHelper = require('../../../src/helpers/repetitions');
const {
  INTERVENTION,
  ABSENCE,
  NEVER,
  EVERY_WEEK,
  INTERNAL_HOUR,
  UNAVAILABILITY,
} = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('formatRepeatedPayload', () => {
  let hasConflicts;
  let isAbsent;
  beforeEach(() => {
    hasConflicts = sinon.stub(EventsValidationHelper, 'hasConflicts');
    isAbsent = sinon.stub(CustomerAbsencesHelper, 'isAbsent');
  });
  afterEach(() => {
    hasConflicts.restore();
    isAbsent.restore();
  });

  it('should format event with auxiliary', async () => {
    const sector = new ObjectId();
    const day = '2019-07-16T22:00:00.000Z';
    const auxiliaryId = new ObjectId();
    const event = {
      startDate: '2019-07-13T22:00:00.000Z',
      endDate: '2019-07-14T22:00:00.000Z',
      auxiliary: auxiliaryId,
      type: 'intervention',
    };
    const payload = {
      ...omit(event, '_id'),
      startDate: '2019-07-16T22:00:00.000Z',
      endDate: '2019-07-17T22:00:00.000Z',
    };
    hasConflicts.returns(false);
    isAbsent.returns(false);
    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, sector, day);

    expect(result).toBeDefined();
    expect(result.startDate).toEqual(new Date('2019-07-16T22:00:00.000Z'));
    expect(result.endDate).toEqual(new Date('2019-07-17T22:00:00.000Z'));
    expect(result.auxiliary).toEqual(auxiliaryId);
    sinon.assert.calledWithExactly(hasConflicts, payload);
    sinon.assert.calledOnceWithExactly(isAbsent, event.customer, payload.startDate);
  });

  it('should format intervention without auxiliary', async () => {
    const sector = new ObjectId();
    const auxiliaryId = new ObjectId();
    const day = '2019-07-16T22:00:00.000Z';
    const event = {
      startDate: '2019-07-13T22:00:00.000Z',
      endDate: '2019-07-14T22:00:00.000Z',
      auxiliary: auxiliaryId,
      type: 'intervention',
      repetition: { frequency: 'every_week' },
    };
    const payload = {
      ...omit(event, '_id'),
      startDate: '2019-07-16T22:00:00.000Z',
      endDate: '2019-07-17T22:00:00.000Z',
    };
    hasConflicts.returns(true);
    isAbsent.returns(false);
    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, sector, day);

    expect(result).toBeDefined();
    expect(result.startDate).toEqual(new Date('2019-07-16T22:00:00.000Z'));
    expect(result.endDate).toEqual(new Date('2019-07-17T22:00:00.000Z'));
    expect(result.auxiliary).toBeUndefined();
    expect(result.sector).toEqual(sector);
    expect(result.repetition.frequency).toEqual('never');
    sinon.assert.calledWithExactly(hasConflicts, payload);
  });

  it('should format internal hour with auxiliary', async () => {
    const sector = new ObjectId();
    const auxiliaryId = new ObjectId();
    const day = '2019-07-16T22:00:00.000Z';
    const event = {
      _id: new ObjectId(),
      startDate: '2019-07-13T22:00:00.000Z',
      endDate: '2019-07-14T22:00:00.000Z',
      auxiliary: auxiliaryId,
      type: INTERNAL_HOUR,
    };
    const payload = {
      ...omit(event, '_id'),
      startDate: '2019-07-16T22:00:00.000Z',
      endDate: '2019-07-17T22:00:00.000Z',
    };
    hasConflicts.returns(false);
    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, sector, day);

    expect(result).toBeDefined();
    expect(result.auxiliary).toBeDefined();
    expect(result.sector).toBeUndefined();
    sinon.assert.calledWithExactly(hasConflicts, payload);
    sinon.assert.notCalled(isAbsent);
  });

  it('should not called hasConflicts if event is not affected', async () => {
    const sector = new ObjectId();
    const day = '2019-07-16T22:00:00.000Z';
    const event = {
      startDate: '2019-07-13T22:00:00.000Z',
      endDate: '2019-07-14T22:00:00.000Z',
      type: 'intervention',
      sector: sector.toHexString(),
    };
    const payload = {
      ...omit(event, '_id'),
      startDate: '2019-07-16T22:00:00.000Z',
      endDate: '2019-07-17T22:00:00.000Z',
    };

    hasConflicts.returns(false);
    isAbsent.returns(false);
    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, sector, day);

    expect(result).toBeDefined();
    expect(result.auxiliary).toBeUndefined();
    expect(result.sector).toEqual(sector);
    sinon.assert.calledWithExactly(hasConflicts, payload);
  });

  it('should return null if event has conflict', async () => {
    const sector = new ObjectId();
    const day = '2019-07-16T22:00:00.000Z';
    const event = {
      startDate: '2019-07-13T22:00:00.000Z',
      endDate: '2019-07-14T22:00:00.000Z',
      type: 'intervention',
    };
    const payload = {
      ...omit(event, '_id'),
      startDate: '2019-07-16T22:00:00.000Z',
      endDate: '2019-07-17T22:00:00.000Z',
    };
    isAbsent.returns(false);

    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, sector, day);

    expect(result).toBeDefined();
    expect(result.auxiliary).toBeUndefined();
    sinon.assert.calledWithExactly(hasConflicts, payload);
  });

  it('should return null if event is an internal hour and auxiliary has conflict', async () => {
    const sector = new ObjectId();
    const day = '2019-07-16T22:00:00.000Z';
    const event = {
      _id: new ObjectId(),
      startDate: '2019-07-13T22:00:00.000Z',
      endDate: '2019-07-14T22:00:00.000Z',
      type: INTERNAL_HOUR,
    };
    const payload = {
      ...omit(event, '_id'),
      startDate: '2019-07-16T22:00:00.000Z',
      endDate: '2019-07-17T22:00:00.000Z',
    };
    hasConflicts.returns(true);
    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, sector, day);

    expect(result).toBeNull();
    sinon.assert.calledWithExactly(hasConflicts, payload);
    sinon.assert.notCalled(isAbsent);
  });

  it('should return null if event is an unavailability and auxiliary has conflict', async () => {
    const sector = new ObjectId();
    const day = '2019-07-16T22:00:00.000Z';
    const event = {
      _id: new ObjectId(),
      startDate: '2019-07-13T22:00:00.000Z',
      endDate: '2019-07-14T22:00:00.000Z',
      type: 'unavailability',
    };
    const payload = {
      ...omit(event, '_id'),
      startDate: '2019-07-16T22:00:00.000Z',
      endDate: '2019-07-17T22:00:00.000Z',
    };
    hasConflicts.returns(true);
    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, sector, day);

    expect(result).toBeNull();
    sinon.assert.calledWithExactly(hasConflicts, payload);
    sinon.assert.notCalled(isAbsent);
  });

  it('should return null if customer is absent', async () => {
    const sector = new ObjectId();
    const day = '2019-07-16T22:00:00.000Z';
    const auxiliaryId = new ObjectId();
    const event = {
      startDate: '2019-07-13T22:00:00.000Z',
      endDate: '2019-07-14T22:00:00.000Z',
      auxiliary: auxiliaryId,
      type: 'intervention',
    };
    const payload = {
      ...omit(event, '_id'),
      startDate: '2019-07-16T22:00:00.000Z',
      endDate: '2019-07-17T22:00:00.000Z',
    };

    hasConflicts.returns(false);
    isAbsent.returns(true);

    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, sector, day);

    expect(result).toBeNull();
    sinon.assert.calledOnceWithExactly(isAbsent, event.customer, payload.startDate);
  });
});

describe('createRepeatedEvents', () => {
  let formatRepeatedPayload;
  let customerFindOne;
  let insertMany;
  beforeEach(() => {
    formatRepeatedPayload = sinon.stub(EventsRepetitionHelper, 'formatRepeatedPayload');
    customerFindOne = sinon.stub(Customer, 'findOne');
    insertMany = sinon.stub(Event, 'insertMany');
  });
  afterEach(() => {
    formatRepeatedPayload.restore();
    customerFindOne.restore();
    insertMany.restore();
  });

  it('should create repetition for each range', async () => {
    const sector = new ObjectId();
    const event = {
      type: INTERVENTION,
      startDate: '2019-01-10T09:00:00.000Z',
      endDate: '2019-01-10T11:00:00.000Z',
      customer: new ObjectId(),
    };
    const range = ['2019-01-11T09:00:00.000Z', '2019-01-12T09:00:00.000Z', '2019-01-13T09:00:00.000Z'];
    const repeatedEvents = [
      new Event({ company: new ObjectId(), startDate: range[0] }),
      new Event({ company: new ObjectId(), startDate: range[1] }),
      new Event({ company: new ObjectId(), startDate: range[2] }),
    ];

    formatRepeatedPayload.onCall(0).returns(repeatedEvents[0]);
    formatRepeatedPayload.onCall(1).returns(repeatedEvents[1]);
    formatRepeatedPayload.onCall(2).returns(repeatedEvents[2]);
    customerFindOne.returns(SinonMongoose.stubChainedQueries(null, ['lean']));

    await EventsRepetitionHelper.createRepeatedEvents(event, range, sector, false);

    sinon.assert.calledWithExactly(formatRepeatedPayload.getCall(0), event, sector, '2019-01-11T09:00:00.000Z');
    sinon.assert.calledWithExactly(formatRepeatedPayload.getCall(1), event, sector, '2019-01-12T09:00:00.000Z');
    sinon.assert.calledWithExactly(formatRepeatedPayload.getCall(2), event, sector, '2019-01-13T09:00:00.000Z');
    sinon.assert.calledOnceWithExactly(insertMany, repeatedEvents);
    SinonMongoose.calledOnceWithExactly(
      customerFindOne,
      [
        { query: 'findOne', args: [{ _id: event.customer, stoppedAt: { $exists: true } }, { stoppedAt: 1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should not insert events after stopping date', async () => {
    const sector = new ObjectId();
    const event = {
      type: INTERVENTION,
      startDate: '2019-01-10T09:00:00.000Z',
      endDate: '2019-01-10T11:00:00.000Z',
      customer: new ObjectId(),
    };
    const range = ['2019-01-11T09:00:00.000Z', '2019-01-12T09:00:00.000Z', '2019-01-13T09:00:00.000Z'];
    const customer = { _id: event.customer, stoppedAt: new Date('2019-01-12T11:00:00.000Z') };
    const repeatedEvents = [
      new Event({ company: new ObjectId(), startDate: range[0] }),
      new Event({ company: new ObjectId(), startDate: range[1] }),
      new Event({ company: new ObjectId(), startDate: range[2] }),
    ];

    formatRepeatedPayload.onCall(0).returns(repeatedEvents[0]);
    formatRepeatedPayload.onCall(1).returns(repeatedEvents[1]);
    formatRepeatedPayload.onCall(2).returns(repeatedEvents[2]);
    customerFindOne.returns(SinonMongoose.stubChainedQueries(customer, ['lean']));

    await EventsRepetitionHelper.createRepeatedEvents(event, range, sector, false);

    sinon.assert.calledWithExactly(formatRepeatedPayload.getCall(0), event, sector, '2019-01-11T09:00:00.000Z');
    sinon.assert.calledWithExactly(formatRepeatedPayload.getCall(1), event, sector, '2019-01-12T09:00:00.000Z');
    sinon.assert.calledWithExactly(formatRepeatedPayload.getCall(2), event, sector, '2019-01-13T09:00:00.000Z');
    sinon.assert.calledOnceWithExactly(insertMany, repeatedEvents.slice(0, 2));
    SinonMongoose.calledOnceWithExactly(
      customerFindOne,
      [
        { query: 'findOne', args: [{ _id: event.customer, stoppedAt: { $exists: true } }, { stoppedAt: 1 }] },
        { query: 'lean' },
      ]
    );
  });

  [INTERNAL_HOUR, UNAVAILABILITY].forEach((type) => {
    it(`should not check if customer is stopped if event is ${type} and not intervention`, async () => {
      const sector = new ObjectId();
      const event = {
        type,
        startDate: '2019-01-10T09:00:00.000Z',
        endDate: '2019-01-10T11:00:00.000Z',
      };

      const range = ['2019-01-11T09:00:00.000Z', '2019-01-12T09:00:00.000Z', '2019-01-13T09:00:00.000Z'];
      const repeatedEvents = [
        new Event({ company: new ObjectId(), startDate: range[0] }),
        new Event({ company: new ObjectId(), startDate: range[1] }),
        new Event({ company: new ObjectId(), startDate: range[2] }),
      ];

      formatRepeatedPayload.onCall(0).returns(repeatedEvents[0]);
      formatRepeatedPayload.onCall(1).returns(repeatedEvents[1]);
      formatRepeatedPayload.onCall(2).returns(repeatedEvents[2]);

      await EventsRepetitionHelper.createRepeatedEvents(event, range, sector, false);

      sinon.assert.calledOnceWithExactly(insertMany, repeatedEvents);
      sinon.assert.notCalled(customerFindOne);
    });
  });
});

describe('getRange', () => {
  let _formatMiscToCompaniDate;
  let _formatMiscToCompaniInterval;

  beforeEach(() => {
    _formatMiscToCompaniDate = sinon.stub(CompaniDatesHelper, '_formatMiscToCompaniDate');
    _formatMiscToCompaniInterval = sinon.spy(CompaniIntervalsHelper, '_formatMiscToCompaniInterval');
  });
  afterEach(() => {
    _formatMiscToCompaniDate.restore();
    _formatMiscToCompaniInterval.restore();
  });

  it('should create repetition every day from currentDay', async () => {
    const eventStartDate = '2019-01-10T09:00:00.000Z';
    const currentDate = '2019-01-10T14:00:00.000Z';
    const step = { days: 1 };

    _formatMiscToCompaniDate.onCall(0).returns(luxon.DateTime.fromISO(currentDate));
    _formatMiscToCompaniDate.onCall(1).returns(luxon.DateTime.fromISO(eventStartDate));
    _formatMiscToCompaniDate.onCall(2).returns(luxon.DateTime.fromISO(eventStartDate));

    const result = await EventsRepetitionHelper.getRange(eventStartDate, step);

    expect(result.length).toBe(89);
    sinon.assert.callCount(_formatMiscToCompaniDate, 3);
    sinon.assert.calledOnceWithExactly(
      _formatMiscToCompaniInterval,
      '2019-01-11T09:00:00.000Z',
      '2019-04-09T22:00:00.000Z'
    );
  });

  it('should create repetition every day with first event in the past', async () => {
    const eventStartDate = '2019-01-05T09:00:00.000Z';
    const currentDate = '2019-01-10T14:00:00.000Z';
    const step = { days: 1 };

    _formatMiscToCompaniDate.onCall(0).returns(luxon.DateTime.fromISO(currentDate));
    _formatMiscToCompaniDate.onCall(1).returns(luxon.DateTime.fromISO(eventStartDate));
    _formatMiscToCompaniDate.onCall(2).returns(luxon.DateTime.fromISO(eventStartDate));

    const result = await EventsRepetitionHelper.getRange(eventStartDate, step);

    expect(result.length).toBe(94);
    sinon.assert.callCount(_formatMiscToCompaniDate, 3);
    sinon.assert.calledOnceWithExactly(
      _formatMiscToCompaniInterval,
      '2019-01-06T09:00:00.000Z',
      '2019-04-09T22:00:00.000Z'
    );
  });

  it('should create repetition by week with first event in the future', async () => {
    const eventStartDate = '2019-01-14T09:00:00.000Z';
    const currentDate = '2019-01-10T14:00:00.000Z';
    const step = { days: 1 };

    _formatMiscToCompaniDate.onCall(0).returns(luxon.DateTime.fromISO(currentDate));
    _formatMiscToCompaniDate.onCall(1).returns(luxon.DateTime.fromISO(eventStartDate));
    _formatMiscToCompaniDate.onCall(2).returns(luxon.DateTime.fromISO(eventStartDate));

    const result = await EventsRepetitionHelper.getRange(eventStartDate, step);

    expect(result.length).toBe(89);
    sinon.assert.callCount(_formatMiscToCompaniDate, 3);
    sinon.assert.calledOnceWithExactly(
      _formatMiscToCompaniInterval,
      '2019-01-15T09:00:00.000Z',
      '2019-04-13T22:00:00.000Z'
    );
  });
});

describe('createRepetitions', () => {
  let updateOne;
  let getRange;
  let createRepeatedEvents;
  let saveRepetition;
  let findOne;
  beforeEach(() => {
    updateOne = sinon.stub(Event, 'updateOne');
    getRange = sinon.stub(EventsRepetitionHelper, 'getRange');
    createRepeatedEvents = sinon.stub(EventsRepetitionHelper, 'createRepeatedEvents');
    saveRepetition = sinon.stub(Repetition.prototype, 'save');
    findOne = sinon.stub(User, 'findOne');
  });
  afterEach(() => {
    updateOne.restore();
    getRange.restore();
    createRepeatedEvents.restore();
    saveRepetition.restore();
    findOne.restore();
  });

  it('should call updateOne', async () => {
    const auxiliaryId = new ObjectId();
    const sectorId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const payload = { _id: '1234567890', repetition: { frequency: 'every_day', parentId: '0987654321' } };
    const event = new Event({ repetition: { frequency: EVERY_WEEK }, company: new ObjectId(), auxiliary: auxiliaryId });

    findOne.returns(SinonMongoose.stubChainedQueries({ _id: auxiliaryId, sector: sectorId }));

    await EventsRepetitionHelper.createRepetitions(event, payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: auxiliaryId }] },
        { query: 'populate', args: [{ path: 'sector', select: '_id sector', match: { company: companyId } }] },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
    sinon.assert.called(updateOne);
    sinon.assert.called(getRange);
    sinon.assert.called(createRepeatedEvents);
    sinon.assert.called(saveRepetition);
  });

  it('should generate range with frequency of every day', async () => {
    const auxiliaryId = new ObjectId();
    const sectorId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const payload = {
      _id: '1234567890',
      repetition: { frequency: 'every_day', parentId: '0987654321' },
      startDate: '2019-01-15T09:00:00.000Z',
    };
    const event = new Event({ company: new ObjectId(), auxiliary: auxiliaryId });
    const range = ['2019-01-15T09:00:00.000Z', '2019-01-16T09:00:00.000Z', '2019-01-17T09:00:00.000Z',
      '2019-01-18T09:00:00.000Z', '2019-01-19T09:00:00.000Z', '2019-01-20T09:00:00.000Z', '2019-01-21T09:00:00.000Z'];

    findOne.returns(SinonMongoose.stubChainedQueries({ _id: auxiliaryId, sector: sectorId }));
    getRange.returns(range);

    await EventsRepetitionHelper.createRepetitions(event, payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: auxiliaryId }] },
        { query: 'populate', args: [{ path: 'sector', select: '_id sector', match: { company: companyId } }] },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
    sinon.assert.notCalled(updateOne);
    sinon.assert.calledWithExactly(getRange, '2019-01-15T09:00:00.000Z', { days: 1 });
    sinon.assert.calledWith(createRepeatedEvents, payload, range, sectorId);
    sinon.assert.called(saveRepetition);
  });

  it('should generate range with frequency of every weekday', async () => {
    const sectorId = new ObjectId();
    const credentials = { company: { _id: new ObjectId() } };
    const payload = {
      _id: '1234567890',
      repetition: { frequency: 'every_week_day', parentId: '0987654321' },
      startDate: '2019-01-15T09:00:00.000Z',
    };
    const event = new Event({ company: new ObjectId(), sector: sectorId });

    getRange.returns(['2019-01-15T09:00:00.000Z', '2019-01-16T09:00:00.000Z', '2019-01-17T09:00:00.000Z',
      '2019-01-18T09:00:00.000Z', '2019-01-19T09:00:00.000Z', '2019-01-20T09:00:00.000Z', '2019-01-21T09:00:00.000Z']);

    await EventsRepetitionHelper.createRepetitions(event, payload, credentials);

    sinon.assert.notCalled(findOne);
    sinon.assert.notCalled(updateOne);
    sinon.assert.calledWithExactly(getRange, '2019-01-15T09:00:00.000Z', { days: 1 });
    sinon.assert.called(createRepeatedEvents);
    sinon.assert.calledWith(
      createRepeatedEvents,
      payload,
      ['2019-01-15T09:00:00.000Z', '2019-01-16T09:00:00.000Z', '2019-01-17T09:00:00.000Z', '2019-01-18T09:00:00.000Z',
        '2019-01-21T09:00:00.000Z'],
      sectorId
    );
    sinon.assert.called(saveRepetition);
  });

  it('should generate range with frequency of every week', async () => {
    const sectorId = new ObjectId();
    const credentials = { company: { _id: new ObjectId() } };
    const payload = {
      _id: '1234567890',
      repetition: { frequency: 'every_week', parentId: '0987654321' },
      startDate: '2019-01-15T09:00:00.000Z',
    };
    const event = new Event({ company: new ObjectId(), sector: sectorId });

    await EventsRepetitionHelper.createRepetitions(event, payload, credentials);

    sinon.assert.notCalled(findOne);
    sinon.assert.notCalled(updateOne);
    sinon.assert.calledWithExactly(getRange, '2019-01-15T09:00:00.000Z', { weeks: 1 });
    sinon.assert.called(createRepeatedEvents);
    sinon.assert.called(saveRepetition);
  });

  it('should generate range with frequency of every 2 weeks', async () => {
    const sectorId = new ObjectId();
    const credentials = { company: { _id: new ObjectId() } };
    const payload = {
      _id: '1234567890',
      repetition: { frequency: 'every_two_weeks', parentId: '0987654321' },
      startDate: '2019-01-15T09:00:00.000Z',
    };
    const event = new Event({ company: new ObjectId(), sector: sectorId });

    await EventsRepetitionHelper.createRepetitions(event, payload, credentials);

    sinon.assert.notCalled(findOne);
    sinon.assert.notCalled(updateOne);
    sinon.assert.calledWithExactly(getRange, '2019-01-15T09:00:00.000Z', { weeks: 2 });
    sinon.assert.called(createRepeatedEvents);
    sinon.assert.called(saveRepetition);
  });
});

describe('updateRepetition', () => {
  let hasConflicts;
  let isAbsent;
  let find;
  let updateOne;
  let deleteOne;
  let updateRepetitions;
  let findOneUser;
  let formatEditionPayload;
  beforeEach(() => {
    hasConflicts = sinon.stub(EventsValidationHelper, 'hasConflicts');
    isAbsent = sinon.stub(CustomerAbsencesHelper, 'isAbsent');
    find = sinon.stub(Event, 'find');
    updateOne = sinon.stub(Event, 'updateOne');
    deleteOne = sinon.stub(Event, 'deleteOne');
    updateRepetitions = sinon.stub(RepetitionHelper, 'updateRepetitions');
    findOneUser = sinon.stub(User, 'findOne');
    formatEditionPayload = sinon.stub(EventsHelper, 'formatEditionPayload');
  });
  afterEach(() => {
    hasConflicts.restore();
    isAbsent.restore();
    find.restore();
    updateOne.restore();
    deleteOne.restore();
    updateRepetitions.restore();
    findOneUser.restore();
    formatEditionPayload.restore();
  });

  it('should update repetition', async () => {
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const auxiliaryId = new ObjectId();
    const customerId = new ObjectId();
    const event = {
      repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
      startDate: '2019-03-23T09:00:00.000Z',
      type: INTERVENTION,
      customer: customerId,
      sector: new ObjectId(),
      auxiliary: auxiliaryId,
    };
    const payload = {
      startDate: '2019-03-23T10:00:00.000Z',
      endDate: '2019-03-23T11:00:00.000Z',
      auxiliary: '1234567890',
    };
    const events = [
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-23T09:00:00.000Z',
        endDate: '2019-03-23T11:00:00.000Z',
        _id: 'asdfghjk',
        type: ABSENCE,
      },
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-24T09:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        type: INTERVENTION,
        customer: customerId,
        _id: '123456',
      },
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-25T09:00:00.000Z',
        endDate: '2019-03-25T11:00:00.000Z',
        _id: '654321',
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(events, ['lean']));
    hasConflicts.returns(false);
    isAbsent.returns(false);

    await EventsRepetitionHelper.updateRepetition(event, payload, credentials);

    sinon.assert.notCalled(findOneUser);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{
            'repetition.parentId': 'qwertyuiop',
            'repetition.frequency': { $not: { $eq: 'never' } },
            startDate: { $gte: new Date('2019-03-23T09:00:00.000Z') },
            company: credentials.company._id,
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledThrice(hasConflicts);
    sinon.assert.notCalled(deleteOne);
    sinon.assert.calledThrice(updateOne);
    sinon.assert.calledThrice(formatEditionPayload);
    sinon.assert.calledWithExactly(
      formatEditionPayload.getCall(0),
      events[0],
      {
        startDate: '2019-03-23T10:00:00.000Z',
        endDate: '2019-03-23T11:00:00.000Z',
        auxiliary: '1234567890',
        _id: 'asdfghjk',
        type: ABSENCE,
      },
      false
    );
    sinon.assert.calledWithExactly(updateRepetitions, payload, 'qwertyuiop');
    sinon.assert.calledOnceWithExactly(isAbsent, events[1].customer, '2019-03-24T10:00:00.000Z');
  });

  it('should unassign intervention in conflict', async () => {
    const auxiliaryId = new ObjectId();
    const sectorId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const event = {
      repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
      startDate: '2019-03-23T09:00:00.000Z',
      type: INTERVENTION,
      auxiliary: auxiliaryId,
    };
    const payload = {
      startDate: '2019-03-23T10:00:00.000Z',
      endDate: '2019-03-23T11:00:00.000Z',
      auxiliary: '1234567890',
    };
    const events = [
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-24T09:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        _id: '123456',
        type: ABSENCE,
      },
    ];

    formatEditionPayload.returns({
      $set: {
        _id: '123456',
        startDate: '2019-03-24T10:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        sector: sectorId,
        'repetition.frequency': 'never',
      },
      $unset: { auxiliary: '' },
    });
    findOneUser.returns(SinonMongoose.stubChainedQueries({ _id: auxiliaryId, sector: sectorId }));
    hasConflicts.returns(true);
    find.returns(SinonMongoose.stubChainedQueries(events, ['lean']));

    await EventsRepetitionHelper.updateRepetition(event, payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      findOneUser,
      [
        { query: 'findOne', args: [{ _id: auxiliaryId }] },
        {
          query: 'populate',
          args: [{ path: 'sector', select: '_id sector', match: { company: credentials.company._id } }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{
            'repetition.parentId': 'qwertyuiop',
            'repetition.frequency': { $not: { $eq: 'never' } },
            startDate: { $gte: new Date('2019-03-23T09:00:00.000Z') },
            company: credentials.company._id,
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(
      hasConflicts,
      {
        _id: '123456',
        auxiliary: '1234567890',
        startDate: '2019-03-24T10:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        company: companyId,
        type: ABSENCE,
      }
    );
    sinon.assert.calledWithExactly(
      updateOne,
      { _id: '123456' },
      {
        $set: {
          _id: '123456',
          startDate: '2019-03-24T10:00:00.000Z',
          endDate: '2019-03-24T11:00:00.000Z',
          sector: sectorId,
          'repetition.frequency': 'never',
        },
        $unset: { auxiliary: '' },
      }
    );
    sinon.assert.calledWithExactly(updateRepetitions, payload, 'qwertyuiop');
    sinon.assert.calledOnceWithExactly(
      formatEditionPayload,
      events[0],
      {
        startDate: '2019-03-24T10:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        sector: sectorId,
        _id: '123456',
        type: ABSENCE,
      },
      true
    );
    sinon.assert.notCalled(deleteOne);
    sinon.assert.notCalled(isAbsent);
  });

  it('should unassign intervention if all the interventions are unassigned', async () => {
    const auxiliaryId = new ObjectId();
    const sectorId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const event = {
      repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
      startDate: '2019-03-23T09:00:00.000Z',
      type: INTERVENTION,
      auxiliary: auxiliaryId,
    };
    const payload = { startDate: '2019-03-23T10:00:00.000Z', endDate: '2019-03-23T11:00:00.000Z' };
    const events = [
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-24T09:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        _id: '123456',
        type: ABSENCE,
      },
    ];

    formatEditionPayload.returns({
      $set: {
        _id: '123456',
        startDate: '2019-03-24T10:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        sector: sectorId,
        'repetition.frequency': 'never',
      },
      $unset: { auxiliary: '' },
    });
    hasConflicts.returns(true);
    findOneUser.returns(SinonMongoose.stubChainedQueries({ _id: auxiliaryId, sector: sectorId }));
    find.returns(SinonMongoose.stubChainedQueries(events, ['lean']));

    await EventsRepetitionHelper.updateRepetition(event, payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      findOneUser,
      [
        { query: 'findOne', args: [{ _id: auxiliaryId }] },
        {
          query: 'populate',
          args: [{ path: 'sector', select: '_id sector', match: { company: credentials.company._id } }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{
            'repetition.parentId': 'qwertyuiop',
            'repetition.frequency': { $not: { $eq: 'never' } },
            startDate: { $gte: new Date('2019-03-23T09:00:00.000Z') },
            company: companyId,
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(
      hasConflicts,
      {
        _id: '123456',
        startDate: '2019-03-24T10:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        company: companyId,
        type: ABSENCE,
      }
    );
    sinon.assert.calledWithExactly(
      updateOne,
      { _id: '123456' },
      {
        $set: {
          _id: '123456',
          startDate: '2019-03-24T10:00:00.000Z',
          endDate: '2019-03-24T11:00:00.000Z',
          sector: sectorId,
          'repetition.frequency': 'never',
        },
        $unset: { auxiliary: '' },
      }
    );
    sinon.assert.calledWithExactly(updateRepetitions, payload, 'qwertyuiop');
    sinon.assert.calledOnceWithExactly(
      formatEditionPayload,
      events[0],
      {
        startDate: '2019-03-24T10:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        sector: sectorId,
        _id: '123456',
        type: ABSENCE,
      },
      false
    );
    sinon.assert.notCalled(deleteOne);
    sinon.assert.notCalled(isAbsent);
  });

  it('should delete internal hours in conflicts', async () => {
    const auxiliaryId = new ObjectId();
    const sectorId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const event = {
      repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
      startDate: '2019-03-23T09:00:00',
      type: INTERNAL_HOUR,
      auxiliary: auxiliaryId,
    };
    const payload = { startDate: '2019-03-23T10:00:00.000Z', endDate: '2019-03-23T11:00:00.000Z' };
    const events = [
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-24T09:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        _id: '123456',
        type: ABSENCE,
      },
    ];

    hasConflicts.returns(true);
    findOneUser.returns(SinonMongoose.stubChainedQueries({ _id: auxiliaryId, sector: sectorId }));
    find.returns(SinonMongoose.stubChainedQueries(events, ['lean']));

    await EventsRepetitionHelper.updateRepetition(event, payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      findOneUser,
      [
        { query: 'findOne', args: [{ _id: auxiliaryId }] },
        {
          query: 'populate',
          args: [{ path: 'sector', select: '_id sector', match: { company: credentials.company._id } }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{
            'repetition.parentId': 'qwertyuiop',
            'repetition.frequency': { $not: { $eq: 'never' } },
            startDate: { $gte: new Date('2019-03-23T09:00:00') },
            company: credentials.company._id,
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(
      hasConflicts,
      {
        _id: '123456',
        startDate: '2019-03-24T10:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        company: companyId,
        type: ABSENCE,
      }
    );
    sinon.assert.notCalled(updateOne);
    sinon.assert.calledWithExactly(deleteOne, { _id: '123456' });
    sinon.assert.calledWithExactly(updateRepetitions, payload, 'qwertyuiop');
    sinon.assert.notCalled(formatEditionPayload);
    sinon.assert.notCalled(isAbsent);
  });

  it('should not update an event of a repetition if customer is absent during this period', async () => {
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId } };
    const auxiliaryId = new ObjectId();
    const customerId = new ObjectId();
    const customerAbsent = new ObjectId();
    const event = {
      repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
      startDate: '2019-03-23T09:00:00.000Z',
      type: INTERVENTION,
      customer: customerId,
      sector: new ObjectId(),
      auxiliary: auxiliaryId,
    };
    const payload = {
      startDate: '2019-03-24T10:00:00.000Z',
      endDate: '2019-03-24T11:00:00.000Z',
      auxiliary: '1234567890',
    };
    const events = [
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-23T09:00:00.000Z',
        endDate: '2019-03-23T11:00:00.000Z',
        type: INTERVENTION,
        customer: customerId,
        _id: 'asdfghjk',
      },
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-24T09:00:00.000Z',
        endDate: '2019-03-24T11:00:00.000Z',
        type: INTERVENTION,
        customer: customerId,
        _id: '123456',
      },
      {
        repetition: { parentId: 'qwertyuiop', frequency: 'every_day' },
        startDate: '2019-03-25T09:00:00.000Z',
        endDate: '2019-03-25T11:00:00.000Z',
        type: INTERVENTION,
        customer: customerAbsent,
        _id: '654321',
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(events, ['lean']));
    hasConflicts.returns(false);
    isAbsent.onCall(0).returns(false);
    isAbsent.onCall(1).returns(false);
    isAbsent.onCall(2).returns(true);

    await EventsRepetitionHelper.updateRepetition(event, payload, credentials);

    sinon.assert.notCalled(findOneUser);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{
            'repetition.parentId': 'qwertyuiop',
            'repetition.frequency': { $not: { $eq: 'never' } },
            startDate: { $gte: new Date('2019-03-23T09:00:00.000Z') },
            company: credentials.company._id,
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledTwice(hasConflicts);
    sinon.assert.notCalled(deleteOne);
    sinon.assert.calledTwice(updateOne);
    sinon.assert.calledTwice(formatEditionPayload);
    sinon.assert.calledWithExactly(updateRepetitions, payload, 'qwertyuiop');
    sinon.assert.calledWithExactly(isAbsent.getCall(0), events[0].customer, '2019-03-23T10:00:00.000Z');
    sinon.assert.calledWithExactly(isAbsent.getCall(1), events[1].customer, '2019-03-24T10:00:00.000Z');
    sinon.assert.calledWithExactly(isAbsent.getCall(2), events[2].customer, '2019-03-25T10:00:00.000Z');
  });
});

describe('deleteRepetition', () => {
  let deleteEventsAndRepetition;
  beforeEach(() => {
    deleteEventsAndRepetition = sinon.stub(EventsHelper, 'deleteEventsAndRepetition');
  });
  afterEach(() => {
    deleteEventsAndRepetition.restore();
  });

  it('should delete repetition', async () => {
    const credentials = { company: { _id: new ObjectId() } };
    const parentId = new ObjectId();
    const event = {
      type: INTERVENTION,
      repetition: { frequency: EVERY_WEEK, parentId },
      startDate: '2019-01-21T09:38:18.653Z',
    };
    const query = {
      'repetition.parentId': event.repetition.parentId,
      startDate: { $gte: new Date(event.startDate) },
      company: credentials.company._id,
    };

    await EventsRepetitionHelper.deleteRepetition(event, credentials);

    sinon.assert.calledWithExactly(deleteEventsAndRepetition, query, true, credentials);
  });

  it('should not delete repetition as event is absence', async () => {
    const credentials = { company: { _id: new ObjectId() } };
    const event = {
      type: ABSENCE,
      repetition: { frequency: EVERY_WEEK },
      startDate: '2019-01-21T09:38:18.653Z',
    };
    await EventsRepetitionHelper.deleteRepetition(event, credentials);

    sinon.assert.notCalled(deleteEventsAndRepetition);
  });

  it('should not delete repetition as event is not a repetition', async () => {
    try {
      const credentials = { company: { _id: new ObjectId() } };
      const parentId = new ObjectId();
      const event = {
        type: INTERVENTION,
        repetition: { frequency: NEVER, parentId },
        startDate: '2019-01-21T09:38:18.653Z',
      };
      await EventsRepetitionHelper.deleteRepetition(event, credentials);
    } catch (e) {
      expect(e.output.statusCode).toEqual(422);
    } finally {
      sinon.assert.notCalled(deleteEventsAndRepetition);
    }
  });

  it('should not delete repetition as event is parentId is missing', async () => {
    try {
      const credentials = { company: { _id: new ObjectId() } };
      const event = {
        type: INTERVENTION,
        repetition: { frequency: EVERY_WEEK },
        startDate: '2019-01-21T09:38:18.653Z',
      };

      await EventsRepetitionHelper.deleteRepetition(event, credentials);
    } catch (e) {
      expect(e.output.statusCode).toEqual(422);
    } finally {
      sinon.assert.notCalled(deleteEventsAndRepetition);
    }
  });
});

describe('formatEventBasedOnRepetition', () => {
  let hasConflicts;
  let detachAuxiliaryFromEvent;
  beforeEach(() => {
    hasConflicts = sinon.stub(EventsValidationHelper, 'hasConflicts');
    detachAuxiliaryFromEvent = sinon.stub(EventsHelper, 'detachAuxiliaryFromEvent');
  });
  afterEach(() => {
    hasConflicts.restore();
    detachAuxiliaryFromEvent.restore();
  });

  it('should format event based on repetition', async () => {
    const repetition = {
      type: 'intervention',
      customer: new ObjectId(),
      subscription: new ObjectId(),
      auxiliary: new ObjectId(),
      address: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
      company: new ObjectId(),
      frequency: 'every_day',
      parentId: new ObjectId(),
      startDate: new Date('2019-12-01T09:00:00.000Z'),
      endDate: new Date('2019-12-01T10:00:00.000Z'),
    };

    hasConflicts.returns(false);

    const event = await EventsRepetitionHelper.formatEventBasedOnRepetition(repetition, new Date());

    expect(event).toEqual(expect.objectContaining({
      ...omit(repetition, ['frequency', 'parentId', 'startDate', 'endDate']),
      repetition: { frequency: repetition.frequency, parentId: repetition.parentId },
      startDate: moment().add(90, 'd').set({ hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }).toDate(),
      endDate: moment().add(90, 'd').set({ hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }).toDate(),
    }));
    sinon.assert.notCalled(detachAuxiliaryFromEvent);
  });

  it('should return null if unavailability in conflict', async () => {
    const repetition = {
      type: 'unavailability',
      auxiliary: new ObjectId(),
      company: new ObjectId(),
      frequency: 'every_day',
      parentId: new ObjectId(),
      startDate: new Date('2019-12-01T09:00:00.000Z'),
      endDate: new Date('2019-12-01T10:00:00.000Z'),
    };

    hasConflicts.returns(true);

    const event = await EventsRepetitionHelper.formatEventBasedOnRepetition(repetition, new Date());

    expect(event).toBeNull();
    sinon.assert.notCalled(detachAuxiliaryFromEvent);
  });

  it('should format and unassign event based on repetition', async () => {
    const customer = new ObjectId();
    const subscription = new ObjectId();
    const auxiliary = new ObjectId();
    const sector = new ObjectId();
    const company = new ObjectId();
    const parentId = new ObjectId();

    const repetition = {
      type: 'intervention',
      customer,
      subscription,
      auxiliary,
      sector,
      misc: 'note',
      internalHour: 'non',
      address: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
      company,
      frequency: 'every_day',
      parentId,
      startDate: new Date('2019-12-01T09:00:00.000Z'),
      endDate: new Date('2019-12-01T10:00:00.000Z'),
    };

    hasConflicts.returns(true);
    detachAuxiliaryFromEvent.returns({ sector });

    const date = '2020-03-11T00:00:00';
    const event = await EventsRepetitionHelper.formatEventBasedOnRepetition(repetition, date);

    expect(event).toEqual({ sector });
    sinon.assert.calledOnceWithExactly(
      detachAuxiliaryFromEvent,
      {
        type: 'intervention',
        customer,
        subscription,
        auxiliary,
        sector,
        misc: 'note',
        internalHour: 'non',
        company,
        address: {
          fullAddress: '37 rue de ponthieu 75008 Paris',
          zipCode: '75008',
          city: 'Paris',
          street: '37 rue de Ponthieu',
          location: { type: 'Point', coordinates: [2.377133, 48.801389] },
        },
        startDate: moment(date).add(90, 'd').set({ hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }).toDate(),
        endDate: moment(date).add(90, 'd').set({ hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }).toDate(),
        repetition: { frequency: 'every_day', parentId },
      },
      repetition.company
    );
  });
});
