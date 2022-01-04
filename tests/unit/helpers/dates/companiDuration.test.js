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

  it('should return duration', () => {
    const duration = { seconds: 1200000 };

    const result = CompaniDurationsHelper.CompaniDuration(duration);

    expect(result)
      .toEqual(expect.objectContaining({
        _duration: expect.any(luxon.Duration),
        format: expect.any(Function),
        add: expect.any(Function),
      }));
    sinon.assert.calledWithExactly(_formatMiscToCompaniDuration.getCall(0), duration);
  });
});

describe('format', () => {
  it('should return formatted duration with minutes', () => {
    const durationAmount = { seconds: 5 * 60 * 60 + 16 * 60 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('5h16');
  });

  it('should return formatted duration with minutes, leading zero on minutes', () => {
    const durationAmount = { seconds: 5 * 60 * 60 + 3 * 60 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('5h03');
  });

  it('should return formatted duration without minutes', () => {
    const durationAmount = { seconds: 13 * 60 * 60 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('13h');
  });

  it('should return formatted duration, days are converted to hours', () => {
    const durationAmount = { seconds: 2 * 24 * 60 * 60 + 1 * 60 * 60 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('49h');
  });

  it('should return formatted duration with minutes, seconds and milliseconds have no effect', () => {
    const durationAmount = { seconds: 1 * 60 * 60 + 2 * 60 + 30 + 0.4 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('1h02');
  });

  it('should return formatted duration without minutes, seconds and milliseconds have no effect', () => {
    const durationAmount = { seconds: 1 * 60 * 60 + 55 + 0.9 };
    const companiDuration = CompaniDurationsHelper.CompaniDuration(durationAmount);
    const result = companiDuration.format();

    expect(result).toBe('1h');
  });
});

describe('add', () => {
  let _formatMiscToCompaniDuration;
  const durationAmountInMillis = 60 * 60 * 1000;
  const companiDuration = CompaniDurationsHelper.CompaniDuration({ seconds: durationAmountInMillis / 1000 });

  beforeEach(() => {
    _formatMiscToCompaniDuration = sinon.spy(CompaniDurationsHelper, '_formatMiscToCompaniDuration');
  });

  afterEach(() => {
    _formatMiscToCompaniDuration.restore();
  });

  it('should increase companiDuration, and return a reference', () => {
    const addedAmountInMillis = 2 * 60 * 60 * 1000 + 5 * 60 * 1000;
    const result = companiDuration.add({ seconds: addedAmountInMillis / 1000 });

    expect(result).toBe(companiDuration);
    expect(companiDuration._duration.toMillis()).toBe(durationAmountInMillis + addedAmountInMillis);
    sinon.assert.calledWithExactly(_formatMiscToCompaniDuration.getCall(0), { seconds: addedAmountInMillis / 1000 });
  });
});

describe('_formatMiscToCompaniDuration', () => {
  let fromObject;
  let fromMillis;
  let invalid;
  const duration = luxon.Duration.fromMillis(123456789);

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
    const payload = { _duration: duration };
    const result = CompaniDurationsHelper._formatMiscToCompaniDuration(payload);

    expect(result instanceof luxon.Duration).toBe(true);
    expect(new luxon.Duration(result).toMillis()).toEqual(123456789);
    sinon.assert.notCalled(fromMillis);
    sinon.assert.notCalled(fromObject);
    sinon.assert.notCalled(invalid);
  });

  it('should return duration if arg is an object with luxon duration keys', () => {
    const payload = { hours: 3, minutes: 35, seconds: 12 };
    const result = CompaniDurationsHelper._formatMiscToCompaniDuration(payload);

    expect(result.values).toEqual(payload);
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
});
