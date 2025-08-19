const pick = require('lodash/pick');
const isEqual = require('lodash/isEqual');
const luxon = require('./luxon');
const { getHolidays } = require('./holidays');
const { WORKING_DAYS } = require('../constants');

exports.CompaniDate = (...args) => CompaniDateFactory(exports._formatMiscToCompaniDate(...args));

const CompaniDateFactory = (inputDate) => {
  const _date = inputDate;

  return ({
    // GETTER
    get _getDate() {
      return _date;
    },

    getUnits(units) {
      return pick(_date.toObject(), units);
    },

    toMillis() {
      return _date.toMillis();
    },

    weekday() {
      return _date.weekday - 1;
      /*  fox luxon:  1 = Monday, 2 = Tuesday, ... 7 = Sunday
          for us:     0 = Monday, 1 = Tuesday, ... 6 = Sunday. cf constants.js */
    },

    // DISPLAY
    format(fmt) {
      return _date.toFormat(fmt);
    },

    toDate() {
      return _date.toUTC().toJSDate();
    },

    toISO() {
      return _date.toUTC().toISO();
    },

    toLocalISO() {
      return _date.toLocal().toISO();
    },

    // QUERY
    isBefore(miscTypeOtherDate, unit = 'millisecond') {
      const otherDate = exports._formatMiscToCompaniDate(miscTypeOtherDate);

      return _date.startOf(unit) < otherDate.startOf(unit);
    },

    isAfter(miscTypeOtherDate, unit = 'millisecond') {
      const otherDate = exports._formatMiscToCompaniDate(miscTypeOtherDate);

      return _date.startOf(unit) > otherDate.startOf(unit);
    },

    isSame(miscTypeOtherDate, unit = 'millisecond') {
      const otherDate = exports._formatMiscToCompaniDate(miscTypeOtherDate);

      return _date.hasSame(otherDate, unit);
    },

    isSameOrBefore(miscTypeOtherDate, unit = 'millisecond') {
      const otherDate = exports._formatMiscToCompaniDate(miscTypeOtherDate);

      return (_date.hasSame(otherDate, unit) || _date.startOf(unit) < otherDate.startOf(unit));
    },

    isSameOrAfter(miscTypeOtherDate, unit = 'millisecond') {
      const otherDate = exports._formatMiscToCompaniDate(miscTypeOtherDate);

      return (_date.hasSame(otherDate, unit) || _date.startOf(unit) > otherDate.startOf(unit));
    },

    isSameOrBetween(miscTypeFirstDate, miscTypeSecondDate, unit = 'millisecond') {
      const firstDate = exports._formatMiscToCompaniDate(miscTypeFirstDate);
      const secondDate = exports._formatMiscToCompaniDate(miscTypeSecondDate);

      return (_date.hasSame(firstDate, unit) || _date.hasSame(secondDate, unit) ||
        (_date.startOf(unit) > firstDate.startOf(unit) && _date.startOf(unit) < secondDate.startOf(unit)));
    },

    hasSameUnits(miscTypeOtherDate, units) {
      const otherCompaniDate = CompaniDateFactory(exports._formatMiscToCompaniDate(miscTypeOtherDate));

      return isEqual(this.getUnits(units), otherCompaniDate.getUnits(units));
    },

    isHoliday() {
      const { year } = _date;
      const holidays = getHolidays(year);

      return !!holidays.find(h => _date.hasSame(h, 'day'));
    },

    isBusinessDay() {
      const day = this.weekday();

      return !!(WORKING_DAYS.includes(day) && !this.isHoliday());
    },

    // MANIPULATE
    startOf(unit) {
      return CompaniDateFactory(_date.startOf(unit));
    },

    endOf(unit) {
      return CompaniDateFactory(_date.endOf(unit));
    },

    // fct to be deleted
    oldDiff(miscTypeOtherDate, unit, typeFloat = false) {
      const otherDate = exports._formatMiscToCompaniDate(miscTypeOtherDate);
      const floatedDiff = _date.diff(otherDate, unit).as(unit);

      if (typeFloat) return { [unit]: floatedDiff };

      return { [unit]: floatedDiff > 0 ? Math.floor(floatedDiff) : Math.ceil(floatedDiff) };
    },

    diff(miscTypeOtherDate, unit) {
      if (typeof unit !== 'string') throw Error('Invalid argument: expected unit to be a string');

      const otherDate = exports._formatMiscToCompaniDate(miscTypeOtherDate);
      const diffInSecondAndInputUnit = _date.diff(otherDate, [unit, 'seconds']);

      return diffInSecondAndInputUnit.toISO();
    },

    add(amount) {
      const isoDuration = luxon.Duration.fromISO(amount);
      return CompaniDateFactory(_date.plus(isoDuration));
    },

    // fct to be deleted
    oldAdd(amount) {
      if (amount instanceof Number) throw Error('Invalid argument: expected to be an object, got number');
      return CompaniDateFactory(_date.plus(amount));
    },

    subtract(amount) {
      const isoDuration = luxon.Duration.fromISO(amount);
      return CompaniDateFactory(_date.minus(isoDuration));
    },

    // fct to be deleted
    oldSubtract(amount) {
      if (amount instanceof Number) throw Error('Invalid argument: expected to be an object, got number');
      return CompaniDateFactory(_date.minus(amount));
    },

    set(values) {
      return CompaniDateFactory(_date.set(values));
    },
  });
};

exports._formatMiscToCompaniDate = (...args) => {
  if (!args.length) return luxon.DateTime.now();

  if (args.length === 1) {
    if (args[0] instanceof Object && args[0]._getDate && args[0]._getDate instanceof luxon.DateTime) {
      return args[0]._getDate;
    }
    if (args[0] instanceof Date) return luxon.DateTime.fromJSDate(args[0]);
    if (typeof args[0] === 'string' && args[0] !== '') return luxon.DateTime.fromISO(args[0]);
  }

  if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
    const options = args[0].endsWith('Z') ? { zone: 'utc' } : {};
    return luxon.DateTime.fromFormat(args[0], args[1], options);
  }

  return luxon.DateTime.invalid('wrong arguments');
};
