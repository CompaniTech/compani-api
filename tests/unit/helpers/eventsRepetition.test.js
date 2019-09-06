const expect = require('expect');
const sinon = require('sinon');
const moment = require('moment');
const { ObjectID } = require('mongodb');
const Event = require('../../../models/Event');
const EventsRepetitionHelper = require('../../../helpers/eventsRepetition');
const EventsValidationHelper = require('../../../helpers/eventsValidation');
const EventHistoriesHelper = require('../../../helpers/eventHistories');
const {
  INTERVENTION,
  ABSENCE,
  NEVER,
  EVERY_WEEK,
} = require('../../../helpers/constants');

require('sinon-mongoose');

describe('formatRepeatedPayload', () => {
  let hasConflicts;
  beforeEach(() => {
    hasConflicts = sinon.stub(EventsValidationHelper, 'hasConflicts');
  });
  afterEach(() => {
    hasConflicts.restore();
  });

  it('should format event with auxiliary', async () => {
    const day = moment('2019-07-17', 'YYYY-MM-DD');
    const auxiliaryId = new ObjectID();
    const event = {
      startDate: moment('2019-07-14').startOf('d'),
      endDate: moment('2019-07-15').startOf('d'),
      auxiliary: auxiliaryId,
    };

    hasConflicts.returns(false);
    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, day);

    expect(result).toBeDefined();
    expect(result.startDate).toEqual(moment('2019-07-17').startOf('d').toDate());
    expect(result.endDate).toEqual(moment('2019-07-18').startOf('d').toDate());
    expect(result.auxiliary).toEqual(auxiliaryId);
  });

  it('should format event without auxiliary', async () => {
    const auxiliaryId = new ObjectID();
    const day = moment('2019-07-17', 'YYYY-MM-DD');
    const event = {
      startDate: moment('2019-07-14').startOf('d'),
      endDate: moment('2019-07-15').startOf('d'),
      auxiliary: auxiliaryId,
    };

    hasConflicts.returns(true);
    const result = await EventsRepetitionHelper.formatRepeatedPayload(event, day);

    expect(result).toBeDefined();
    expect(result.startDate).toEqual(moment('2019-07-17').startOf('d').toDate());
    expect(result.endDate).toEqual(moment('2019-07-18').startOf('d').toDate());
    expect(result.auxiliary).not.toBeDefined();
  });
});

describe('createRepetitionsEveryDay', () => {
  let formatRepeatedPayload;
  let insertMany;
  beforeEach(() => {
    formatRepeatedPayload = sinon.stub(EventsRepetitionHelper, 'formatRepeatedPayload');
    insertMany = sinon.stub(Event, 'insertMany');
  });
  afterEach(() => {
    formatRepeatedPayload.restore();
    insertMany.restore();
  });

  it('should create repetition every day', async () => {
    const event = { startDate: '2019-01-10T09:00:00.000Z', endDate: '2019-01-10T11:00:00' };
    formatRepeatedPayload.returns(new Event());
    await EventsRepetitionHelper.createRepetitionsEveryDay(event);

    sinon.assert.callCount(formatRepeatedPayload, 90);
    sinon.assert.callCount(insertMany, 1);
  });
});

describe('createRepetitionsEveryWeekDay', () => {
  let formatRepeatedPayload;
  let insertMany;
  beforeEach(() => {
    formatRepeatedPayload = sinon.stub(EventsRepetitionHelper, 'formatRepeatedPayload');
    insertMany = sinon.stub(Event, 'insertMany');
  });
  afterEach(() => {
    formatRepeatedPayload.restore();
    insertMany.restore();
  });

  it('should create repetition every day', async () => {
    const event = { startDate: '2019-01-10T09:00:00', endDate: '2019-01-10T11:00:00' };
    formatRepeatedPayload.returns(new Event());
    await EventsRepetitionHelper.createRepetitionsEveryWeekDay(event);

    sinon.assert.callCount(formatRepeatedPayload, 64);
    sinon.assert.callCount(insertMany, 1);
  });
});

describe('createRepetitionsByWeek', () => {
  let formatRepeatedPayload;
  let insertMany;
  beforeEach(() => {
    formatRepeatedPayload = sinon.stub(EventsRepetitionHelper, 'formatRepeatedPayload');
    insertMany = sinon.stub(Event, 'insertMany');
  });
  afterEach(() => {
    formatRepeatedPayload.restore();
    insertMany.restore();
  });

  it('should create repetition every day', async () => {
    const event = { startDate: '2019-01-10T09:00:00', endDate: '2019-01-10T11:00:00' };
    formatRepeatedPayload.returns(new Event());
    await EventsRepetitionHelper.createRepetitionsByWeek(event);

    sinon.assert.callCount(formatRepeatedPayload, 13);
    sinon.assert.callCount(insertMany, 1);
  });
});

describe('createRepetitions', () => {
  let findOneAndUpdate;
  let createRepetitionsEveryDay;
  let createRepetitionsEveryWeekDay;
  let createRepetitionsByWeek;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(Event, 'findOneAndUpdate');
    createRepetitionsEveryDay = sinon.stub(EventsRepetitionHelper, 'createRepetitionsEveryDay');
    createRepetitionsEveryWeekDay = sinon.stub(EventsRepetitionHelper, 'createRepetitionsEveryWeekDay');
    createRepetitionsByWeek = sinon.stub(EventsRepetitionHelper, 'createRepetitionsByWeek');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
    createRepetitionsEveryDay.restore();
    createRepetitionsEveryWeekDay.restore();
    createRepetitionsByWeek.restore();
  });

  it('should call createRepetitionsEveryDay', async () => {
    const payload = { _id: '1234567890', repetition: { frequency: 'every_day', parentId: '0987654321' } };
    const event = new Event({ repetition: { frequency: EVERY_WEEK } });
    await EventsRepetitionHelper.createRepetitions(event, payload);

    sinon.assert.called(findOneAndUpdate);
  });

  it('should call createRepetitionsEveryDay', async () => {
    const payload = { _id: '1234567890', repetition: { frequency: 'every_day', parentId: '0987654321' } };
    const event = new Event();
    await EventsRepetitionHelper.createRepetitions(event, payload);

    sinon.assert.notCalled(findOneAndUpdate);
    sinon.assert.called(createRepetitionsEveryDay);
  });

  it('should call createRepetitionsEveryWeekDay', async () => {
    const payload = { _id: '1234567890', repetition: { frequency: 'every_week_day', parentId: '0987654321' } };
    const event = new Event();
    await EventsRepetitionHelper.createRepetitions(event, payload);

    sinon.assert.notCalled(findOneAndUpdate);
    sinon.assert.called(createRepetitionsEveryWeekDay);
  });

  it('should call createRepetitionsByWeek to repeat every week', async () => {
    const payload = { _id: '1234567890', repetition: { frequency: 'every_week', parentId: '0987654321' } };
    const event = new Event();
    await EventsRepetitionHelper.createRepetitions(event, payload);

    sinon.assert.notCalled(findOneAndUpdate);
    sinon.assert.calledWith(createRepetitionsByWeek, payload, 1);
  });

  it('should call createRepetitionsByWeek to repeat every two weeks', async () => {
    const payload = { _id: '1234567890', repetition: { frequency: 'every_two_weeks', parentId: '0987654321' } };
    const event = new Event();
    await EventsRepetitionHelper.createRepetitions(event, payload);

    sinon.assert.notCalled(findOneAndUpdate);
    sinon.assert.calledWith(createRepetitionsByWeek, payload, 2);
  });
});

describe('updateRepetition', () => {
  let hasConflicts;
  let findEvent;
  let findOneAndUpdateEvent;
  beforeEach(() => {
    hasConflicts = sinon.stub(EventsValidationHelper, 'hasConflicts');
    findEvent = sinon.stub(Event, 'find');
    findOneAndUpdateEvent = sinon.stub(Event, 'findOneAndUpdate');
  });
  afterEach(() => {
    hasConflicts.restore();
    findEvent.restore();
    findOneAndUpdateEvent.restore();
  });

  it('should update repetition', async () => {
    const event = { repetition: { parentId: 'qwertyuiop', frequency: 'every_day' }, startDate: '2019-03-23T09:00:00.000Z', type: INTERVENTION };
    const payload = { startDate: '2019-03-23T10:00:00.000Z', endDate: '2019-03-23T11:00:00.000Z', auxiliary: '1234567890' };
    const events = [
      { repetition: { parentId: 'qwertyuiop', frequency: 'every_day' }, startDate: '2019-03-23T09:00:00.000Z', endDate: '2019-03-23T11:00:00.000Z', _id: 'asdfghjk' },
      { repetition: { parentId: 'qwertyuiop', frequency: 'every_day' }, startDate: '2019-03-24T09:00:00.000Z', endDate: '2019-03-24T11:00:00.000Z', _id: '123456' },
      { repetition: { parentId: 'qwertyuiop', frequency: 'every_day' }, startDate: '2019-03-25T09:00:00.000Z', endDate: '2019-03-25T11:00:00.000Z', _id: '654321' },
    ];
    findEvent.returns(events);
    hasConflicts.returns(false);

    await EventsRepetitionHelper.updateRepetition(event, payload);

    sinon.assert.calledWith(findEvent, { 'repetition.parentId': 'qwertyuiop', startDate: { $gte: new Date('2019-03-23T09:00:00.000Z') } });
    sinon.assert.calledThrice(hasConflicts);
    sinon.assert.calledThrice(findOneAndUpdateEvent);
  });

  it('should unassign intervention in conflict', async () => {
    const event = { repetition: { parentId: 'qwertyuiop', frequency: 'every_day' }, startDate: '2019-03-23T09:00:00.000Z', type: INTERVENTION };
    const payload = { startDate: '2019-03-23T10:00:00.000Z', endDate: '2019-03-23T11:00:00.000Z', auxiliary: '1234567890' };
    const events = [
      { repetition: { parentId: 'qwertyuiop', frequency: 'every_day' }, startDate: '2019-03-24T09:00:00.000Z', endDate: '2019-03-24T11:00:00.000Z', _id: '123456' },
    ];
    findEvent.returns(events);
    hasConflicts.returns(true);

    await EventsRepetitionHelper.updateRepetition(event, payload);

    sinon.assert.calledWith(
      hasConflicts,
      { _id: '123456', auxiliary: '1234567890', startDate: '2019-03-24T10:00:00.000Z', endDate: '2019-03-24T11:00:00.000Z' }
    );
    sinon.assert.calledWith(
      findOneAndUpdateEvent,
      { _id: '123456' },
      { $set: { _id: '123456', startDate: '2019-03-24T10:00:00.000Z', endDate: '2019-03-24T11:00:00.000Z' }, $unset: { auxiliary: '', repetition: '' } }
    );
  });
});

describe('deleteRepetition', () => {
  let createEventHistoryOnDelete;
  let deleteMany;
  const credentials = { _id: (new ObjectID()).toHexString() };
  beforeEach(() => {
    createEventHistoryOnDelete = sinon.stub(EventHistoriesHelper, 'createEventHistoryOnDelete');
    deleteMany = sinon.stub(Event, 'deleteMany');
  });
  afterEach(() => {
    createEventHistoryOnDelete.restore();
    deleteMany.restore();
  });

  it('should delete repetition', async () => {
    const parentId = new ObjectID();
    const event = {
      type: INTERVENTION,
      repetition: {
        frequency: EVERY_WEEK,
        parentId,
      },
      startDate: '2019-01-21T09:38:18.653Z',
    };
    const result = await EventsRepetitionHelper.deleteRepetition(event, credentials);

    expect(result).toEqual(event);
    sinon.assert.calledWith(createEventHistoryOnDelete, event, credentials);
    sinon.assert.calledWith(
      deleteMany,
      {
        'repetition.parentId': parentId,
        startDate: { $gte: new Date(event.startDate) },
        $or: [{ isBilled: false }, { isBilled: { $exists: false } }],
      }
    );
  });

  it('should not delete repetition as event is absence', async () => {
    const event = {
      type: ABSENCE,
      repetition: { frequency: EVERY_WEEK },
      startDate: '2019-01-21T09:38:18.653Z',
    };
    const result = await EventsRepetitionHelper.deleteRepetition(event, credentials);

    expect(result).toEqual(event);
    sinon.assert.calledWith(createEventHistoryOnDelete, event, credentials);
    sinon.assert.notCalled(deleteMany);
  });

  it('should not delete repetition as event is not a repetition', async () => {
    const parentId = new ObjectID();
    const event = {
      type: INTERVENTION,
      repetition: {
        frequency: NEVER,
        parentId,
      },
      startDate: '2019-01-21T09:38:18.653Z',
    };
    const result = await EventsRepetitionHelper.deleteRepetition(event, credentials);

    expect(result).toEqual(event);
    sinon.assert.calledWith(createEventHistoryOnDelete, event, credentials);
    sinon.assert.notCalled(deleteMany);
  });
});
