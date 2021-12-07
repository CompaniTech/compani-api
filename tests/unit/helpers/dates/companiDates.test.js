const expect = require('expect');
const sinon = require('sinon');
const luxon = require('../../../../src/helpers/dates/luxon');
const CompaniDatesHelper = require('../../../../src/helpers/dates/companiDates');

describe('CompaniDate', () => {
  let _formatMiscToCompaniDate;

  beforeEach(() => {
    _formatMiscToCompaniDate = sinon.spy(CompaniDatesHelper, '_formatMiscToCompaniDate');
  });

  afterEach(() => {
    _formatMiscToCompaniDate.restore();
  });

  it('should return dateTime', () => {
    const date = new Date('2021-11-24T07:00:00.000Z');

    const result = CompaniDatesHelper.CompaniDate(date);

    expect(result)
      .toEqual(expect.objectContaining({
        _date: expect.any(luxon.DateTime),
        format: expect.any(Function),
        isSame: expect.any(Function),
        diff: expect.any(Function),
      }));
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), date);
  });
});

describe('format', () => {
  const companiDate = CompaniDatesHelper.CompaniDate('2021-11-24T07:12:08.000Z');

  it('should return formated date in a string', () => {
    const result = companiDate.format('\'Le\' cccc dd LLLL y \'à\' HH\'h\'mm \'et\' s \'secondes\'');

    expect(result).toBe('Le mercredi 24 novembre 2021 à 08h12 et 8 secondes');
  });
});

describe('isSame', () => {
  let _formatMiscToCompaniDate;
  const companiDate = CompaniDatesHelper.CompaniDate('2021-11-24T07:00:00.000Z');
  const otherDate = new Date('2021-11-24T10:00:00.000Z');

  beforeEach(() => {
    _formatMiscToCompaniDate = sinon.spy(CompaniDatesHelper, '_formatMiscToCompaniDate');
  });

  afterEach(() => {
    _formatMiscToCompaniDate.restore();
  });

  it('should return true if same day', () => {
    const result = companiDate.isSame(otherDate, 'day');

    expect(result).toBe(true);
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), otherDate);
  });

  it('should return false if different minute', () => {
    const result = companiDate.isSame(otherDate, 'minute');

    expect(result).toBe(false);
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), otherDate);
  });
});

describe('diff', () => {
  let _formatMiscToCompaniDate;
  const companiDate = CompaniDatesHelper.CompaniDate('2021-11-24T10:00:00.000Z');

  beforeEach(() => {
    _formatMiscToCompaniDate = sinon.spy(CompaniDatesHelper, '_formatMiscToCompaniDate');
  });

  afterEach(() => {
    _formatMiscToCompaniDate.restore();
  });

  it('should return diff in milliseconds, if no unit specified', () => {
    const otherDate = new Date('2021-11-24T08:29:48.000Z');
    const result = companiDate.diff(otherDate);
    const expectedDiffInMillis = 1 * 60 * 60 * 1000 + 30 * 60 * 1000 + 12 * 1000;

    expect(result).toBe(expectedDiffInMillis);
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), otherDate);
  });

  it('should return difference in positive days', () => {
    const otherDate = new Date('2021-11-20T10:00:00.000Z');
    const result = companiDate.diff(otherDate, 'days');

    expect(result).toBe(4);
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), otherDate);
  });

  it('should return difference in days. Result should be 0 if difference is less then 24h', () => {
    const otherDate = new Date('2021-11-23T21:00:00.000Z');
    const result = companiDate.diff(otherDate, 'days');

    expect(result).toBe(0);
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), otherDate);
  });

  it('should return difference in positive floated days', () => {
    const otherDate = new Date('2021-11-22T21:00:00.000Z');
    const result = companiDate.diff(otherDate, 'days', true);

    expect(result).toBeGreaterThan(0);
    expect(result - 1.54).toBeLessThan(0.01); // 1.54 days = 1 day and 13 hours
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), otherDate);
  });

  it('should return difference in negative days', () => {
    const otherDate = new Date('2021-11-30T10:00:00.000Z');
    const result = companiDate.diff(otherDate, 'days');

    expect(result).toBe(-6);
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), otherDate);
  });

  it('should return difference in negative floated days', () => {
    const otherDate = new Date('2021-11-30T08:00:00.000Z');
    const result = companiDate.diff(otherDate, 'days', true);

    expect(result).toBeLessThan(0);
    expect(Math.abs(result) - 5.91).toBeLessThan(0.01); // 5.91 days = 5 days and 22 hours
    sinon.assert.calledWithExactly(_formatMiscToCompaniDate.getCall(0), otherDate);
  });
});

describe('_formatMiscToCompaniDate', () => {
  let now;
  let fromJSDate;
  let fromISO;
  let fromFormat;
  let invalid;
  const date = luxon.DateTime.fromISO('2021-11-24T07:00:00.000Z');

  beforeEach(() => {
    now = sinon.spy(luxon.DateTime, 'now');
    fromJSDate = sinon.spy(luxon.DateTime, 'fromJSDate');
    fromISO = sinon.spy(luxon.DateTime, 'fromISO');
    fromFormat = sinon.spy(luxon.DateTime, 'fromFormat');
    invalid = sinon.spy(luxon.DateTime, 'invalid');
  });

  afterEach(() => {
    now.restore();
    fromJSDate.restore();
    fromISO.restore();
    fromFormat.restore();
    invalid.restore();
  });

  it('should return dateTime.now if no arg', () => {
    const result = CompaniDatesHelper._formatMiscToCompaniDate();

    expect(result instanceof luxon.DateTime).toBe(true);
    expect(new luxon.DateTime(result).toJSDate() - new Date()).toBeLessThan(100);
    sinon.assert.calledOnceWithExactly(now);
    sinon.assert.notCalled(fromJSDate);
    sinon.assert.notCalled(fromISO);
    sinon.assert.notCalled(fromFormat);
    sinon.assert.notCalled(invalid);
  });

  it('should return dateTime if arg is object with dateTime', () => {
    const payload = { _date: date };
    const result = CompaniDatesHelper._formatMiscToCompaniDate(payload);

    expect(result instanceof luxon.DateTime).toBe(true);
    expect(new luxon.DateTime(result).toJSDate()).toEqual(new Date('2021-11-24T07:00:00.000Z'));
    sinon.assert.notCalled(now);
    sinon.assert.notCalled(fromJSDate);
    sinon.assert.notCalled(fromISO);
    sinon.assert.notCalled(fromFormat);
    sinon.assert.notCalled(invalid);
  });

  it('should return dateTime if arg is dateTime', () => {
    const payload = date;
    const result = CompaniDatesHelper._formatMiscToCompaniDate(payload);

    expect(result instanceof luxon.DateTime).toBe(true);
    expect(new luxon.DateTime(result).toJSDate()).toEqual(new Date('2021-11-24T07:00:00.000Z'));
    sinon.assert.notCalled(now);
    sinon.assert.notCalled(fromJSDate);
    sinon.assert.notCalled(fromISO);
    sinon.assert.notCalled(fromFormat);
    sinon.assert.notCalled(invalid);
  });

  it('should return dateTime if arg is date', () => {
    const payload = new Date('2021-11-24T07:00:00.000Z');
    const result = CompaniDatesHelper._formatMiscToCompaniDate(payload);

    expect(result instanceof luxon.DateTime).toBe(true);
    expect(new luxon.DateTime(result).toJSDate()).toEqual(new Date('2021-11-24T07:00:00.000Z'));
    sinon.assert.calledOnceWithExactly(fromJSDate, payload);
    sinon.assert.notCalled(now);
    sinon.assert.notCalled(fromISO);
    sinon.assert.notCalled(fromFormat);
    sinon.assert.notCalled(invalid);
  });

  it('should return dateTime if arg is string', () => {
    const payload = '2021-11-24T07:00:00.000Z';
    const result = CompaniDatesHelper._formatMiscToCompaniDate(payload);

    expect(result instanceof luxon.DateTime).toBe(true);
    expect(new luxon.DateTime(result).toJSDate()).toEqual(new Date('2021-11-24T07:00:00.000Z'));
    sinon.assert.calledOnceWithExactly(fromISO, payload);
    sinon.assert.notCalled(now);
    sinon.assert.notCalled(fromJSDate);
    sinon.assert.notCalled(fromFormat);
    sinon.assert.notCalled(invalid);
  });

  it('should return dateTime if 2 args, first argument doesn\'t finish with Z', () => {
    const result = CompaniDatesHelper._formatMiscToCompaniDate(
      '2021-11-24T07:00:00.000+03:00',
      'yyyy-MM-dd\'T\'hh:mm:ss.SSSZZ'
    );

    expect(result instanceof luxon.DateTime).toBe(true);
    expect(new luxon.DateTime(result).toJSDate()).toEqual(new Date('2021-11-24T07:00:00.000+03:00'));
    sinon.assert.calledOnceWithExactly(
      fromFormat,
      '2021-11-24T07:00:00.000+03:00',
      'yyyy-MM-dd\'T\'hh:mm:ss.SSSZZ',
      {}
    );
    sinon.assert.notCalled(now);
    sinon.assert.notCalled(fromJSDate);
    sinon.assert.notCalled(fromISO);
    sinon.assert.notCalled(invalid);
  });

  it('should return dateTime if 2 args, first arguments finish with Z', () => {
    const result = CompaniDatesHelper._formatMiscToCompaniDate(
      '2021-11-24T07:00:00.000Z',
      'yyyy-MM-dd\'T\'hh:mm:ss.SSS\'Z\''
    );

    expect(result instanceof luxon.DateTime).toBe(true);
    expect(new luxon.DateTime(result).toJSDate()).toEqual(new Date('2021-11-24T07:00:00.000Z'));
    sinon.assert.calledOnceWithExactly(
      fromFormat,
      '2021-11-24T07:00:00.000Z',
      'yyyy-MM-dd\'T\'hh:mm:ss.SSS\'Z\'',
      { zone: 'utc' }
    );
    sinon.assert.notCalled(now);
    sinon.assert.notCalled(fromJSDate);
    sinon.assert.notCalled(fromISO);
    sinon.assert.notCalled(invalid);
  });

  it('should return invalid if too many args', () => {
    const result = CompaniDatesHelper
      ._formatMiscToCompaniDate('2021-11-24T07:00:00.000Z', 'MMMM dd yyyy', { locale: 'fr' });

    expect(result instanceof luxon.DateTime).toBe(true);
    sinon.assert.calledOnceWithExactly(invalid, 'wrong arguments');
    sinon.assert.notCalled(now);
    sinon.assert.notCalled(fromJSDate);
    sinon.assert.notCalled(fromISO);
    sinon.assert.notCalled(fromFormat);
  });
});
