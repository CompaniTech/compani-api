const { ObjectID } = require('mongodb');
const expect = require('expect');
const sinon = require('sinon');
const Boom = require('boom');
const InternalHour = require('../../../src/models/InternalHour');
const InternalHoursHelper = require('../../../src/helpers/internalHours');
const EventHelper = require('../../../src/helpers/events');

require('sinon-mongoose');

describe('removeInternalHour', () => {
  let InternalHourMock;
  let updateEventsInternalHourTypeStub;
  const companyId = new ObjectID();
  const internalHour = {
    _id: new ObjectID(),
    name: 'Test',
    default: false,
    company: companyId,
  };
  const date = new Date();

  beforeEach(() => {
    InternalHourMock = sinon.mock(InternalHour);
    updateEventsInternalHourTypeStub = sinon.stub(EventHelper, 'updateEventsInternalHourType');
  });

  afterEach(() => {
    InternalHourMock.restore();
    updateEventsInternalHourTypeStub.restore();
  });

  it('should remove an internal hour', async () => {
    const defaultInternalHour = {
      _id: new ObjectID(),
      name: 'default',
      default: true,
      company: companyId,
    };

    InternalHourMock
      .expects('findOne')
      .withExactArgs({ default: true, company: companyId })
      .chain('lean')
      .returns(defaultInternalHour);

    InternalHourMock
      .expects('findByIdAndRemove')
      .withExactArgs(internalHour._id);

    await InternalHoursHelper.removeInternalHour(internalHour, date);

    InternalHourMock.verify();
    sinon.assert.calledWithExactly(updateEventsInternalHourTypeStub, date, internalHour._id, defaultInternalHour._id);
  });

  it('should return a 500 error if no default internal hour is set', async () => {
    InternalHourMock
      .expects('findOne')
      .withExactArgs({ default: true, company: companyId })
      .chain('lean')
      .returns(null);

    try {
      await InternalHoursHelper.removeInternalHour(internalHour, date);
    } catch (e) {
      expect(e).toEqual(Boom.badImplementation('No default internal hour set'));
    } finally {
      InternalHourMock.verify();
      sinon.assert.notCalled(updateEventsInternalHourTypeStub);
    }
  });
});
