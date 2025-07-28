const { expect } = require('expect');
const sinon = require('sinon');
const { SHORT_DURATION_H_MM, LONG_DURATION_H_MM } = require('../../../../src/helpers/constants');
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
      const duration = {
        years: 3,
        months: 1,
        weeks: 2,
        days: 13,
        hours: 19,
        minutes: 12,
        seconds: 9,
        milliseconds: 452,
      };

      const result = CompaniDurationsHelper.CompaniDuration(duration);

      expect(result)
        .toEqual(expect.objectContaining({
          _getDuration: expect.any(luxon.Duration),
          format: expect.any(Function),
          asHours: expect.any(Function),
          toISO: expect.any(Function),
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

describe('GETTER', () => {
  describe('getDuration', () => {
    it('should return _duration', () => {
      const durationObject = { hours: 3, minutes: 22, seconds: 57 };
      const companiDuration = CompaniDurationsHelper.CompaniDuration(durationObject);
      const result = companiDuration._getDuration;

      expect(result).toEqual(expect.any(luxon.Duration));
      expect(result).toEqual(luxon.Duration.fromObject(durationObject));
    });
  });
});

describe('DISPLAY', () => {
  describe('format', () => {
    describe('SHORT_DURATION_H_MM', () => {
      it('should return formatted duration with minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT5H16M');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('5h16');
      });

      it('should return formatted duration with minutes, leading zero on minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT5H3M');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('5h03');
      });

      it('should return formatted duration without minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT13H');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('13h');
      });

      it('should return formatted duration without hours', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT34M');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('0h34');
      });

      it('should return formatted duration without hours, leading zero on minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT8M');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('0h08');
      });

      it('should return formatted duration, value is 0', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT0S');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('0h');
      });

      it('should return formatted duration, days are converted to hours', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('P2DT1H');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('49h');
      });

      it('should return formatted duration, month are converted to hours', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('P1M');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('720h'); // 30 * 24 = 720
      });

      it('should return formatted duration, seconds are converted to minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT2H742S');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('2h12');
      });

      it('should return formatted duration with minutes, seconds have no effect under 60s', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT1H2M32.1S');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('1h02');
      });

      it('should return formatted duration without minutes, seconds have no effect under 60s', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT1H32.1S');
        const result = companiDuration.format(SHORT_DURATION_H_MM);

        expect(result).toBe('1h');
      });
    });

    describe('LONG_DURATION_H_MM', () => {
      it('should return formatted duration with minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT5H16M');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('5h 16min');
      });

      it('should return formatted duration with minutes, leading zero on minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT5H3M');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('5h 03min');
      });

      it('should return formatted duration without minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT13H');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('13h');
      });

      it('should return formatted duration without hours, leading zero on minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT7M');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('7min');
      });

      it('should return formatted duration without hours, leading zero on minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT34M');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('34min');
      });

      it('should return formatted duration, value is 0', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT0S');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('0min');
      });

      it('should return formatted duration, days are converted to hours', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('P2DT1H');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('49h');
      });

      it('should return formatted duration, month are converted to hours', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('P1M');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('720h'); // 30 * 24 = 720
      });

      it('should return formatted duration, seconds are converted to minutes', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT2H742S');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('2h 12min');
      });

      it('should return formatted duration with minutes, seconds have no effect under 60s', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT1H2M32.1S');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('1h 02min');
      });

      it('should return formatted duration without minutes, seconds have no effect under 60s', () => {
        const companiDuration = CompaniDurationsHelper.CompaniDuration('PT1H32.1S');
        const result = companiDuration.format(LONG_DURATION_H_MM);

        expect(result).toBe('1h');
      });
    });
  });

  describe('asYears', () => {
    it('should return duration in years', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P3Y');
      const result = companiDuration.asYears();

      expect(result).toBe(3);
    });

    it('should return duration in years, with months', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P1Y2M');
      const result = companiDuration.asYears();

      expect(result).toBe(1.1666666666666667); // 1.1666666666666667 = 1 + 2 / 12
    });

    it('should return duration in years, with days', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P4Y5D');
      const result = companiDuration.asYears();

      expect(result).toBe(4.013698630136986); // 4.013698630136986 = 4 + 5 / 365
    });

    it('should return duration in months, with seconds', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P7YT45S');
      const result = companiDuration.asYears();

      expect(result).toBe(7.000001426940639); //  7.000001426940639   = 7 + 4 / (3600 * 24 * 365)
    });
  });

  describe('asMonths', () => {
    it('should return duration in months', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P5M');
      const result = companiDuration.asMonths();

      expect(result).toBe(5);
    });

    it('should return duration in months, with days', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P1M9D');
      const result = companiDuration.asMonths();

      expect(result).toBe(1.3); // 1.2 = 1 + 9 / 30
    });

    it('should return duration in months, with hours', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P2MT9H');
      const result = companiDuration.asMonths();

      expect(result).toBe(2.0125); // 2.00625 = 2 + 9 / (24 * 30)
    });

    it('should return duration in months, with seconds', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P1MT4S');
      const result = companiDuration.asMonths();

      expect(result).toBe(1.0000015432098766); // 1.0000015432098766 = 1 + 4 / (3600 * 24 * 30)
    });
  });

  describe('asDays', () => {
    it('should return duration in days', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P3D');
      const result = companiDuration.asDays();

      expect(result).toBe(3);
    });

    it('should return duration in days, with hours', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P1DT9H');
      const result = companiDuration.asDays();

      expect(result).toBe(1.375); // 1.375 = 1 + 9 / 24
    });

    it('should return duration in days, with minutes', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P1DT9M');
      const result = companiDuration.asDays();

      expect(result).toBe(1.00625); // 1.00625 = 1 + 9 / 1440
    });

    it('should return duration in days, with seconds', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P1DT27S');
      const result = companiDuration.asDays();

      expect(result).toBe(1.0003125); // 1.0003125 = 1 + 27 / 86400
    });
  });

  describe('asHours', () => {
    it('should return duration in hours', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('PT3H');
      const result = companiDuration.asHours();

      expect(result).toBe(3);
    });

    it('should return duration in hours, with days', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P2DT3H');
      const result = companiDuration.asHours();

      expect(result).toBe(51);
    });

    it('should return duration in hours, with minutes', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('PT1H9M');
      const result = companiDuration.asHours();

      expect(result).toBe(1.15); // 1.15 = 1 + 9 / 60
    });

    it('should return duration in hours, with seconds', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('PT1H4S');
      const result = companiDuration.asHours();

      expect(result).toBe(1.001111111111111);
    });
  });

  describe('asMinutes', () => {
    it('should return duration in minutes', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('PT1H9M');
      const result = companiDuration.asMinutes();

      expect(result).toBe(69);
    });
  });

  describe('asSeconds', () => {
    it('should return duration in seconds', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('PT1H9M');
      const result = companiDuration.asSeconds();

      expect(result).toBe(4140);
    });
  });

  describe('toHoursAndMinutesObject', () => {
    it('should return object with hours and minutes from CompaniDuration', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('PT4140S');
      const result = companiDuration.toHoursAndMinutesObject();

      expect(result).toEqual({ hours: 1, minutes: 9 });
    });
  });

  describe('toMonthAndDaysObject', () => {
    it('should return object with months and days from CompaniDuration', () => {
      const companiDuration = CompaniDurationsHelper.CompaniDuration('P36DT');
      const result = companiDuration.toMonthAndDaysObject();

      expect(result).toEqual({ months: 1, days: 6 });
    });
  });

  describe('toISO', () => {
    it('should return ISO string if argument is ISO string', () => {
      const duration = 'PT2H30M';
      const result = CompaniDurationsHelper.CompaniDuration(duration).toISO();

      expect(result).toEqual(duration);
    });

    it('should return ISO string if argument is object', () => {
      const result = CompaniDurationsHelper.CompaniDuration({ hours: 2, minutes: 30 }).toISO();

      expect(result).toEqual('PT2H30M');
    });

    it('should return PT0S if no argument', () => {
      const result = CompaniDurationsHelper.CompaniDuration().toISO();

      expect(result).toEqual('PT0S');
    });

    it('should return PT0S if duration worths 0 month', () => {
      const result = CompaniDurationsHelper.CompaniDuration('P0M').toISO();

      expect(result).toEqual('PT0S');
    });
  });
});

describe('MANIPULATE', () => {
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

    it('should increase a newly constructed companiDuration, increased by amount', () => {
      const addedAmount = { hours: 2, minutes: 5 };
      const result = companiDuration.add(addedAmount);

      expect(result).toEqual(expect.objectContaining({ _getDuration: expect.any(luxon.Duration) }));
      const amountInMs = (durationAmount.hours + addedAmount.hours) * 60 * 60 * 1000 + addedAmount.minutes * 60 * 1000;
      expect(result._getDuration.toMillis()).toBe(amountInMs);
      sinon.assert.calledWithExactly(_formatMiscToCompaniDuration.getCall(0), addedAmount);
    });
  });

  describe('subtract', () => {
    let _formatMiscToCompaniDuration;

    beforeEach(() => {
      _formatMiscToCompaniDuration = sinon.spy(CompaniDurationsHelper, '_formatMiscToCompaniDuration');
    });

    afterEach(() => {
      _formatMiscToCompaniDuration.restore();
    });

    it('should decrease duration by amount', () => {
      const result = CompaniDurationsHelper.CompaniDuration('P1D').subtract('PT2H5M');

      expect(result).toEqual(expect.objectContaining({ _getDuration: expect.any(luxon.Duration) }));
      const expectedAmountInMs = ((24 - 2) * 60 - 5) * 60 * 1000;
      expect(result._getDuration.toMillis()).toBe(expectedAmountInMs);
      sinon.assert.calledWithExactly(_formatMiscToCompaniDuration.getCall(0), 'P1D');
      sinon.assert.calledWithExactly(_formatMiscToCompaniDuration.getCall(1), 'PT2H5M');
    });
  });

  describe('abs', () => {
    it('should return same value, as it is positive', () => {
      const duration = CompaniDurationsHelper.CompaniDuration('P1DT-13H-4M32S'); // 39392000 ms
      const result = duration.abs();

      expect(result).toEqual(expect.objectContaining({ _getDuration: expect.any(luxon.Duration) }));
      expect(result._getDuration.toISO()).toEqual('P1DT-13H-4M32S');
      expect(result._getDuration.toMillis()).toBe(39392000);
    });

    it('should return opposite value, as it is negative', () => {
      const duration = CompaniDurationsHelper.CompaniDuration('P1DT-32H-4M32S'); // -29008000 ms
      const result = duration.abs();

      expect(result).toEqual(expect.objectContaining({ _getDuration: expect.any(luxon.Duration) }));
      expect(result._getDuration.toISO()).toEqual('P-1DT32H4M-32S');
      expect(result._getDuration.toMillis()).toBe(29008000);
    });
  });
});

describe('QUERY', () => {
  describe('isEquivalentTo', () => {
    it('should return true if same durations with same units', () => {
      const duration = 'P1DT1H2M3S';
      const otherDuration = 'P1DT1H2M3S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isEquivalentTo(otherDuration);

      expect(result).toBe(true);
    });

    it('should return true if same durations with different units', () => {
      const duration = 'P1DT1H2M3S';
      const otherDuration = 'PT25H123S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isEquivalentTo(otherDuration);

      expect(result).toBe(true);
    });

    it('should return false if different durations', () => {
      const duration = 'P1DT1H2M3S';
      const otherDuration = 'PT24H123S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isEquivalentTo(otherDuration);

      expect(result).toBe(false);
    });
  });

  describe('isLongerThan', () => {
    it('should return true if longer duration with same units', () => {
      const duration = 'P1DT2H2M3S';
      const otherDuration = 'P1DT1H2M3S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isLongerThan(otherDuration);

      expect(result).toBe(true);
    });

    it('should return true if longer duration with different units', () => {
      const duration = 'PT25H2M3S';
      const otherDuration = 'P1DT30S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isLongerThan(otherDuration);

      expect(result).toBe(true);
    });

    it('should return true if comparing MAX_SAFE_INTEGER with lower value', () => {
      const duration = `PT${Number.MAX_SAFE_INTEGER}S`;
      const otherDuration = `PT${Number.MAX_SAFE_INTEGER - 1}S`;

      const result = CompaniDurationsHelper.CompaniDuration(duration).isLongerThan(otherDuration);

      expect(result).toBe(true);
    });

    it('should return false if same duration with same units', () => {
      const duration = 'P1DT2H2M3S';
      const otherDuration = 'P1DT2H2M3S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isLongerThan(otherDuration);

      expect(result).toBe(false);
    });

    it('should return false if same duration with different units', () => {
      const duration = 'P1DT1H2M3S';
      const otherDuration = 'PT25H123S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isLongerThan(otherDuration);

      expect(result).toBe(false);
    });

    it('should return false if shorter duration with same units', () => {
      const duration = 'P1DT1H1M3S';
      const otherDuration = 'P1DT2H2M3S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isLongerThan(otherDuration);

      expect(result).toBe(false);
    });

    it('should return false if shorter duration with different units', () => {
      const duration = 'P1DT1H';
      const otherDuration = 'PT40H';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isLongerThan(otherDuration);

      expect(result).toBe(false);
    });
  });

  describe('isShorterThan', () => {
    it('should return true if shorter duration with same units', () => {
      const duration = 'P1DT1H2M6S';
      const otherDuration = 'P1DT2H2M3S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isShorterThan(otherDuration);

      expect(result).toBe(true);
    });

    it('should return true if shorter duration with different units', () => {
      const duration = 'PT22H2M3S';
      const otherDuration = 'P1DT30S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isShorterThan(otherDuration);

      expect(result).toBe(true);
    });

    it('should return true if comparing with MAX_SAFE_INTEGER with lower value', () => {
      const duration = `PT${Number.MAX_SAFE_INTEGER - 1000}S`;
      const otherDuration = `PT${Number.MAX_SAFE_INTEGER}S`;

      const result = CompaniDurationsHelper.CompaniDuration(duration).isShorterThan(otherDuration);

      expect(result).toBe(true);
    });

    it('should return false if same duration with same units', () => {
      const duration = 'P1DT2H2M3S';
      const otherDuration = 'P1DT2H2M3S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isShorterThan(otherDuration);

      expect(result).toBe(false);
    });

    it('should return false if same duration with different units', () => {
      const duration = 'P1DT1H2M3S';
      const otherDuration = 'PT25H123S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isShorterThan(otherDuration);

      expect(result).toBe(false);
    });

    it('should return false if longer duration with same units', () => {
      const duration = 'P1DT3H1M3S';
      const otherDuration = 'P1DT2H2M3S';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isShorterThan(otherDuration);

      expect(result).toBe(false);
    });

    it('should return false if longer duration with different units', () => {
      const duration = 'P1DT30H';
      const otherDuration = 'PT40H';

      const result = CompaniDurationsHelper.CompaniDuration(duration).isShorterThan(otherDuration);

      expect(result).toBe(false);
    });
  });
});

describe('_formatMiscToCompaniDuration', () => {
  let fromObject;
  let fromMillis;
  let invalid;
  let fromISO;

  beforeEach(() => {
    fromObject = sinon.spy(luxon.Duration, 'fromObject');
    fromMillis = sinon.spy(luxon.Duration, 'fromMillis');
    invalid = sinon.spy(luxon.Duration, 'invalid');
    fromISO = sinon.spy(luxon.Duration, 'fromISO');
  });

  afterEach(() => {
    fromObject.restore();
    fromMillis.restore();
    invalid.restore();
    fromISO.restore();
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
    const payload = { years: 1, months: 2, weeks: 3, days: 4, hours: 5, minutes: 35, seconds: 12, milliseconds: 873 };
    const result = CompaniDurationsHelper._formatMiscToCompaniDuration(payload);

    expect(result instanceof luxon.Duration).toBe(true);
    expect(result.toMillis()).toEqual(((((1 * 365 + 2 * 30 + 3 * 7 + 4) * 24 + 5) * 60 + 35) * 60 + 12) * 1000 + 873);
    sinon.assert.calledOnce(fromObject);
    sinon.assert.notCalled(invalid);
  });

  it('should return duration from iso', () => {
    const result = CompaniDurationsHelper.CompaniDuration('P1Y2M5DT3H4M2S');
    expect(result)
      .toEqual(expect.objectContaining({
        _getDuration: expect.any(luxon.Duration),
        format: expect.any(Function),
        add: expect.any(Function),
        asHours: expect.any(Function),
      }));
    expect(result._getDuration.toMillis()).toEqual(((((1 * 365 + 2 * 30 + 5) * 24 + 3) * 60 + 4) * 60 + 2) * 1000);
    sinon.assert.calledOnceWithExactly(fromISO, 'P1Y2M5DT3H4M2S');
  });

  it('should return error if invalid iso string', () => {
    try {
      CompaniDurationsHelper.CompaniDuration('P1Y2M2D3H4M2S');

      expect(true).toBe(false);
    } catch (e) {
      expect(e)
        .toEqual(new Error('Invalid Duration: unparsable: the input "P1Y2M2D3H4M2S" can\'t be parsed as ISO 8601'));
    } finally {
      sinon.assert.calledOnceWithExactly(fromISO, 'P1Y2M2D3H4M2S');
    }
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
