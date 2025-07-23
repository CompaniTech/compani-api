const { DURATION_UNITS, LONG_DURATION_H_MM, SHORT_DURATION_H_MM } = require('../constants');
const luxon = require('./luxon');

const DURATION_HOURS = 'h\'h\'';
const DURATION_MINUTES = 'm\'min\'';
exports.ISO_DURATION_VALIDATION = /(PT\d*H\d*M|PT\d*S)/;

exports.CompaniDuration = (...args) => companiDurationFactory(exports._formatMiscToCompaniDuration(...args));

const companiDurationFactory = (inputDuration) => {
  const _duration = inputDuration;

  return {
    // GETTER
    get _getDuration() {
      return _duration;
    },

    // DISPLAY
    format(template) {
      const shiftedDuration = _duration.shiftTo('hours', 'minutes', 'seconds');
      const minutes = shiftedDuration.get('minutes');
      const hours = shiftedDuration.get('hours');

      if (template === SHORT_DURATION_H_MM) {
        if (minutes === 0) return _duration.toFormat(DURATION_HOURS);

        return _duration.toFormat(SHORT_DURATION_H_MM);
      } if (template === LONG_DURATION_H_MM) {
        if (hours === 0) return _duration.toFormat(DURATION_MINUTES);
        if (minutes === 0) return _duration.toFormat(DURATION_HOURS);

        return _duration.toFormat(LONG_DURATION_H_MM);
      }
      throw Error('Invalid argument: expected specific format');
    },

    asYears() {
      return _duration.as('years');
    },

    asMonths() {
      return _duration.as('months');
    },

    asDays() {
      return _duration.as('days');
    },

    asHours() {
      return _duration.as('hours');
    },

    asMinutes() {
      return _duration.as('minutes');
    },

    asSeconds() {
      return _duration.as('seconds');
    },

    toHoursAndMinutesObject() {
      const shiftedDuration = _duration.shiftTo('hours', 'minutes');
      return { hours: shiftedDuration.get('hours'), minutes: shiftedDuration.get('minutes') };
    },

    toMonthAndDaysObject() {
      const shiftedDuration = _duration.shiftTo('months', 'days');
      const months = shiftedDuration.get('months');
      const days = shiftedDuration.get('days');
      return { months, days };
    },

    toISO() {
      return _duration.toISO();
    },

    // QUERY
    isEquivalentTo(miscTypeOtherDuration) {
      const otherDurationInSeconds = exports._formatMiscToCompaniDuration(miscTypeOtherDuration).shiftTo('seconds');
      const durationInSeconds = _duration.shiftTo('seconds');

      return durationInSeconds.equals(otherDurationInSeconds);
    },

    isLongerThan(miscTypeOtherDuration) {
      const otherDurationInSeconds = exports._formatMiscToCompaniDuration(miscTypeOtherDuration).as('seconds');
      const durationInSeconds = _duration.as('seconds');

      return durationInSeconds > otherDurationInSeconds;
    },

    isShorterThan(miscTypeOtherDuration) {
      const otherDurationInSeconds = exports._formatMiscToCompaniDuration(miscTypeOtherDuration).as('seconds');
      const durationInSeconds = _duration.as('seconds');

      return durationInSeconds < otherDurationInSeconds;
    },

    // MANIPULATE
    add(miscTypeOtherDuration) {
      const otherDuration = exports._formatMiscToCompaniDuration(miscTypeOtherDuration);

      return companiDurationFactory(_duration.plus(otherDuration));
    },

    subtract(miscTypeOtherDuration) {
      const otherDuration = exports._formatMiscToCompaniDuration(miscTypeOtherDuration);

      return companiDurationFactory(_duration.minus(otherDuration));
    },

    abs() {
      if (_duration.as('seconds') > 0) return companiDurationFactory(_duration);
      return companiDurationFactory(_duration.mapUnits(value => -value));
    },
  };
};

exports._formatMiscToCompaniDuration = (...args) => {
  if (args.length === 0) return luxon.Duration.fromObject({});

  if (args.length === 1) {
    if (typeof args[0] === 'string') return luxon.Duration.fromISO(args[0]);

    if (args[0] instanceof Object) {
      if (args[0]._getDuration && args[0]._getDuration instanceof luxon.Duration) return args[0]._getDuration;
      if (Object.keys(args[0]).every(key => DURATION_UNITS.includes(key))) return luxon.Duration.fromObject(args[0]);
    }
  }
  return luxon.Duration.invalid('wrong arguments');
};
