const expect = require('expect');
const sinon = require('sinon');
const luxon = require('../../../../src/helpers/dates/luxon');
const CompaniDurationsHelper = require('../../../../src/helpers/dates/companiDurations');

describe('CompaniDuration', () => {
  let _formatMiscToCompaniDuration;

  beforeEach(() => {
    _formatMiscToCompaniDuration = sinon.spy(CompaniDurationsHelper, '_formatMiscToCompaniDuration');
  });

  afterEach(() => {
    _formatMiscToCompaniDuration.restore();
  });

  it('should not mutate _duration', () => {
    const durationObject = { days: 2 };
    const otherDurationObject = { hours: 10 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationObject);
    companiDuration._duration = luxon.Duration.fromObject(otherDurationObject);

    expect(companiDuration._getDuration.toObject()).toEqual(durationObject);
  });

  describe('Constructor', () => {
    it('should return duration', () => {
      const duration = { days: 13, hours: 19, minutes: 12 };

      const result = CompaniDurationsHelper.CompaniDuration(duration);

      expect(result)
        .toEqual(expect.objectContaining({
          _getDuration: expect.any(luxon.Duration),
          format: expect.any(Function),
          add: expect.any(Function),
        }));
      sinon.assert.calledWithExactly(_formatMiscToCompaniDuration.getCall(0), duration);
    });

    it('should return error if invalid argument', () => {
      try {
        CompaniDurationsHelper.CompaniDuration(null);
      } catch (e) {
        expect(e).toEqual(new Error('Invalid Duration: wrong arguments'));
      } finally {
        sinon.assert.calledOnceWithExactly(_formatMiscToCompaniDuration, null);
      }
    });
  });
});

describe('format', () => {
  it('should return formatted duration with minutes', () => {
    const durationAmount = { hours: 5, minutes: 16 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('5h16');
  });

  it('should return formatted duration with minutes, leading zero on minutes', () => {
    const durationAmount = { hours: 5, minutes: 3 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('5h03');
  });

  it('should return formatted duration without minutes', () => {
    const durationAmount = { hours: 13 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('13h');
  });

  it('should return formatted duration, days are converted to hours', () => {
    const durationAmount = { days: 2, hours: 1 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('49h');
  });

  it('should return formatted duration with minutes, seconds and milliseconds have no effect', () => {
    const durationAmount = { hours: 1, minutes: 2, seconds: 4 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('1h02');
  });

  it('should return formatted duration without minutes, seconds and milliseconds have no effect', () => {
    const durationAmount = { hours: 1, seconds: 9 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('1h');
  });
});

describe('add', () => {
  let _formatMiscToCompaniDuration;
  const durationAmount = { hours: 1 };
  const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);

  beforeEach(() => {
    _formatMiscToCompaniDuration = sinon.spy(CompaniDurationsHelper, '_formatMiscToCompaniDuration');
  });

  afterEach(() => {
    _formatMiscToCompaniDuration.restore();
  });

  it('should increase companiDuration, and return a reference', () => {
    const addedAmount = { hours: 2, minutes: 5 };
    const result = companiDuration.add(addedAmount);

    expect(result).toBe(companiDuration);
    const amountInMs = (durationAmount.hours + addedAmount.hours) * 60 * 60 * 1000 + addedAmount.minutes * 60 * 1000;
    expect(companiDuration._getDuration.toMillis()).toBe(amountInMs);
    sinon.assert.calledWithExactly(_formatMiscToCompaniDuration.getCall(0), addedAmount);
  });
});

describe('_formatMiscToCompaniDuration', () => {
  let fromObject;
  let fromMillis;
  let invalid;

  beforeEach(() => {
    fromObject = sinon.spy(luxon.Duration, 'fromObject');
    fromMillis = sinon.spy(luxon.Duration, 'fromMillis');
    invalid = sinon.spy(luxon.Duration, 'invalid');
  });

  afterEach(() => {
    fromObject.restore();
    fromMillis.restore();
    invalid.restore();
  });

  it('should return duration being worth 0 if no args', () => {
    const result = CompaniDurationsHelper._formatMiscToCompaniDuration();

    expect(result instanceof luxon.Duration).toBe(true);
    expect(new luxon.Duration(result).toMillis()).toBe(0);
    sinon.assert.calledOnceWithExactly(fromObject, {});
    sinon.assert.notCalled(fromMillis);
    sinon.assert.notCalled(invalid);
  });

  it('should return duration if arg is object with duration', () => {
    const duration = luxon.Duration.fromMillis(123456789);
    const payload = { _getDuration: duration };
    const result = CompaniDurationsHelper._formatMiscToCompaniDuration(payload);

    expect(result instanceof luxon.Duration).toBe(true);
    expect(new luxon.Duration(result).toMillis()).toEqual(123456789);
    sinon.assert.calledOnceWithExactly(fromMillis, 123456789);
    sinon.assert.calledOnce(fromObject);
    sinon.assert.notCalled(invalid);
  });

  it('should return duration if arg is an object with luxon duration keys', () => {
    const payload = { hours: 3, minutes: 35, seconds: 12 };
    const result = CompaniDurationsHelper._formatMiscToCompaniDuration(payload);

    expect(result instanceof luxon.Duration).toBe(true);
    expect(new luxon.Duration(result).toMillis()).toEqual(3 * 60 * 60 * 1000 + 35 * 60 * 1000 + 12 * 1000);
    sinon.assert.calledOnce(fromObject);
    sinon.assert.notCalled(invalid);
  });

  it('should return invalid if wrong input', () => {
    try {
      CompaniDurationsHelper._formatMiscToCompaniDuration(23232323, 'minutes');
    } catch (e) {
      expect(e).toEqual(new Error('Invalid Duration: wrong arguments'));
    } finally {
      sinon.assert.calledOnceWithExactly(invalid, 'wrong arguments');
      sinon.assert.notCalled(fromObject);
      sinon.assert.notCalled(fromMillis);
    }
  });

  it('should return invalid if wrong unit in object input', () => {
    try {
      CompaniDurationsHelper._formatMiscToCompaniDuration({ wrong: 123 });
    } catch (e) {
      expect(e).toEqual(new Error('Invalid Duration: wrong arguments'));
    } finally {
      sinon.assert.calledOnceWithExactly(invalid, 'wrong arguments');
      sinon.assert.notCalled(fromObject);
      sinon.assert.notCalled(fromMillis);
    }
  });
});
