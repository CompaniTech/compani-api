const expect = require('expect');
const sinon = require('sinon');
const omit = require('lodash/omit');
const Boom = require('@hapi/boom');
const { ObjectId } = require('mongodb');
const moment = require('moment');
const Event = require('../../../src/models/Event');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const Repetition = require('../../../src/models/Repetition');
const DistanceMatrix = require('../../../src/models/DistanceMatrix');
const EventHelper = require('../../../src/helpers/events');
const DistanceMatrixHelper = require('../../../src/helpers/distanceMatrix');
const ContractHelper = require('../../../src/helpers/contracts');
const UtilsHelper = require('../../../src/helpers/utils');
const EventsRepetitionHelper = require('../../../src/helpers/eventsRepetition');
const EventHistoriesHelper = require('../../../src/helpers/eventHistories');
const EventsValidationHelper = require('../../../src/helpers/eventsValidation');
const CustomerAbsenceHelper = require('../../../src/helpers/customerAbsences');
const DraftPayHelper = require('../../../src/helpers/draftPay');
const EventRepository = require('../../../src/repositories/EventRepository');
const {
  INTERVENTION,
  AUXILIARY_INITIATIVE,
  INTERNAL_HOUR,
  ABSENCE,
  UNAVAILABILITY,
  NEVER,
  EVERY_WEEK,
  AUXILIARY,
  CUSTOMER,
  PLANNING_VIEW_END_HOUR,
} = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('list', () => {
  let getEventsGroupedByCustomersStub;
  let getEventsGroupedByAuxiliariesStub;
  let populateEventsStub;
  let getEventListStub;
  let getListQueryStub;

  beforeEach(() => {
    getEventsGroupedByCustomersStub = sinon.stub(EventRepository, 'getEventsGroupedByCustomers');
    getEventsGroupedByAuxiliariesStub = sinon.stub(EventRepository, 'getEventsGroupedByAuxiliaries');
    populateEventsStub = sinon.stub(EventHelper, 'populateEvents');
    getEventListStub = sinon.stub(EventRepository, 'getEventList');
    getListQueryStub = sinon.stub(EventHelper, 'getListQuery');
  });

  afterEach(() => {
    getEventsGroupedByCustomersStub.restore();
    getEventsGroupedByAuxiliariesStub.restore();
    populateEventsStub.restore();
    getEventListStub.restore();
    getListQueryStub.restore();
  });
  const companyId = new ObjectId();
  const credentials = { company: { _id: companyId } };

  it('should list events grouped by customer', async () => {
    const query = { groupBy: CUSTOMER };
    const eventsQuery = {};
    getListQueryStub.returns(eventsQuery);
    const events = [{ type: 'intervention' }];
    getEventsGroupedByCustomersStub.returns(events);

    const result = await EventHelper.list(query, credentials);

    expect(result).toEqual(events);
    sinon.assert.calledOnceWithExactly(getEventsGroupedByCustomersStub, eventsQuery, companyId);
    sinon.assert.notCalled(getEventsGroupedByAuxiliariesStub);
    sinon.assert.notCalled(getEventListStub);
    sinon.assert.notCalled(populateEventsStub);
  });

  it('should list events grouped by auxiliary', async () => {
    const query = { groupBy: AUXILIARY };
    const eventsQuery = {};
    getListQueryStub.returns(eventsQuery);
    const events = [{ type: 'intervention' }];
    getEventsGroupedByAuxiliariesStub.returns(events);

    const result = await EventHelper.list(query, credentials);

    expect(result).toEqual(events);
    sinon.assert.notCalled(getEventsGroupedByCustomersStub);
    sinon.assert.calledOnceWithExactly(getEventsGroupedByAuxiliariesStub, eventsQuery, companyId);
    sinon.assert.notCalled(getEventListStub);
    sinon.assert.notCalled(populateEventsStub);
  });

  it('should list events', async () => {
    const query = {};
    const eventsQuery = { customer: new ObjectId(), type: 'intervention', isCancelled: false };
    getListQueryStub.returns(eventsQuery);
    const events = [{ type: 'intervention' }];
    getEventListStub.returns(events);
    const populatedEvents = [{ type: 'intervention', customer: new ObjectId() }];
    populateEventsStub.returns(populatedEvents);

    const result = await EventHelper.list(query, credentials);

    expect(result).toEqual(populatedEvents);
    sinon.assert.notCalled(getEventsGroupedByAuxiliariesStub);
    sinon.assert.notCalled(getEventsGroupedByCustomersStub);
    sinon.assert.calledOnceWithExactly(getEventListStub, eventsQuery, companyId);
    sinon.assert.calledOnceWithExactly(populateEventsStub, events);
  });
});

describe('isRepetition', () => {
  it('should return true if event is repetition with frequency not never', () => {
    const res = EventHelper.isRepetition({ repetition: { frequency: 'every_week' } });
    expect(res).toBe(true);
  });

  it('should return false if event is repetition with frequency never', () => {
    const res = EventHelper.isRepetition({ repetition: { frequency: 'never' } });
    expect(res).toBe(false);
  });

  it('should return false if event is repetition without frequency', () => {
    const res = EventHelper.isRepetition({ repetition: { id: '123' } });
    expect(res).toBe(false);
  });

  it('should return false if event is not a repetition', () => {
    const res = EventHelper.isRepetition({ repetition: { id: '123' } });
    expect(res).toBe(false);
  });
});

describe('formatEditionPayload', () => {
  it('Case 1: event is detached from repetition', () => {
    const payload = { startDate: '2019-01-10T10:00:00', sector: new ObjectId(), misc: 'lalalal' };
    const event = { repetition: { frequency: EVERY_WEEK } };

    const result = EventHelper.formatEditionPayload(event, payload, true);

    expect(result).toEqual({ $set: { ...payload, 'repetition.frequency': NEVER }, $unset: { auxiliary: '' } });
  });

  it('Case 2: event is not detached from repetition', () => {
    const payload = { misc: 'lalala' };
    const event = { repetition: { frequency: EVERY_WEEK } };

    const result = EventHelper.formatEditionPayload(event, payload, false);

    expect(result).toEqual({ $set: payload, $unset: { auxiliary: '' } });
  });

  it('Case 4: auxiliary is in payload', () => {
    const payload = { startDate: '2019-01-10T10:00:00', auxiliary: new ObjectId() };
    const event = {};

    const result = EventHelper.formatEditionPayload(event, payload, false);

    expect(result).toEqual({ $set: payload, $unset: { sector: '' } });
  });
  it('Case 5: remove cancellation', () => {
    const payload = { isCancelled: false, startDate: '2019-01-10T10:00:00', sector: new ObjectId() };
    const event = { isCancelled: true, cancel: { reason: AUXILIARY_INITIATIVE } };

    const result = EventHelper.formatEditionPayload(event, payload, false);

    expect(result).toEqual({ $set: { ...payload, isCancelled: false }, $unset: { auxiliary: '', cancel: '' } });
  });
  it('Case 5: remove address', () => {
    const auxiliary = new ObjectId();
    const payload = { address: {}, auxiliary };
    const event = { auxiliary };

    const result = EventHelper.formatEditionPayload(event, payload, false);

    expect(result).toEqual({ $set: payload, $unset: { address: '', sector: '' } });
  });
});

describe('updateEvent', () => {
  let isRepetitionValid;
  let isUpdateAllowed;
  let createEventHistoryOnUpdate;
  let updateRepetition;
  let isRepetition;
  let shouldDetachFromRepetition;
  let formatEditionPayload;
  let updateOne;
  let findOne;
  let deleteConflictInternalHoursAndUnavailabilities;
  let unassignConflictInterventions;
  let populateEventSubscription;

  beforeEach(() => {
    isRepetitionValid = sinon.stub(EventsRepetitionHelper, 'isRepetitionValid');
    isUpdateAllowed = sinon.stub(EventsValidationHelper, 'isUpdateAllowed');
    createEventHistoryOnUpdate = sinon.stub(EventHistoriesHelper, 'createEventHistoryOnUpdate');
    updateRepetition = sinon.stub(EventsRepetitionHelper, 'updateRepetition');
    isRepetition = sinon.stub(EventHelper, 'isRepetition');
    shouldDetachFromRepetition = sinon.stub(EventHelper, 'shouldDetachFromRepetition');
    formatEditionPayload = sinon.stub(EventHelper, 'formatEditionPayload');
    updateOne = sinon.stub(Event, 'updateOne');
    findOne = sinon.stub(Event, 'findOne');
    deleteConflictInternalHoursAndUnavailabilities = sinon.stub(
      EventHelper,
      'deleteConflictInternalHoursAndUnavailabilities'
    );
    unassignConflictInterventions = sinon.stub(EventHelper, 'unassignConflictInterventions');
    populateEventSubscription = sinon.stub(EventHelper, 'populateEventSubscription');
  });
  afterEach(() => {
    isRepetitionValid.restore();
    isUpdateAllowed.restore();
    createEventHistoryOnUpdate.restore();
    updateRepetition.restore();
    isRepetition.restore();
    shouldDetachFromRepetition.restore();
    formatEditionPayload.restore();
    updateOne.restore();
    findOne.restore();
    deleteConflictInternalHoursAndUnavailabilities.restore();
    unassignConflictInterventions.restore();
    populateEventSubscription.restore();
  });

  it('should throw 400 if event is not absence and not on one day', async () => {
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
    const auxiliaryId = new ObjectId();
    const event = { _id: new ObjectId(), type: INTERVENTION, auxiliary: { _id: auxiliaryId } };
    const payload = {
      startDate: '2019-01-21T09:38:18',
      endDate: '2019-01-22T10:38:18',
      auxiliary: auxiliaryId.toHexString(),
    };

    try {
      await EventHelper.updateEvent(event, payload, credentials);
    } catch (e) {
      expect(e.output.statusCode).toEqual(400);
      expect(e.output.payload.message).toEqual('Les dates de début et de fin devraient être le même jour.');
    } finally {
      sinon.assert.notCalled(isRepetitionValid);
      sinon.assert.notCalled(isUpdateAllowed);
      sinon.assert.notCalled(createEventHistoryOnUpdate);
      sinon.assert.notCalled(updateRepetition);
      sinon.assert.notCalled(isRepetition);
      sinon.assert.notCalled(shouldDetachFromRepetition);
      sinon.assert.notCalled(formatEditionPayload);
      sinon.assert.notCalled(updateOne);
      sinon.assert.notCalled(findOne);
      sinon.assert.notCalled(deleteConflictInternalHoursAndUnavailabilities);
      sinon.assert.notCalled(unassignConflictInterventions);
      sinon.assert.notCalled(populateEventSubscription);
    }
  });

  it('shouldUpdateRepetition = true - should throw 422 if invalid repetition', async () => {
    try {
      const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
      const auxiliary = new ObjectId();
      const event = { _id: new ObjectId(), type: INTERVENTION, auxiliary, repetition: { frequency: 'every_week' } };
      const payload = {
        startDate: '2019-01-21T09:38:18',
        endDate: '2019-01-21T10:38:18',
        auxiliary: auxiliary.toHexString(),
        shouldUpdateRepetition: true,
      };

      isRepetitionValid.returns(false);

      await EventHelper.updateEvent(event, payload, credentials);
    } catch (e) {
      expect(e.output.statusCode).toBe(422);
    } finally {
      sinon.assert.calledOnceWithExactly(isRepetitionValid, { frequency: 'every_week' });
      sinon.assert.notCalled(isUpdateAllowed);
      sinon.assert.notCalled(createEventHistoryOnUpdate);
      sinon.assert.notCalled(updateRepetition);
      sinon.assert.notCalled(isRepetition);
      sinon.assert.notCalled(shouldDetachFromRepetition);
      sinon.assert.notCalled(formatEditionPayload);
      sinon.assert.notCalled(updateOne);
      sinon.assert.notCalled(findOne);
      sinon.assert.notCalled(deleteConflictInternalHoursAndUnavailabilities);
      sinon.assert.notCalled(unassignConflictInterventions);
      sinon.assert.notCalled(populateEventSubscription);
    }
  });

  it('shouldUpdateRepetition = true - should throw 422 if update is not allowed', async () => {
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
    const auxiliary = new ObjectId();
    const event = { _id: new ObjectId(), type: INTERVENTION, auxiliary, repetition: { frequency: 'every_week' } };
    const payload = {
      startDate: '2019-01-21T09:38:18',
      endDate: '2019-01-21T10:38:18',
      auxiliary: auxiliary.toHexString(),
      shouldUpdateRepetition: true,
    };

    isRepetitionValid.returns(true);
    isUpdateAllowed.returns(false);

    try {
      await EventHelper.updateEvent(event, payload, credentials);
    } catch (e) {
      expect(e.output.statusCode).toBe(422);
    } finally {
      sinon.assert.calledOnceWithExactly(isRepetitionValid, { frequency: 'every_week' });
      sinon.assert.calledOnceWithExactly(isUpdateAllowed, event, payload, credentials);
      sinon.assert.notCalled(createEventHistoryOnUpdate);
      sinon.assert.notCalled(updateRepetition);
      sinon.assert.notCalled(isRepetition);
      sinon.assert.notCalled(shouldDetachFromRepetition);
      sinon.assert.notCalled(formatEditionPayload);
      sinon.assert.notCalled(updateOne);
      sinon.assert.notCalled(findOne);
      sinon.assert.notCalled(deleteConflictInternalHoursAndUnavailabilities);
      sinon.assert.notCalled(unassignConflictInterventions);
      sinon.assert.notCalled(populateEventSubscription);
    }
  });

  it('shouldUpdateRepetition = true - should update repetition', async () => {
    const companyId = new ObjectId();
    const credentials = { _id: new ObjectId(), company: { _id: companyId } };
    const eventId = new ObjectId();
    const auxiliary = new ObjectId();
    const parentId = new ObjectId();
    const event = { _id: eventId, type: INTERVENTION, auxiliary, repetition: { frequency: 'every_week', parentId } };
    const payload = {
      startDate: '2019-01-21T09:38:18',
      endDate: '2019-01-21T10:38:18',
      auxiliary: auxiliary.toHexString(),
      shouldUpdateRepetition: true,
    };

    isRepetitionValid.returns(true);
    isUpdateAllowed.returns(true);
    findOne.returns(SinonMongoose.stubChainedQueries([event]));

    await EventHelper.updateEvent(event, payload, credentials);

    sinon.assert.calledOnceWithExactly(isRepetitionValid, { frequency: 'every_week', parentId });
    sinon.assert.calledOnceWithExactly(isUpdateAllowed, event, payload, credentials);
    sinon.assert.calledOnceWithExactly(createEventHistoryOnUpdate, payload, event, credentials);
    sinon.assert.calledOnceWithExactly(updateRepetition, event, payload, credentials);
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: event._id }] },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'identity administrative.driveFolder administrative.transportInvoice company picture',
            populate: { path: 'sector', select: '_id sector', match: { company: companyId } },
          }],
        },
        { query: 'populate', args: [{ path: 'customer', select: 'identity subscriptions contact' }] },
        { query: 'populate', args: [{ path: 'internalHour', match: { company: companyId } }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(populateEventSubscription, event);
    sinon.assert.notCalled(isRepetition);
    sinon.assert.notCalled(shouldDetachFromRepetition);
    sinon.assert.notCalled(formatEditionPayload);
    sinon.assert.notCalled(updateOne);
    sinon.assert.notCalled(deleteConflictInternalHoursAndUnavailabilities);
    sinon.assert.notCalled(unassignConflictInterventions);
  });

  it('shouldUpdateRepetition = false - should throw 422 if update is not allowed', async () => {
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
    const auxiliary = new ObjectId();
    const eventId = new ObjectId();
    const event = { _id: eventId, type: INTERVENTION, auxiliary, repetition: { frequency: 'every_week' } };
    const payload = {
      startDate: '2019-01-21T09:38:18',
      endDate: '2019-01-21T10:38:18',
      auxiliary: auxiliary.toHexString(),
      shouldUpdateRepetition: false,
    };

    isRepetition.returns(true);
    shouldDetachFromRepetition.returns(false);
    formatEditionPayload.returns({ $set: { _id: eventId }, $unset: { sector: '' } });
    isUpdateAllowed.returns(false);

    try {
      await EventHelper.updateEvent(event, payload, credentials);
    } catch (e) {
      expect(e.output.statusCode).toBe(422);
    } finally {
      sinon.assert.notCalled(isRepetitionValid);
      sinon.assert.calledOnceWithExactly(isUpdateAllowed, event, { _id: eventId }, credentials);
      sinon.assert.notCalled(createEventHistoryOnUpdate);
      sinon.assert.notCalled(updateRepetition);
      sinon.assert.calledOnceWithExactly(isRepetition, event);
      sinon.assert.calledOnceWithExactly(shouldDetachFromRepetition, event, payload);
      sinon.assert.calledOnceWithExactly(formatEditionPayload, event, payload, false);
      sinon.assert.notCalled(updateOne);
      sinon.assert.notCalled(findOne);
      sinon.assert.notCalled(deleteConflictInternalHoursAndUnavailabilities);
      sinon.assert.notCalled(unassignConflictInterventions);
      sinon.assert.notCalled(populateEventSubscription);
    }
  });

  it('shouldUpdateRepetition = false - should update event', async () => {
    const companyId = new ObjectId();
    const credentials = { _id: new ObjectId(), company: { _id: companyId } };
    const eventId = new ObjectId();
    const auxiliaryId = new ObjectId();
    const event = { _id: eventId, type: INTERVENTION, auxiliary: { _id: auxiliaryId } };
    const payload = {
      startDate: '2019-01-21T09:38:18',
      endDate: '2019-01-21T12:38:18',
      auxiliary: auxiliaryId.toHexString(),
      misc: 'test',
    };

    isRepetition.returns(true);
    shouldDetachFromRepetition.returns(true);
    isUpdateAllowed.returns(true);
    formatEditionPayload.returns({ $set: { _id: eventId }, $unset: {} });
    findOne.returns(SinonMongoose.stubChainedQueries([{ ...event, updated: 1 }]));

    await EventHelper.updateEvent(event, payload, credentials);

    sinon.assert.notCalled(isRepetitionValid);
    sinon.assert.notCalled(updateRepetition);
    sinon.assert.calledOnceWithExactly(isUpdateAllowed, event, { _id: eventId }, credentials);
    sinon.assert.calledOnceWithExactly(isRepetition, event);
    sinon.assert.calledOnceWithExactly(shouldDetachFromRepetition, event, payload);
    sinon.assert.calledOnceWithExactly(formatEditionPayload, event, payload, true);
    sinon.assert.calledOnceWithExactly(createEventHistoryOnUpdate, { _id: event._id }, event, credentials);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: event._id }, { $set: { _id: eventId }, $unset: {} });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: event._id }] },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'identity administrative.driveFolder administrative.transportInvoice company picture',
            populate: { path: 'sector', select: '_id sector', match: { company: companyId } },
          }],
        },
        { query: 'populate', args: [{ path: 'customer', select: 'identity subscriptions contact' }] },
        { query: 'populate', args: [{ path: 'internalHour', match: { company: companyId } }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(deleteConflictInternalHoursAndUnavailabilities);
    sinon.assert.notCalled(unassignConflictInterventions);
    sinon.assert.calledOnceWithExactly(populateEventSubscription, { ...event, updated: 1 });
  });

  it('shouldUpdateRepetition = false - should update absence', async () => {
    const companyId = new ObjectId();
    const credentials = { _id: new ObjectId(), company: { _id: companyId } };
    const eventId = new ObjectId();
    const auxiliaryId = new ObjectId();
    const event = {
      _id: eventId,
      type: ABSENCE,
      auxiliary: { _id: auxiliaryId },
      startDate: '2019-01-21T00:00:00',
      endDate: '2019-01-24T23:59:59',
    };
    const payload = {
      startDate: '2019-01-21T00:00:00',
      endDate: '2019-01-24T23:59:59',
      auxiliary: auxiliaryId.toHexString(),
    };

    isRepetition.returns(false);
    isUpdateAllowed.returns(true);
    formatEditionPayload.returns({ $set: { _id: eventId }, $unset: {} });
    findOne.returns(SinonMongoose.stubChainedQueries([{ ...event, updated: 1 }]));

    await EventHelper.updateEvent(event, payload, credentials);

    sinon.assert.notCalled(isRepetitionValid);
    sinon.assert.notCalled(updateRepetition);
    sinon.assert.calledOnceWithExactly(isUpdateAllowed, event, { _id: eventId }, credentials);
    sinon.assert.calledOnceWithExactly(isRepetition, event);
    sinon.assert.notCalled(shouldDetachFromRepetition);
    sinon.assert.calledOnceWithExactly(formatEditionPayload, event, payload, false);
    sinon.assert.calledOnceWithExactly(createEventHistoryOnUpdate, { _id: event._id }, event, credentials);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: event._id }, { $set: { _id: eventId }, $unset: {} });
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: event._id }] },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'identity administrative.driveFolder administrative.transportInvoice company picture',
            populate: { path: 'sector', select: '_id sector', match: { company: companyId } },
          }],
        },
        { query: 'populate', args: [{ path: 'customer', select: 'identity subscriptions contact' }] },
        { query: 'populate', args: [{ path: 'internalHour', match: { company: companyId } }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      deleteConflictInternalHoursAndUnavailabilities,
      { ...event, updated: 1 },
      { _id: auxiliaryId },
      credentials
    );
    sinon.assert.calledOnceWithExactly(
      unassignConflictInterventions,
      { startDate: '2019-01-21T00:00:00', endDate: '2019-01-24T23:59:59' },
      { _id: auxiliaryId },
      credentials
    );
    sinon.assert.calledOnceWithExactly(populateEventSubscription, { ...event, updated: 1 });
  });
});

describe('listForCreditNotes', () => {
  let findEvent;
  beforeEach(() => {
    findEvent = sinon.stub(Event, 'find');
  });
  afterEach(() => {
    findEvent.restore();
  });
  it('should return events with creditNotes at creation', async () => {
    const events = [{ type: 'intervention' }];
    const companyId = new ObjectId();
    const payload = { customer: new ObjectId() };

    const query = {
      startDate: { $gte: moment(payload.startDate).startOf('d').toDate() },
      endDate: { $lte: moment(payload.endDate).endOf('d').toDate() },
      customer: payload.customer,
      isBilled: true,
      type: INTERVENTION,
      company: companyId,
      'bills.inclTaxesCustomer': { $exists: true, $gt: 0 },
      'bills.inclTaxesTpp': { $exists: false },
    };

    findEvent.returns(SinonMongoose.stubChainedQueries([events], ['sort', 'lean']));

    const result = await EventHelper.listForCreditNotes(payload, { company: { _id: companyId } });

    expect(result).toBeDefined();
    expect(result).toBe(events);

    SinonMongoose.calledOnceWithExactly(
      findEvent,
      [
        { query: 'find', args: [query] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should query with thirdPartyPayer', async () => {
    const companyId = new ObjectId();
    const payload = { thirdPartyPayer: new ObjectId(), customer: new ObjectId() };

    const query = {
      startDate: { $gte: moment(payload.startDate).startOf('d').toDate() },
      endDate: { $lte: moment(payload.endDate).endOf('d').toDate() },
      customer: payload.customer,
      isBilled: true,
      type: INTERVENTION,
      company: companyId,
      'bills.thirdPartyPayer': payload.thirdPartyPayer,
    };

    findEvent.returns(SinonMongoose.stubChainedQueries([[{ type: 'intervention' }]], ['sort', 'lean']));

    const result = await EventHelper.listForCreditNotes(payload, { company: { _id: companyId } });

    expect(result).toBeDefined();
    expect(result).toEqual([{ type: 'intervention' }]);

    SinonMongoose.calledOnceWithExactly(
      findEvent,
      [
        { query: 'find', args: [query] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return events with creditNotes at edition', async () => {
    const events = [{ type: 'intervention' }];
    const companyId = new ObjectId();
    const payload = { customer: new ObjectId() };
    const creditNote = { events: [{ eventId: new ObjectId() }] };

    const query = {
      startDate: { $gte: moment(payload.startDate).startOf('d').toDate() },
      endDate: { $lte: moment(payload.endDate).endOf('d').toDate() },
      customer: payload.customer,
      type: INTERVENTION,
      company: companyId,
      'bills.inclTaxesCustomer': { $exists: true, $gt: 0 },
      'bills.inclTaxesTpp': { $exists: false },
      $or: [{ isBilled: true }, { _id: { $in: creditNote.events.map(event => event.eventId) } }],
    };

    findEvent.returns(SinonMongoose.stubChainedQueries([events], ['sort', 'lean']));

    const result = await EventHelper.listForCreditNotes(payload, { company: { _id: companyId } }, creditNote);

    expect(result).toBeDefined();
    expect(result).toBe(events);

    SinonMongoose.calledOnceWithExactly(
      findEvent,
      [
        { query: 'find', args: [query] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('populateEventSubscription', () => {
  it('should populate subscription as event is an intervention', async () => {
    const subId = new ObjectId();
    const event = {
      type: 'intervention',
      customer: {
        subscriptions: [
          {
            createdAt: '2019-01-11T08:38:18.653Z',
            _id: subId,
            service: new ObjectId(),
            unitTTCRate: 25,
            estimatedWeeklyVolume: 12,
            sundays: 2,
          },
          {
            createdAt: '2019-01-21T09:38:18',
            _id: new ObjectId(),
            service: new ObjectId(),
            unitTTCRate: 25,
            estimatedWeeklyVolume: 12,
            sundays: 2,
          },
        ],
      },
      subscription: subId,
    };

    const result = await EventHelper.populateEventSubscription(event);
    expect(result.subscription).toBeDefined();
    expect(result.subscription._id).toEqual(event.subscription);
  });

  it('should not modify the input as event is not an intervention', async () => {
    const event = { type: 'absence' };

    const result = await EventHelper.populateEventSubscription(event);
    expect(result.subscription).toBeUndefined();
    expect(result).toEqual(event);
  });

  it('should return an error as event is intervention but customer is undefined', async () => {
    const event = { type: 'intervention' };

    try {
      await EventHelper.populateEventSubscription(event);
    } catch (e) {
      expect(e.output.statusCode).toEqual(500);
    }
  });

  it('should throw an error as no corresopnding subscription is found in the customer', async () => {
    const event = {
      type: 'intervention',
      customer: {
        subscriptions: [
          {
            createdAt: '2019-01-21T09:38:18',
            _id: new ObjectId(),
            service: new ObjectId(),
            unitTTCRate: 25,
            estimatedWeeklyVolume: 12,
            sundays: 2,
          },
        ],
      },
      subscription: new ObjectId(),
    };

    try {
      await EventHelper.populateEventSubscription(event);
    } catch (e) {
      expect(e.output.statusCode).toEqual(500);
    }
  });
});

describe('populateEvents', () => {
  let populateEventSubscription;
  beforeEach(() => {
    populateEventSubscription = sinon.stub(EventHelper, 'populateEventSubscription');
  });
  afterEach(() => {
    populateEventSubscription.restore();
  });

  it('should populate subscription as event is an intervention', async () => {
    const subIdList = [new ObjectId(), new ObjectId()];
    const events = [
      {
        type: 'intervention',
        customer: {
          subscriptions: [
            {
              createdAt: '2019-01-11T08:38:18.653Z',
              _id: subIdList[0],
              service: new ObjectId(),
              unitTTCRate: 25,
              estimatedWeeklyVolume: 12,
              sundays: 2,
            },
            {
              createdAt: '2019-01-21T09:38:18',
              _id: new ObjectId(),
              service: new ObjectId(),
              unitTTCRate: 25,
              estimatedWeeklyVolume: 12,
              sundays: 2,
            },
          ],
        },
        subscription: subIdList[0],
      },
      {
        type: 'intervention',
        customer: {
          subscriptions: [
            {
              createdAt: '2019-01-12T08:38:18.653Z',
              _id: subIdList,
              service: new ObjectId(),
              unitTTCRate: 25,
              estimatedWeeklyVolume: 12,
              sundays: 2,
            },
            {
              createdAt: '2019-01-22T09:38:18.653Z',
              _id: new ObjectId(),
              service: new ObjectId(),
              unitTTCRate: 25,
              estimatedWeeklyVolume: 12,
              sundays: 2,
            },
          ],
        },
        subscription: subIdList,
      },
    ];

    await EventHelper.populateEvents(events);
    sinon.assert.callCount(populateEventSubscription, events.length);
  });
});

describe('removeRepetitionsOnContractEnd', () => {
  let updateManyRepetition;
  let deleteManyRepetition;

  const userId = new ObjectId();
  const sectorId = new ObjectId();

  beforeEach(() => {
    updateManyRepetition = sinon.stub(Repetition, 'updateMany');
    deleteManyRepetition = sinon.stub(Repetition, 'deleteMany');
  });
  afterEach(() => {
    updateManyRepetition.restore();
    deleteManyRepetition.restore();
  });

  it('should unassigned repetition intervention and remove other repetitions', async () => {
    const contract = { endDate: '2019-10-02T08:00:00.000Z', user: { _id: userId, sector: sectorId } };

    await EventHelper.removeRepetitionsOnContractEnd(contract);
    sinon.assert.calledOnceWithExactly(
      updateManyRepetition,
      { auxiliary: userId, type: 'intervention' },
      { $unset: { auxiliary: '' }, $set: { sector: sectorId } }
    );
    sinon.assert.calledOnceWithExactly(
      deleteManyRepetition,
      { auxiliary: userId, type: { $in: [UNAVAILABILITY, INTERNAL_HOUR] } }
    );
  });
});

describe('unassignInterventionsOnContractEnd', () => {
  let getInterventionsToUnassign;
  let createEventHistoryOnUpdate;
  let updateManyEvent;

  const userId = new ObjectId();
  const sectorId = new ObjectId();
  const companyId = new ObjectId();
  const credentials = { _id: userId, company: { _id: companyId } };

  const interventions = [
    {
      _id: null,
      events: [{
        _id: new ObjectId(),
        type: 'intervention',
        startDate: '2019-10-02T10:00:00.000Z',
        endDate: '2019-10-02T12:00:00.000Z',
        auxiliary: userId,
      }],
    },
    {
      _id: new ObjectId(),
      events: [{
        _id: new ObjectId(),
        misc: 'toto',
        type: 'intervention',
        startDate: '2019-10-02T11:00:00.000Z',
        endDate: '2019-10-02T13:00:00.000Z',
        auxiliary: userId,
      }],
    },
  ];

  beforeEach(() => {
    getInterventionsToUnassign = sinon.stub(EventRepository, 'getInterventionsToUnassign');
    createEventHistoryOnUpdate = sinon.stub(EventHistoriesHelper, 'createEventHistoryOnUpdate');
    updateManyEvent = sinon.stub(Event, 'updateMany');
  });
  afterEach(() => {
    getInterventionsToUnassign.restore();
    createEventHistoryOnUpdate.restore();
    updateManyEvent.restore();
  });

  it('should unassign future events linked to contract', async () => {
    const contract = { endDate: '2019-10-02T08:00:00.000Z', user: { _id: userId, sector: sectorId } };
    getInterventionsToUnassign.returns(interventions);

    await EventHelper.unassignInterventionsOnContractEnd(contract, credentials);
    sinon.assert.calledOnceWithExactly(
      getInterventionsToUnassign,
      contract.endDate,
      contract.user._id,
      companyId
    );
    sinon.assert.calledTwice(createEventHistoryOnUpdate);
    sinon.assert.calledOnceWithExactly(
      updateManyEvent,
      { _id: { $in: [interventions[0].events[0]._id, interventions[1].events[0]._id] } },
      { $set: { 'repetition.frequency': NEVER, sector: sectorId }, $unset: { auxiliary: '' } }
    );
  });

  it('should create event history for repetition', async () => {
    const contract = { endDate: '2019-10-02T08:00:00.000Z', user: { _id: userId, sector: sectorId } };
    getInterventionsToUnassign.returns([interventions[1]]);

    await EventHelper.unassignInterventionsOnContractEnd(contract, credentials);
    sinon.assert.calledOnceWithExactly(
      createEventHistoryOnUpdate,
      {
        misc: 'toto',
        startDate: '2019-10-02T11:00:00.000Z',
        endDate: '2019-10-02T13:00:00.000Z',
        shouldUpdateRepetition: true,
      },
      interventions[1].events[0],
      credentials
    );
    sinon.assert.calledOnceWithExactly(
      updateManyEvent,
      { _id: { $in: [interventions[1].events[0]._id] } },
      { $set: { 'repetition.frequency': NEVER, sector: sectorId }, $unset: { auxiliary: '' } }
    );
  });

  it('should create event history for non repeated event', async () => {
    const contract = { endDate: '2019-10-02T08:00:00.000Z', user: { _id: userId, sector: sectorId } };
    getInterventionsToUnassign.returns([interventions[0]]);

    await EventHelper.unassignInterventionsOnContractEnd(contract, credentials);
    sinon.assert.calledOnceWithExactly(
      createEventHistoryOnUpdate,
      { misc: undefined, startDate: '2019-10-02T10:00:00.000Z', endDate: '2019-10-02T12:00:00.000Z' },
      interventions[0].events[0],
      credentials
    );
    sinon.assert.calledOnceWithExactly(
      updateManyEvent,
      { _id: { $in: [interventions[0].events[0]._id] } },
      { $set: { 'repetition.frequency': NEVER, sector: sectorId }, $unset: { auxiliary: '' } }
    );
  });
});

describe('removeEventsExceptInterventionsOnContractEnd', () => {
  let getEventsExceptInterventions;
  let createEventHistoryOnDelete;
  let deleteMany;
  const userId = new ObjectId();
  const sectorId = new ObjectId();
  const companyId = new ObjectId();
  const credentials = { _id: userId, company: { _id: companyId } };
  const events = [
    {
      _id: new ObjectId(),
      events: [{
        _id: new ObjectId(),
        type: 'internal_hour',
        startDate: '2019-10-02T10:00:00.000Z',
        endDate: '2019-10-02T12:00:00.000Z',
        auxiliary: userId,
      }],
    },
    {
      _id: new ObjectId(),
      events: [{
        _id: new ObjectId(),
        type: 'unavailability',
        startDate: '2019-10-02T11:00:00.000Z',
        endDate: '2019-10-02T13:00:00.000Z',
        auxiliary: userId,
      }],
    },
  ];

  beforeEach(() => {
    getEventsExceptInterventions = sinon.stub(EventRepository, 'getEventsExceptInterventions');
    createEventHistoryOnDelete = sinon.stub(EventHistoriesHelper, 'createEventHistoryOnDelete');
    deleteMany = sinon.stub(Event, 'deleteMany');
  });
  afterEach(() => {
    getEventsExceptInterventions.restore();
    createEventHistoryOnDelete.restore();
    deleteMany.restore();
  });

  it('should remove future non-intervention events linked to contract', async () => {
    const contract = { endDate: '2019-10-02T08:00:00.000Z', user: { _id: userId, sector: sectorId } };
    getEventsExceptInterventions.returns(events);

    await EventHelper.removeEventsExceptInterventionsOnContractEnd(contract, credentials);
    sinon.assert.calledOnceWithExactly(getEventsExceptInterventions, '2019-10-02T08:00:00.000Z', userId, companyId);
    sinon.assert.calledTwice(createEventHistoryOnDelete);
    sinon.assert.calledOnceWithExactly(
      deleteMany,
      { _id: { $in: [events[0].events[0]._id, events[1].events[0]._id] } }
    );
  });

  it('should create event history for repetition', async () => {
    const contract = { endDate: '2019-10-02T08:00:00.000Z', user: { _id: userId, sector: sectorId } };
    getEventsExceptInterventions.returns([events[1]]);

    await EventHelper.removeEventsExceptInterventionsOnContractEnd(contract, credentials);
    sinon.assert.calledOnceWithExactly(createEventHistoryOnDelete, events[1].events[0], credentials);
    sinon.assert.calledOnceWithExactly(deleteMany, { _id: { $in: [events[1].events[0]._id] } });
  });

  it('should create event history for non repeated event', async () => {
    const contract = { endDate: '2019-10-02T08:00:00.000Z', user: { _id: userId, sector: sectorId } };
    getEventsExceptInterventions.returns([events[0]]);

    await EventHelper.removeEventsExceptInterventionsOnContractEnd(contract, credentials);
    sinon.assert.calledOnceWithExactly(createEventHistoryOnDelete, events[0].events[0], credentials);
    sinon.assert.calledOnceWithExactly(deleteMany, { _id: { $in: [events[0].events[0]._id] } });
  });
});

describe('deleteCustomerEvents', () => {
  let deleteEventsAndRepetition;
  let customerAbsenceCreation;
  const customerId = new ObjectId();
  const userId = new ObjectId();
  const credentials = { _id: userId, company: { _id: new ObjectId() } };

  beforeEach(() => {
    deleteEventsAndRepetition = sinon.stub(EventHelper, 'deleteEventsAndRepetition');
    customerAbsenceCreation = sinon.stub(CustomerAbsenceHelper, 'create');
  });
  afterEach(() => {
    deleteEventsAndRepetition.restore();
    customerAbsenceCreation.restore();
  });

  it('should delete all events between start and end date and not delete the repetition', async () => {
    const startDate = '2019-10-09T00:00:00.000Z';
    const endDate = '2019-10-11T23:59:59.999Z';
    const absenceType = '';
    const query = {
      customer: customerId,
      startDate: { $gte: moment(startDate).toDate(), $lte: endDate },
      company: credentials.company._id,
    };

    await EventHelper.deleteCustomerEvents(customerId, startDate, endDate, absenceType, credentials);

    sinon.assert.calledOnceWithExactly(deleteEventsAndRepetition, query, false, credentials);
    sinon.assert.notCalled(customerAbsenceCreation);
  });

  it('should delete all events and repetition as of start date', async () => {
    const startDate = '2019-10-07';
    const absenceType = '';
    const query = {
      customer: customerId,
      startDate: { $gte: moment('2019-10-07').toDate() },
      company: credentials.company._id,
    };

    await EventHelper.deleteCustomerEvents(customerId, startDate, null, absenceType, credentials);

    sinon.assert.calledOnceWithExactly(deleteEventsAndRepetition, query, true, credentials);
  });

  it('should create customer absence if absenceType is in query', async () => {
    const startDate = new Date('2021-10-09T22:00:00.000Z');
    const endDate = new Date('2021-10-13T21:59:59.999Z');
    const absenceType = 'leave';
    const query = {
      customer: customerId,
      startDate: { $gte: moment(startDate).toDate(), $lte: endDate },
      company: credentials.company._id,
    };
    const queryCustomer = { customer: query.customer, startDate, endDate, absenceType };

    await EventHelper.deleteCustomerEvents(customerId, startDate, endDate, absenceType, credentials);

    sinon.assert.calledOnceWithExactly(customerAbsenceCreation, queryCustomer, credentials.company._id);
    sinon.assert.calledOnceWithExactly(deleteEventsAndRepetition, query, false, credentials);
  });
});

describe('createEventHistoryOnDeleteList', () => {
  let createEventHistoryOnDelete;

  beforeEach(() => {
    createEventHistoryOnDelete = sinon.stub(EventHistoriesHelper, 'createEventHistoryOnDelete');
  });

  afterEach(() => {
    createEventHistoryOnDelete.restore();
  });

  it('should create event histories for each deleted event', async () => {
    const customerId = new ObjectId();
    const userId = new ObjectId();
    const credentials = { _id: userId, company: { _id: new ObjectId() } };
    const events = [
      {
        _id: new ObjectId(),
        customer: customerId,
        type: 'internal_hour',
        repetition: { frequency: NEVER },
        startDate: '2019-10-12T10:00:00.000Z',
        endDate: '2019-10-12T12:00:00.000Z',
        auxiliary: userId,
      },
      {
        _id: new ObjectId(),
        customer: customerId,
        type: 'unavailability',
        repetition: { frequency: NEVER, parentId: new ObjectId() },
        startDate: '2019-10-7T11:30:00.000Z',
        endDate: '2019-10-7T13:00:00.000Z',
        auxiliary: userId,
      },
    ];

    await EventHelper.createEventHistoryOnDeleteList(events, credentials);

    sinon.assert.calledWithExactly(createEventHistoryOnDelete.getCall(0), omit(events[0], 'repetition'), credentials);
    sinon.assert.calledWithExactly(createEventHistoryOnDelete.getCall(1), omit(events[1], 'repetition'), credentials);
  });
});

describe('updateAbsencesOnContractEnd', () => {
  let getAbsences = null;
  let createEventHistoryOnUpdate = null;
  let updateMany = null;

  const userId = new ObjectId();
  const companyId = new ObjectId();
  const credentials = { _id: userId, company: { _id: companyId } };

  const absences = [
    {
      _id: new ObjectId(),
      type: 'absences',
      startDate: '2019-10-02T10:00:00.000Z',
      endDate: '2019-10-04T12:00:00.000Z',
      auxiliary: userId,
    },
  ];

  const { startDate, misc } = absences[0];
  let payload = {
    startDate,
    misc,
    auxiliary: userId.toHexString(),
  };

  beforeEach(() => {
    getAbsences = sinon.stub(EventRepository, 'getAbsences');
    createEventHistoryOnUpdate = sinon.stub(EventHistoriesHelper, 'createEventHistoryOnUpdate');
    updateMany = sinon.stub(Event, 'updateMany');
  });
  afterEach(() => {
    getAbsences.restore();
    createEventHistoryOnUpdate.restore();
    updateMany.restore();
  });

  it('should update future absences events linked to contract', async () => {
    const contract = { endDate: '2019-10-02T08:00:00.000Z', user: userId };
    const maxEndDate = moment(contract.endDate).hour(22).startOf('h');
    getAbsences.returns(absences);

    payload = { ...payload, endDate: moment(contract.endDate).hour(PLANNING_VIEW_END_HOUR).startOf('h') };
    await EventHelper.updateAbsencesOnContractEnd(userId, contract.endDate, credentials);
    sinon.assert.calledOnceWithExactly(getAbsences, userId, maxEndDate, companyId);
    sinon.assert.calledOnceWithExactly(createEventHistoryOnUpdate, payload, absences[0], credentials);
    sinon.assert.calledOnceWithExactly(
      updateMany,
      { _id: { $in: [absences[0]._id] } },
      { $set: { endDate: maxEndDate } }
    );
  });
});

describe('detachAuxiliaryFromEvent', () => {
  let findOneUser;

  beforeEach(() => {
    findOneUser = sinon.stub(User, 'findOne');
  });

  afterEach(() => {
    findOneUser.restore();
  });

  it('should detach auxiliary from event', async () => {
    const event = { auxiliary: new ObjectId(), repetition: { frequency: 'every_week' } };
    const companyId = new ObjectId();

    const auxiliary = { sector: 'sector' };
    findOneUser.returns(SinonMongoose.stubChainedQueries([auxiliary]));

    const result = await EventHelper.detachAuxiliaryFromEvent(event, companyId);

    expect(result).toEqual({ sector: 'sector', repetition: { frequency: 'never' } });
    SinonMongoose.calledOnceWithExactly(
      findOneUser,
      [
        { query: 'findOne', args: [{ _id: event.auxiliary }] },
        { query: 'populate', args: [{ path: 'sector', select: '_id sector', match: { company: companyId } }] },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
  });
});

describe('createEvent', () => {
  let createEvent;
  let findOneUser;
  let isCreationAllowed;
  let hasConflicts;
  let createEventHistoryOnCreate;
  let populateEventSubscription;
  let createRepetitions;
  let getEvent;
  let deleteConflictInternalHoursAndUnavailabilities;
  let unassignConflictInterventions;
  let detachAuxiliaryFromEvent;
  let isRepetition;

  const companyId = new ObjectId();
  const credentials = { _id: 'qwertyuiop', company: { _id: companyId } };
  beforeEach(() => {
    createEvent = sinon.stub(Event, 'create');
    findOneUser = sinon.stub(User, 'findOne');
    isCreationAllowed = sinon.stub(EventsValidationHelper, 'isCreationAllowed');
    hasConflicts = sinon.stub(EventsValidationHelper, 'hasConflicts');
    createEventHistoryOnCreate = sinon.stub(EventHistoriesHelper, 'createEventHistoryOnCreate');
    populateEventSubscription = sinon.stub(EventHelper, 'populateEventSubscription');
    createRepetitions = sinon.stub(EventsRepetitionHelper, 'createRepetitions');
    getEvent = sinon.stub(EventRepository, 'getEvent');
    deleteConflictInternalHoursAndUnavailabilities = sinon.stub(
      EventHelper,
      'deleteConflictInternalHoursAndUnavailabilities'
    );
    unassignConflictInterventions = sinon.stub(EventHelper, 'unassignConflictInterventions');
    detachAuxiliaryFromEvent = sinon.stub(EventHelper, 'detachAuxiliaryFromEvent');
    isRepetition = sinon.stub(EventHelper, 'isRepetition');
  });
  afterEach(() => {
    createEvent.restore();
    findOneUser.restore();
    isCreationAllowed.restore();
    hasConflicts.restore();
    createEventHistoryOnCreate.restore();
    populateEventSubscription.restore();
    createRepetitions.restore();
    getEvent.restore();
    deleteConflictInternalHoursAndUnavailabilities.restore();
    unassignConflictInterventions.restore();
    detachAuxiliaryFromEvent.restore();
    isRepetition.restore();
  });

  it('should not create event as creation is not allowed', async () => {
    isCreationAllowed.returns(false);
    try {
      await EventHelper.createEvent({}, credentials);
    } catch (e) {
      expect(e.output.payload.statusCode).toEqual(422);
    } finally {
      sinon.assert.calledOnceWithExactly(isCreationAllowed, { company: companyId }, credentials);
      sinon.assert.notCalled(createEvent);
    }
  });

  it('should create event as creation is allowed', async () => {
    const payload = { type: INTERNAL_HOUR };
    const event = { ...payload, _id: new ObjectId() };

    isCreationAllowed.returns(true);
    isRepetition.returns(false);
    getEvent.returns(event);
    createEvent.returns(SinonMongoose.stubChainedQueries([event], ['toObject']));

    await EventHelper.createEvent(payload, credentials);

    sinon.assert.calledOnceWithExactly(createEventHistoryOnCreate, event, credentials);
    sinon.assert.calledOnceWithExactly(getEvent, event._id, credentials);
    sinon.assert.calledOnceWithExactly(populateEventSubscription, event);
    SinonMongoose.calledOnceWithExactly(
      createEvent,
      [{ query: 'create', args: [{ ...payload, company: companyId }] }, { query: 'toObject' }]
    );
    sinon.assert.calledOnceWithExactly(isRepetition, { ...payload, company: companyId });
    sinon.assert.notCalled(findOneUser);
    sinon.assert.notCalled(createRepetitions);
    sinon.assert.notCalled(detachAuxiliaryFromEvent);
  });

  it('should detach auxiliary as event is a repeated intervention with conflicts', async () => {
    const eventId = new ObjectId();
    const detachedEvent = { _id: eventId, type: INTERVENTION, repetition: { frequency: 'never' } };
    const newEvent = {
      _id: eventId,
      type: INTERVENTION,
      auxiliary: new ObjectId(),
      repetition: { frequency: 'every_week' },
    };

    isCreationAllowed.returns(true);
    hasConflicts.returns(true);
    isRepetition.returns(true);
    detachAuxiliaryFromEvent.returns(detachedEvent);
    getEvent.returns(detachedEvent);
    createEvent.returns(SinonMongoose.stubChainedQueries([detachedEvent], ['toObject']));

    await EventHelper.createEvent(newEvent, credentials);

    const repetition = { ...newEvent.repetition, parentId: detachedEvent._id };
    sinon.assert.calledOnceWithExactly(createEventHistoryOnCreate, { ...newEvent, repetition }, credentials);
    sinon.assert.calledOnceWithExactly(getEvent, detachedEvent._id, credentials);
    sinon.assert.calledOnceWithExactly(populateEventSubscription, detachedEvent);
    SinonMongoose.calledOnceWithExactly(
      createEvent,
      [{ query: 'create', args: [detachedEvent] }, { query: 'toObject' }]
    );
    sinon.assert.calledOnceWithExactly(isRepetition, { ...newEvent, company: companyId });
    sinon.assert.calledOnceWithExactly(detachAuxiliaryFromEvent, { ...newEvent, company: companyId }, companyId);
    sinon.assert.calledOnceWithExactly(
      createRepetitions,
      detachedEvent,
      { ...newEvent, company: companyId, repetition },
      credentials
    );
    sinon.assert.notCalled(findOneUser);
  });

  it('should create repetitions as event is a repetition', async () => {
    const payload = { type: INTERVENTION, repetition: { frequency: EVERY_WEEK } };
    const event = { ...payload, _id: new ObjectId() };

    isCreationAllowed.returns(true);
    hasConflicts.returns(false);
    createEvent.returns(SinonMongoose.stubChainedQueries([event], ['toObject']));
    getEvent.returns(event);
    isRepetition.returns(true);

    await EventHelper.createEvent(payload, credentials);

    const repetition = { ...payload.repetition, parentId: event._id };
    sinon.assert.calledOnceWithExactly(createEventHistoryOnCreate, { ...event, repetition }, credentials);
    sinon.assert.calledOnceWithExactly(getEvent, event._id, credentials);
    sinon.assert.calledOnceWithExactly(
      createRepetitions,
      event,
      { ...payload, company: companyId, repetition },
      credentials
    );
    sinon.assert.calledOnceWithExactly(populateEventSubscription, event);
    SinonMongoose.calledOnceWithExactly(
      createEvent,
      [{ query: 'create', args: [{ ...payload, company: companyId }] }, { query: 'toObject' }]
    );
    sinon.assert.calledOnceWithExactly(isRepetition, { ...payload, company: companyId });
    sinon.assert.notCalled(findOneUser);
    sinon.assert.notCalled(detachAuxiliaryFromEvent);
  });

  it('should unassign intervention and delete other event in conflict on absence creation', async () => {
    const eventId = new ObjectId();
    const auxiliaryId = new ObjectId();
    const payload = {
      type: ABSENCE,
      startDate: '2019-03-20T10:00:00',
      endDate: '2019-03-20T12:00:00',
      auxiliary: auxiliaryId,
      company: new ObjectId(),
    };
    const event = { ...payload, _id: eventId };
    const auxiliary = { _id: auxiliaryId, sector: new ObjectId() };

    isCreationAllowed.returns(true);
    isRepetition.returns(false);
    createEvent.returns(SinonMongoose.stubChainedQueries([event], ['toObject']));
    getEvent.returns(payload);
    findOneUser.returns(SinonMongoose.stubChainedQueries([auxiliary]));

    await EventHelper.createEvent(payload, credentials);

    sinon.assert.calledOnceWithExactly(createEventHistoryOnCreate, event, credentials);
    sinon.assert.calledOnceWithExactly(
      deleteConflictInternalHoursAndUnavailabilities,
      payload,
      auxiliary,
      credentials
    );
    sinon.assert.calledOnceWithExactly(
      unassignConflictInterventions,
      { startDate: '2019-03-20T10:00:00', endDate: '2019-03-20T12:00:00' },
      auxiliary,
      credentials
    );
    SinonMongoose.calledOnceWithExactly(
      findOneUser,
      [
        { query: 'findOne', args: [{ _id: event.auxiliary }] },
        { query: 'populate', args: [{ path: 'sector', select: '_id sector', match: { company: companyId } }] },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      createEvent,
      [{ query: 'create', args: [{ ...payload, company: companyId }] }, { query: 'toObject' }]
    );
    sinon.assert.notCalled(detachAuxiliaryFromEvent);
  });
});

describe('deleteConflictInternalHoursAndUnavailabilities', () => {
  let formatEventsInConflictQuery;
  let deleteEventsAndRepetition;
  beforeEach(() => {
    formatEventsInConflictQuery = sinon.stub(EventRepository, 'formatEventsInConflictQuery');
    deleteEventsAndRepetition = sinon.stub(EventHelper, 'deleteEventsAndRepetition');
  });
  afterEach(() => {
    formatEventsInConflictQuery.restore();
    deleteEventsAndRepetition.restore();
  });

  it('should delete conflict events except interventions', async () => {
    const dates = { startDate: '2019-03-20T10:00:00', endDate: '2019-03-20T12:00:00' };
    const auxiliary = { _id: new ObjectId() };
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
    const event = { _id: new ObjectId(), startDate: dates.startDate, endDate: dates.endDate };
    const companyId = credentials.company._id;
    const query = {
      startDate: { $lt: dates.endDate },
      endDate: { $gt: dates.startDate },
      auxiliary: auxiliary._id,
      type: { $in: [INTERNAL_HOUR, UNAVAILABILITY] },
      company: companyId,
      _id: { $ne: event._id },
    };

    formatEventsInConflictQuery.returns(query);

    await EventHelper.deleteConflictInternalHoursAndUnavailabilities(event, auxiliary, credentials);

    sinon.assert.calledOnceWithExactly(
      formatEventsInConflictQuery,
      dates,
      auxiliary._id,
      [INTERNAL_HOUR, UNAVAILABILITY],
      companyId,
      event._id
    );
    sinon.assert.calledOnceWithExactly(deleteEventsAndRepetition, query, false, credentials);
  });
});

describe('unassignConflictInterventions', () => {
  let formatEventsInConflictQuery;
  let updateEvent;
  let findEvent;
  beforeEach(() => {
    formatEventsInConflictQuery = sinon.stub(EventRepository, 'formatEventsInConflictQuery');
    updateEvent = sinon.stub(EventHelper, 'updateEvent');
    findEvent = sinon.stub(Event, 'find');
  });
  afterEach(() => {
    formatEventsInConflictQuery.restore();
    updateEvent.restore();
    findEvent.restore();
  });

  it('should delete conflict events except interventions', async () => {
    const dates = { startDate: '2019-03-20T10:00:00', endDate: '2019-03-20T12:00:00' };
    const auxiliaryId = new ObjectId();
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
    const companyId = credentials.company._id;
    const query = {
      startDate: { $lt: dates.endDate },
      endDate: { $gt: dates.startDate },
      auxiliary: auxiliaryId,
      type: { $in: [INTERVENTION] },
      company: companyId,
    };
    const events = [new Event({ _id: new ObjectId() }), new Event({ _id: new ObjectId() })];

    formatEventsInConflictQuery.returns(query);
    findEvent.returns(SinonMongoose.stubChainedQueries([events], ['lean']));

    await EventHelper.unassignConflictInterventions(dates, auxiliaryId, credentials);

    sinon.assert.calledOnceWithExactly(formatEventsInConflictQuery, dates, auxiliaryId, [INTERVENTION], companyId);
    sinon.assert.callCount(updateEvent, events.length);
    SinonMongoose.calledOnceWithExactly(findEvent, [{ query: 'find', args: [query] }, { query: 'lean' }]);
  });
});

describe('getListQuery', () => {
  it('should return only company in rules if query is empty', () => {
    const query = {};
    const credentials = { company: { _id: new ObjectId() } };

    const listQuery = EventHelper.getListQuery(query, credentials);

    expect(listQuery).toEqual({ $and: [{ company: credentials.company._id }] });
  });

  it('should return all conditions in rules that are in query', () => {
    const query = {
      type: 'intervention',
      auxiliary: new ObjectId(),
      sector: [new ObjectId()],
      customer: [new ObjectId()],
      startDate: '2021-04-28T10:00:00.000Z',
      endDate: '2021-04-28T12:00:00.000Z',
      isCancelled: false,
    };
    const credentials = { company: { _id: new ObjectId() } };

    const listQuery = EventHelper.getListQuery(query, credentials);

    expect(listQuery).toEqual({
      $and: [
        { company: credentials.company._id },
        { type: 'intervention' },
        { $or: [{ auxiliary: { $in: [query.auxiliary] } }, { sector: { $in: query.sector } }] },
        { customer: { $in: query.customer } },
        { endDate: { $gt: new Date('2021-04-27T22:00:00.000Z') } },
        { startDate: { $lt: new Date('2021-04-28T21:59:59.999Z') } },
        { isCancelled: false },
      ],
    });
  });
});

describe('deleteEvent', () => {
  let deleteEventsAndRepetition;
  beforeEach(() => {
    deleteEventsAndRepetition = sinon.stub(EventHelper, 'deleteEventsAndRepetition');
  });
  afterEach(() => {
    deleteEventsAndRepetition.restore();
  });

  it('should delete event', async () => {
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
    const eventId = new ObjectId();

    await EventHelper.deleteEvent(eventId, credentials);

    sinon.assert.calledOnceWithExactly(
      deleteEventsAndRepetition,
      { _id: eventId, company: credentials.company._id },
      false,
      credentials
    );
  });
});

describe('deleteEventsAndRepetition', () => {
  let find;
  let checkDeletionIsAllowed;
  let createEventHistoryOnDeleteList;
  let createEventHistoryOnDelete;
  let repetitionDeleteOne;
  let deleteMany;
  const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };
  beforeEach(() => {
    find = sinon.stub(Event, 'find');
    checkDeletionIsAllowed = sinon.stub(EventsValidationHelper, 'checkDeletionIsAllowed');
    createEventHistoryOnDeleteList = sinon.stub(EventHelper, 'createEventHistoryOnDeleteList');
    createEventHistoryOnDelete = sinon.stub(EventHistoriesHelper, 'createEventHistoryOnDelete');
    repetitionDeleteOne = sinon.stub(Repetition, 'deleteOne');
    deleteMany = sinon.stub(Event, 'deleteMany');
  });
  afterEach(() => {
    find.restore();
    checkDeletionIsAllowed.restore();
    createEventHistoryOnDeleteList.restore();
    createEventHistoryOnDelete.restore();
    repetitionDeleteOne.restore();
    deleteMany.restore();
  });

  it('should delete events without repetition', async () => {
    const query = {
      customer: new ObjectId(),
      startDate: { $gte: moment('2019-10-10').toDate(), $lte: moment('2019-10-19').endOf('d').toDate() },
      company: credentials.company._id,
    };
    const events = [{ _id: '1234567890' }, { _id: 'qwertyuiop' }, { _id: 'asdfghjkl' }];

    find.returns(SinonMongoose.stubChainedQueries([events], ['lean']));

    await EventHelper.deleteEventsAndRepetition(query, false, credentials);

    sinon.assert.calledOnceWithExactly(createEventHistoryOnDeleteList, events, credentials);
    sinon.assert.calledOnceWithExactly(deleteMany, { _id: { $in: ['1234567890', 'qwertyuiop', 'asdfghjkl'] } });
    sinon.assert.notCalled(createEventHistoryOnDelete);
    sinon.assert.notCalled(repetitionDeleteOne);
    sinon.assert.calledOnceWithExactly(checkDeletionIsAllowed, events);
    SinonMongoose.calledOnceWithExactly(find, [{ query: 'find', args: [query] }, { query: 'lean' }]);
  });

  it('should delete events with repetitions', async () => {
    const query = {
      customer: new ObjectId(),
      startDate: { $gte: moment('2019-10-10').toDate(), $lte: moment('2019-10-19').endOf('d').toDate() },
      company: credentials.company._id,
    };
    const customerId = new ObjectId();
    const userId = new ObjectId();
    const parentId = 'azerty';
    const events = [
      {
        _id: new ObjectId(),
        customer: customerId,
        type: 'internal_hour',
        repetition: { frequency: NEVER },
        startDate: '2019-10-12T10:00:00.000Z',
        endDate: '2019-10-12T12:00:00.000Z',
        auxiliary: userId,
      },
      {
        _id: new ObjectId(),
        customer: customerId,
        type: 'unavailability',
        repetition: { frequency: EVERY_WEEK, parentId },
        startDate: '2019-10-09T11:00:00.000Z',
        endDate: '2019-10-09T13:00:00.000Z',
        auxiliary: userId,
      },
      {
        _id: new ObjectId(),
        customer: customerId,
        type: 'unavailability',
        repetition: { frequency: EVERY_WEEK, parentId },
        startDate: '2019-10-7T11:30:00.000Z',
        endDate: '2019-10-7T13:00:00.000Z',
        auxiliary: userId,
      },
      {
        _id: new ObjectId(),
        customer: customerId,
        type: 'unavailability',
        startDate: '2019-10-20T11:00:00.000Z',
        endDate: '2019-10-20T13:00:00.000Z',
        auxiliary: userId,
      },
    ];
    const eventsGroupedByParentId = {
      '': [events[0], events[3]],
      [parentId]: [events[1], events[2]],
    };

    find.returns(SinonMongoose.stubChainedQueries([events], ['lean']));

    await EventHelper.deleteEventsAndRepetition(query, true, credentials);

    sinon.assert.calledOnceWithExactly(createEventHistoryOnDeleteList, eventsGroupedByParentId[''], credentials);
    sinon.assert.calledOnceWithExactly(createEventHistoryOnDelete, eventsGroupedByParentId[parentId][0], credentials);
    sinon.assert.calledOnceWithExactly(repetitionDeleteOne, { parentId });
    sinon.assert.calledOnceWithExactly(deleteMany, { _id: { $in: events.map(ev => ev._id) } });
    sinon.assert.calledOnceWithExactly(checkDeletionIsAllowed, events);
    SinonMongoose.calledOnceWithExactly(find, [{ query: 'find', args: [query] }, { query: 'lean' }]);
  });

  it('should not delete event if at least one is billed', async () => {
    const query = {
      customer: new ObjectId(),
      startDate: { $gte: moment('2019-10-10').toDate(), $lte: moment('2019-10-19').endOf('d').toDate() },
      company: credentials.company._id,
    };
    const events = [
      { _id: '1234567890', type: INTERVENTION, isBilled: false },
      { _id: 'qwertyuiop', type: INTERVENTION, isBilled: false },
      { _id: 'asdfghjkl', type: INTERVENTION, isBilled: true },
    ];

    find.returns(SinonMongoose.stubChainedQueries([events], ['lean']));
    checkDeletionIsAllowed.throws(Boom.conflict('Vous ne pouvez pas supprimer un évènement facturé.'));

    try {
      await EventHelper.deleteEventsAndRepetition(query, false, credentials);

      expect(false).toBe(true);
    } catch (e) {
      expect(e).toEqual(Boom.conflict('Vous ne pouvez pas supprimer un évènement facturé.'));
    } finally {
      sinon.assert.notCalled(createEventHistoryOnDeleteList);
      sinon.assert.notCalled(deleteMany);
      sinon.assert.calledOnceWithExactly(checkDeletionIsAllowed, events);
      SinonMongoose.calledOnceWithExactly(find, [{ query: 'find', args: [query] }, { query: 'lean' }]);
    }
  });

  it('should not delete event if at least one is timestamped', async () => {
    const query = {
      customer: new ObjectId(),
      startDate: { $gte: moment('2019-10-10').toDate(), $lte: moment('2019-10-19').endOf('d').toDate() },
      company: credentials.company._id,
    };
    const events = [
      { _id: '1234567890', type: INTERVENTION },
      { _id: 'qwertyuiop', type: INTERVENTION },
      { _id: 'asdfghjkl', type: INTERVENTION },
    ];

    find.returns(SinonMongoose.stubChainedQueries([events], ['lean']));
    checkDeletionIsAllowed.throws(Boom.conflict('Vous ne pouvez pas supprimer un évènement horodaté.'));

    try {
      await EventHelper.deleteEventsAndRepetition(query, false, credentials);

      expect(false).toBe(true);
    } catch (e) {
      expect(e).toEqual(Boom.conflict('Vous ne pouvez pas supprimer un évènement horodaté.'));
    } finally {
      sinon.assert.notCalled(createEventHistoryOnDeleteList);
      sinon.assert.notCalled(deleteMany);
      sinon.assert.calledOnceWithExactly(checkDeletionIsAllowed, events);
      SinonMongoose.calledOnceWithExactly(find, [{ query: 'find', args: [query] }, { query: 'lean' }]);
    }
  });
});

describe('shouldDetachFromRepetition', () => {
  it('should return false if main fields are not updated', () => {
    const event = {
      type: INTERVENTION,
      sector: new ObjectId(),
      auxiliary: new ObjectId(),
      subscription: new ObjectId(),
      startDate: '2019-01-21T09:30:00',
      endDate: '2019-01-21T11:30:00',
      isCancelled: false,
    };
    const updatedEventPayload = {
      ...event,
      sector: event.sector.toHexString(),
      auxiliary: event.auxiliary.toHexString(),
      subscription: event.subscription.toHexString(),
      misc: 'Test',
    };

    expect(EventHelper.shouldDetachFromRepetition(event, updatedEventPayload)).toBeFalsy();
  });

  const idKeys = ['sector', 'auxiliary', 'subscription'];
  idKeys.map(key => it(`should return true if ${key} is updated `, () => {
    const event = {
      sector: new ObjectId(),
      auxiliary: new ObjectId(),
      subscription: new ObjectId(),
      startDate: '2019-01-21T09:30:00',
      endDate: '2019-01-21T11:30:00',
      isCancelled: false,
    };
    const updatedEventPayload = { ...event, [key]: new ObjectId().toHexString() };

    expect(EventHelper.shouldDetachFromRepetition(event, updatedEventPayload)).toBeTruthy();
  }));

  const dateKeys = ['startDate', 'endDate'];
  dateKeys.map(key => it(`should return true if ${key} is updated `, () => {
    const event = {
      sector: new ObjectId(),
      auxiliary: new ObjectId(),
      subscription: new ObjectId(),
      startDate: '2019-01-21T09:30:00',
      endDate: '2019-01-21T11:30:00',
      isCancelled: false,
    };
    const updatedEventPayload = { ...event, [key]: new Date() };

    expect(EventHelper.shouldDetachFromRepetition(event, updatedEventPayload)).toBeTruthy();
  }));

  it('should return true if isCancelled is updated ', () => {
    const event = {
      sector: new ObjectId(),
      auxiliary: new ObjectId(),
      subscription: new ObjectId(),
      startDate: '2019-01-21T09:30:00',
      endDate: '2019-01-21T11:30:00',
      isCancelled: false,
    };
    const updatedEventPayload = { ...event, isCancelled: true };

    expect(EventHelper.shouldDetachFromRepetition(event, updatedEventPayload)).toBeTruthy();
  });

  it('should return true if internalHour is updated ', () => {
    const event = {
      sector: new ObjectId(),
      auxiliary: new ObjectId(),
      subscription: new ObjectId(),
      startDate: '2019-01-21T09:30:00',
      endDate: '2019-01-21T11:30:00',
      isCancelled: false,
      internalHour: { name: 'Gouter' },
    };
    const updatedEventPayload = { ...event, internalHour: { name: 'Diner' } };

    expect(EventHelper.shouldDetachFromRepetition(event, updatedEventPayload)).toBeTruthy();
  });

  it('should return true if isCancelled is updated ', () => {
    const event = {
      sector: new ObjectId(),
      auxiliary: new ObjectId(),
      subscription: new ObjectId(),
      startDate: '2019-01-21T09:30:00',
      endDate: '2019-01-21T11:30:00',
      isCancelled: false,
      address: { fullAddress: 'le paradis' },
    };
    const updatedEventPayload = { ...event, address: { fullAddress: 'l\'enfer' } };

    expect(EventHelper.shouldDetachFromRepetition(event, updatedEventPayload)).toBeTruthy();
  });
});

describe('getContractWeekInfo', () => {
  let getDaysRatioBetweenTwoDates;
  let getContractInfo;
  let getMatchingVersionsList;
  beforeEach(() => {
    getDaysRatioBetweenTwoDates = sinon.stub(UtilsHelper, 'getDaysRatioBetweenTwoDates');
    getContractInfo = sinon.stub(ContractHelper, 'getContractInfo');
    getMatchingVersionsList = sinon.stub(ContractHelper, 'getMatchingVersionsList');
  });
  afterEach(() => {
    getDaysRatioBetweenTwoDates.restore();
    getContractInfo.restore();
    getMatchingVersionsList.restore();
  });

  it('should get contract week info', () => {
    const versions = [
      { startDate: '2019-01-01', endDate: '2019-05-04', weeklyHours: 18 },
      { endDate: '', startDate: '2019-05-04', weeklyHours: 24 },
    ];
    const contract = { versions };
    const query = { startDate: '2019-11-20T00:00:00', endDate: '2019-11-22T00:00:00' };
    getDaysRatioBetweenTwoDates.returns(4);
    getContractInfo.returns({ contractHours: 26, workedDaysRatio: 1 / 4 });
    getMatchingVersionsList.returns(versions[1]);

    const result = EventHelper.getContractWeekInfo(contract, query);

    expect(result).toBeDefined();
    expect(result.contractHours).toBe(26);
    expect(result.workedDaysRatio).toBe(1 / 4);
    sinon.assert.calledOnceWithExactly(
      getDaysRatioBetweenTwoDates,
      moment('2019-11-20').startOf('w').toDate(),
      moment('2019-11-20').endOf('w').toDate()
    );
    sinon.assert.calledOnceWithExactly(getContractInfo, versions[1], query, 4);
  });
});

describe('workingStats', () => {
  const auxiliaryId = new ObjectId();
  const query = {
    auxiliary: [auxiliaryId],
    startDate: '2019-12-12',
    endDate: '2019-12-15',
  };
  const distanceMatrix = {
    data: {
      rows: [{
        elements: [{
          distance: { value: 363998 },
          duration: { value: 13790 },
        }],
      }],
    },
    status: 200,
  };
  const companyId = new ObjectId();
  const credentials = { company: { _id: companyId } };
  let findUser;
  let findUserCompany;
  let findDistanceMatrix;
  let getEventsToPayStub;
  let getContractStub;
  let getContractWeekInfoStub;
  let getPayFromEventsStub;
  let getPayFromAbsencesStub;
  beforeEach(() => {
    findUser = sinon.stub(User, 'find');
    findUserCompany = sinon.stub(UserCompany, 'find');
    findDistanceMatrix = sinon.stub(DistanceMatrix, 'find');
    getEventsToPayStub = sinon.stub(EventRepository, 'getEventsToPay');
    getContractStub = sinon.stub(EventHelper, 'getContract');
    getContractWeekInfoStub = sinon.stub(EventHelper, 'getContractWeekInfo');
    getPayFromEventsStub = sinon.stub(DraftPayHelper, 'getPayFromEvents');
    getPayFromAbsencesStub = sinon.stub(DraftPayHelper, 'getPayFromAbsences');
  });
  afterEach(() => {
    findUser.restore();
    findUserCompany.restore();
    findDistanceMatrix.restore();
    getEventsToPayStub.restore();
    getContractStub.restore();
    getContractWeekInfoStub.restore();
    getPayFromEventsStub.restore();
    getPayFromAbsencesStub.restore();
  });

  it('should return working stats', async () => {
    const contractId = new ObjectId();
    const contracts = [{ _id: contractId }];
    const auxiliaries = [{ _id: auxiliaryId, firstname: 'toto', contracts }];
    const contract = { startDate: '2018-11-11', _id: contractId };
    const contractInfo = { contractHours: 10, holidaysHours: 7 };
    const hours = { workedHours: 12 };
    const absencesHours = 3;

    getEventsToPayStub.returns([{ auxiliary: { _id: auxiliaryId }, events: [], absences: [] }]);
    getContractStub.returns(contract);
    getContractWeekInfoStub.returns(contractInfo);
    getPayFromEventsStub.returns(hours);
    getPayFromAbsencesStub.returns(absencesHours);
    findUser.returns(SinonMongoose.stubChainedQueries([auxiliaries]));
    findDistanceMatrix.returns(SinonMongoose.stubChainedQueries([distanceMatrix], ['lean']));

    const result = await EventHelper.workingStats(query, credentials);

    const expectedResult = {};
    expectedResult[auxiliaryId] = {
      workedHours: hours.workedHours,
      hoursToWork: 0,
    };

    expect(result).toEqual(expectedResult);
    sinon.assert.notCalled(findUserCompany);
    sinon.assert.calledOnceWithExactly(getEventsToPayStub, query.startDate, query.endDate, [auxiliaryId], companyId);
    sinon.assert.calledOnceWithExactly(getContractStub, contracts, query.startDate, query.endDate);
    sinon.assert.calledOnceWithExactly(getContractWeekInfoStub, contract, query);
    sinon.assert.calledOnceWithExactly(getPayFromEventsStub, [], auxiliaries[0], distanceMatrix, [], query);
    sinon.assert.calledOnceWithExactly(getPayFromAbsencesStub, [], contract, query);
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        { query: 'find', args: [{ _id: { $in: query.auxiliary } }] },
        { query: 'populate', args: ['contracts'] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findDistanceMatrix,
      [{ query: 'find', args: [{ company: companyId }] }, { query: 'lean' }]
    );
  });

  it('should return workingstats for all auxiliaries if no auxiliary is specified', async () => {
    const contractId = new ObjectId();
    const contracts = [{ _id: contractId }];
    const auxiliaries = [{ _id: auxiliaryId, firstname: 'toto', contracts }];
    const queryWithoutAuxiliary = omit(query, 'auxiliary');
    const contract = { startDate: '2018-11-11', _id: contractId };
    const contractInfo = { contractHours: 10, holidaysHours: 7 };
    const hours = { workedHours: 12 };
    const absencesHours = 3;
    const users = [{ _id: new ObjectId(), user: auxiliaries[0]._id }];

    getEventsToPayStub.returns([{ auxiliary: { _id: auxiliaryId }, events: [], absences: [] }]);
    getContractStub.returns(contract);
    getContractWeekInfoStub.returns(contractInfo);
    getPayFromEventsStub.returns(hours);
    getPayFromAbsencesStub.returns(absencesHours);
    findUser.returns(SinonMongoose.stubChainedQueries([auxiliaries]));
    findUserCompany.returns(SinonMongoose.stubChainedQueries([users], ['lean']));
    findDistanceMatrix.returns(SinonMongoose.stubChainedQueries([distanceMatrix], ['lean']));

    const result = await EventHelper.workingStats(queryWithoutAuxiliary, credentials);
    const expectedResult = {};
    expectedResult[auxiliaryId] = {
      workedHours: hours.workedHours,
      hoursToWork: 0,
    };

    expect(result).toEqual(expectedResult);
    sinon.assert.calledOnceWithExactly(getEventsToPayStub, query.startDate, query.endDate, [auxiliaryId], companyId);
    sinon.assert.calledOnceWithExactly(getContractStub, contracts, query.startDate, query.endDate);
    sinon.assert.calledOnceWithExactly(getContractWeekInfoStub, contract, queryWithoutAuxiliary);
    sinon.assert.calledOnceWithExactly(
      getPayFromEventsStub,
      [],
      auxiliaries[0],
      distanceMatrix,
      [],
      queryWithoutAuxiliary
    );
    sinon.assert.calledOnceWithExactly(getPayFromAbsencesStub, [], contract, queryWithoutAuxiliary);
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [{ query: 'find', args: [{ company: companyId }, { user: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        { query: 'find', args: [{ _id: { $in: [users[0].user] } }] },
        { query: 'populate', args: ['contracts'] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findDistanceMatrix,
      [{ query: 'find', args: [{ company: companyId }] }, { query: 'lean' }]
    );
  });

  it('should return {} if no contract in auxiliaries', async () => {
    getEventsToPayStub.returns([{ auxiliary: { _id: auxiliaryId } }]);
    findUser.returns(SinonMongoose.stubChainedQueries([[{ _id: auxiliaryId, firstname: 'toto' }]]));
    findDistanceMatrix.returns(SinonMongoose.stubChainedQueries([distanceMatrix], ['lean']));

    const result = await EventHelper.workingStats(query, credentials);
    expect(result).toEqual({});

    sinon.assert.notCalled(findUserCompany);
    sinon.assert.calledOnceWithExactly(getEventsToPayStub, query.startDate, query.endDate, [auxiliaryId], companyId);
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        { query: 'find', args: [{ _id: { $in: query.auxiliary } }] },
        { query: 'populate', args: ['contracts'] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findDistanceMatrix,
      [{ query: 'find', args: [{ company: companyId }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(getContractStub);
    sinon.assert.notCalled(getContractWeekInfoStub);
    sinon.assert.notCalled(getPayFromEventsStub);
    sinon.assert.notCalled(getPayFromAbsencesStub);
  });

  it('should return {} if contract not found', async () => {
    const contracts = [{ _id: new ObjectId() }];

    getEventsToPayStub.returns([{ auxiliary: { _id: auxiliaryId } }]);
    getContractStub.returns();
    findUser.returns(SinonMongoose.stubChainedQueries([[{ _id: auxiliaryId, firstname: 'toto', contracts }]]));
    findDistanceMatrix.returns(SinonMongoose.stubChainedQueries([distanceMatrix], ['lean']));

    const result = await EventHelper.workingStats(query, credentials);
    expect(result).toEqual({});

    sinon.assert.notCalled(findUserCompany);
    sinon.assert.calledOnceWithExactly(getEventsToPayStub, query.startDate, query.endDate, [auxiliaryId], companyId);
    sinon.assert.calledOnceWithExactly(getContractStub, contracts, query.startDate, query.endDate);
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        { query: 'find', args: [{ _id: { $in: query.auxiliary } }] },
        { query: 'populate', args: ['contracts'] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findDistanceMatrix,
      [{ query: 'find', args: [{ company: companyId }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(getContractWeekInfoStub);
    sinon.assert.notCalled(getPayFromEventsStub);
    sinon.assert.notCalled(getPayFromAbsencesStub);
  });
});

describe('getPaidTransportStatsBySector', () => {
  let getDistanceMatrix;
  let getPaidTransportStatsBySector;
  let getPaidTransportInfo;

  beforeEach(() => {
    getDistanceMatrix = sinon.stub(DistanceMatrixHelper, 'getDistanceMatrices');
    getPaidTransportStatsBySector = sinon.stub(EventRepository, 'getPaidTransportStatsBySector');
    getPaidTransportInfo = sinon.stub(DraftPayHelper, 'getPaidTransportInfo');
  });
  afterEach(() => {
    getDistanceMatrix.restore();
    getPaidTransportStatsBySector.restore();
    getPaidTransportInfo.restore();
  });

  it('should return an empty array if there is no event', async () => {
    const query = { sector: new ObjectId(), month: '01-2020' };
    const credentials = { company: { _id: new ObjectId() } };

    getDistanceMatrix.returns([{ duration: 10 }]);
    getPaidTransportStatsBySector.returns([]);

    const result = await EventHelper.getPaidTransportStatsBySector(query, credentials);

    expect(result).toEqual([]);
    sinon.assert.calledOnceWithExactly(getDistanceMatrix, credentials);
  });

  it('should return paid transport stats', async () => {
    const query = { sector: new ObjectId(), month: '01-2020' };
    const credentials = { company: { _id: new ObjectId() } };

    const distanceMatrix = [{ duration: 3600 }];
    const events = [
      { startDate: '2020-01-02T15:30', endDate: '2020-01-02T16:30' },
      { startDate: '2020-01-02T17:30', endDate: '2020-01-02T18:30' },
    ];
    const paidTransportStatsBySector = [{
      _id: query.sector,
      auxiliaries: [{ auxiliary: new ObjectId(), days: [{ day: '2020-01-02', events }] }],
    }];

    getDistanceMatrix.returns(distanceMatrix);
    getPaidTransportStatsBySector.returns(paidTransportStatsBySector);
    getPaidTransportInfo.returns({ duration: 60 });

    const result = await EventHelper.getPaidTransportStatsBySector(query, credentials);

    expect(result).toEqual([{ sector: query.sector, duration: 1 }]);
    sinon.assert.calledOnceWithExactly(getDistanceMatrix, credentials);
    sinon.assert.calledOnceWithExactly(
      getPaidTransportStatsBySector,
      [query.sector],
      query.month,
      credentials.company._id
    );
    sinon.assert.calledOnceWithExactly(getPaidTransportInfo, events[1], events[0], distanceMatrix);
  });

  it('should return paid transport stats for many sectors', async () => {
    const query = { sector: [new ObjectId(), new ObjectId()], month: '01-2020' };
    const credentials = { company: { _id: new ObjectId() } };

    const distanceMatrix = [{ duration: 3600 }, { duration: 5400 }];
    const eventsFirstSector = [
      { startDate: '2020-01-02T15:30', endDate: '2020-01-02T16:30' },
      { startDate: '2020-01-02T17:30', endDate: '2020-01-02T18:30' },
    ];
    const eventsSecondSector = [
      { startDate: '2020-01-02T15:30', endDate: '2020-01-02T16:30' },
      { startDate: '2020-01-02T17:30', endDate: '2020-01-02T18:30' },
    ];
    const paidTransportStatsBySector = [
      {
        _id: query.sector[0],
        auxiliaries: [{ auxiliary: new ObjectId(), days: [{ day: '2020-01-02', events: eventsFirstSector }] }],
      },
      {
        _id: query.sector[1],
        auxiliaries: [{ auxiliary: new ObjectId(), days: [{ day: '2020-01-02', events: eventsSecondSector }] }],
      },
    ];

    getDistanceMatrix.returns(distanceMatrix);
    getPaidTransportStatsBySector.returns(paidTransportStatsBySector);
    getPaidTransportInfo.onCall(0).returns({ duration: 60 });
    getPaidTransportInfo.onCall(1).returns({ duration: 90 });

    const result = await EventHelper.getPaidTransportStatsBySector(query, credentials);

    expect(result).toEqual([{ sector: query.sector[0], duration: 1 }, { sector: query.sector[1], duration: 1.5 }]);
    sinon.assert.calledOnceWithExactly(getDistanceMatrix, credentials);
    sinon.assert.calledWithExactly(getPaidTransportStatsBySector, query.sector, query.month, credentials.company._id);
    sinon.assert.calledWithExactly(
      getPaidTransportInfo.getCall(0),
      eventsFirstSector[1],
      eventsFirstSector[0],
      distanceMatrix
    );
    sinon.assert.calledWithExactly(
      getPaidTransportInfo.getCall(1),
      eventsSecondSector[1],
      eventsSecondSector[0],
      distanceMatrix
    );
  });

  it('should not call getPaidTransportInfo if only one event for one day', async () => {
    const query = { sector: new ObjectId(), month: '01-2020' };
    const credentials = { company: { _id: new ObjectId() } };

    const distanceMatrix = [{ duration: 3600 }];
    const events = [
      { startDate: '2020-01-02T15:30', endDate: '2020-01-02T16:30' },
    ];
    const paidTransportStatsBySector = [{
      _id: query.sector,
      auxiliaries: [{ auxiliary: new ObjectId(), days: [{ day: '2020-01-02', events }] }],
    }];

    getDistanceMatrix.returns(distanceMatrix);
    getPaidTransportStatsBySector.returns(paidTransportStatsBySector);

    const result = await EventHelper.getPaidTransportStatsBySector(query, credentials);

    expect(result).toEqual([{ sector: query.sector, duration: 0 }]);
    sinon.assert.calledOnceWithExactly(getDistanceMatrix, credentials);
    sinon.assert.calledOnceWithExactly(
      getPaidTransportStatsBySector,
      [query.sector],
      query.month,
      credentials.company._id
    );
    sinon.assert.notCalled(getPaidTransportInfo);
  });
});

describe('getUnassignedHoursBySector', () => {
  let getUnassignedHoursBySector;

  beforeEach(() => {
    getUnassignedHoursBySector = sinon.stub(EventRepository, 'getUnassignedHoursBySector');
  });
  afterEach(() => {
    getUnassignedHoursBySector.restore();
  });

  it('should return an empty array if there is no unassigned event', async () => {
    const query = { sector: new ObjectId(), month: '01-2020' };
    const credentials = { company: { _id: new ObjectId() } };

    getUnassignedHoursBySector.returns([]);

    const result = await EventHelper.getUnassignedHoursBySector(query, credentials);

    expect(result).toEqual([]);
    sinon.assert.calledOnceWithExactly(
      getUnassignedHoursBySector,
      [query.sector],
      query.month,
      credentials.company._id
    );
  });

  it('should return unassigned hours', async () => {
    const query = { sector: new ObjectId(), month: '01-2020' };
    const credentials = { company: { _id: new ObjectId() } };

    const unassignedhours = [{ sector: query.sector, duration: 12 }];

    getUnassignedHoursBySector.returns(unassignedhours);

    const result = await EventHelper.getUnassignedHoursBySector(query, credentials);

    expect(result).toEqual(unassignedhours);
    sinon.assert.calledOnceWithExactly(
      getUnassignedHoursBySector,
      [query.sector],
      query.month,
      credentials.company._id
    );
  });

  it('should return unassigned hours for many sectors', async () => {
    const query = { sector: [new ObjectId(), new ObjectId()], month: '01-2020' };
    const credentials = { company: { _id: new ObjectId() } };

    const unassignedHours = [{ sector: query.sector[0], duration: 12 }, { sector: query.sector[1], duration: 5 }];

    getUnassignedHoursBySector.returns(unassignedHours);

    const result = await EventHelper.getUnassignedHoursBySector(query, credentials);

    expect(result).toEqual(unassignedHours);
    sinon.assert.calledOnceWithExactly(getUnassignedHoursBySector, query.sector, query.month, credentials.company._id);
  });
});
