const get = require('lodash/get');
const omit = require('lodash/omit');
const isEmpty = require('lodash/isEmpty');
const flat = require('flat');
const { ObjectId } = require('mongodb');
const { isObjectIdOrHexString } = require('mongoose');
const Intl = require('intl');
const { CIVILITY_LIST, SHORT_DURATION_H_MM, HHhMM, SECOND } = require('./constants');
const DatesHelper = require('./dates');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');
const NumbersHelper = require('./numbers');

exports.getLastVersion = (versions, dateKey) => {
  if (versions.length === 0) return null;
  if (versions.length === 1) return versions[0];

  return [...versions].sort(DatesHelper.descendingSort(dateKey))[0];
};

exports.getFirstVersion = (versions, dateKey) => {
  if (versions.length === 0) return null;
  if (versions.length === 1) return versions[0];

  return [...versions].sort(DatesHelper.ascendingSort(dateKey))[0];
};

exports.mergeLastVersionWithBaseObject = (baseObj, dateKey) => {
  const lastVersion = exports.getLastVersion(baseObj.versions, dateKey);
  if (!lastVersion) throw new Error('Unable to find last version from base object !');

  return { ...lastVersion, ...omit(baseObj, ['versions', 'createdAt']) };
};

const defaultFilterMethod = date => ver => DatesHelper.isSameOrBefore(ver.startDate, date, 'd') &&
  (!ver.endDate || DatesHelper.isSameOrAfter(ver.endDate, date, 'd'));

// `obj.versions` should be sort in descending order
exports.getMatchingVersion = (date, obj, dateKey, filterMethod = defaultFilterMethod) => {
  if (obj.versions.length === 0) return null;

  const matchingVersion = [...obj.versions]
    .filter(filterMethod(date))
    .sort(DatesHelper.descendingSort(dateKey))[0];
  if (!matchingVersion) return null;

  return {
    ...omit(obj, 'versions'),
    ...omit(matchingVersion, ['_id', 'createdAt']),
    versionId: matchingVersion._id,
  };
};

exports.getMatchingObject = (date, list, dateKey) => {
  if (list.length === 0) return null;

  const filteredAndSortedList = list
    .filter(h => DatesHelper.isSameOrBefore(h.startDate, date, 'd') &&
      (!h.endDate || DatesHelper.isSameOrAfter(h.endDate, date, 'd')))
    .sort(DatesHelper.descendingSort(dateKey));
  if (!filteredAndSortedList.length) return null;

  return filteredAndSortedList[0];
};

exports.getFixedNumber = (number, toFixedNb = 2) =>
  (Math.round(number * (10 ** toFixedNb)) / (10 ** toFixedNb)).toFixed(toFixedNb);

exports.removeSpaces = str => (str ? str.split(' ').join('') : '');

const roundFrenchPrice = (number) => {
  const nf = new Intl.NumberFormat(
    'fr-FR',
    { minimumFractionDigits: 2, style: 'currency', currency: 'EUR', currencyDisplay: 'symbol' }
  );

  const roundedNumber = NumbersHelper.toFixedToFloat(number);
  return nf.format(roundedNumber);
};

exports.formatPrice = val => (val ? roundFrenchPrice(val) : roundFrenchPrice(0));

exports.roundFrenchNumber = (number, digits) => {
  const nf = new Intl.NumberFormat(
    'fr-FR',
    { minimumFractionDigits: digits, style: 'decimal', maximumFractionDigits: digits }
  );

  const roundedNumber = NumbersHelper.toFixedToFloat(number, digits);
  return nf.format(roundedNumber);
};

exports.formatHour = val => (val ? `${exports.roundFrenchNumber(val, 2)}h` : `${exports.roundFrenchNumber(0, 2)}h`);

const roundFrenchPercentage = (number) => {
  const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, style: 'percent' });

  const roundedNumber = NumbersHelper.toFixedToFloat(number, 4);
  return nf.format(roundedNumber);
};

exports.formatPercentage = val => (val ? roundFrenchPercentage(val) : roundFrenchPercentage(0));

exports.getFullTitleFromIdentity = (identity) => {
  if (!identity) return '';

  const lastname = identity.lastname || '';
  let fullTitle = [
    CIVILITY_LIST[identity.title] || '',
    identity.firstname || '',
    lastname.toUpperCase(),
  ];

  fullTitle = fullTitle.filter(value => !isEmpty(value));

  return fullTitle.join(' ');
};

exports.formatFloatForExport = (number, decimals = 2) => {
  if (number == null || Number.isNaN(number) || number === '') return '';
  return parseFloat(number).toFixed(decimals).replace('.', ',');
};

exports.formatArrayOrStringQueryParam = (param, keyName) =>
  (Array.isArray(param) ? param.map(id => ({ [keyName]: id })) : [{ [keyName]: param }]);

exports.capitalize = (s) => {
  if (typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

exports.formatIdentity = (identity, format) => {
  if (!identity) return '';
  const formatLower = format.toLowerCase();
  const values = [];

  for (let i = 0; i < format.length; i++) {
    let value;
    if (formatLower[i] === 'f') value = (identity.firstname || '').trim();
    else if (formatLower[i] === 'l') value = (identity.lastname || '').trim().toUpperCase();
    else if (formatLower[i] === 't') value = (CIVILITY_LIST[identity.title] || '').trim();

    if (!value) continue;

    if (formatLower[i] === format[i]) value = `${value.charAt(0).toUpperCase()}.`;
    values.push(value);
  }

  return values.join(' ');
};
exports.flatQuery = (payload) => {
  const flattenPayload = flat(JSON.parse(JSON.stringify(payload)), { safe: true });

  const flattenPayloadWithObjectIds = {};
  for (const [key, value] of Object.entries(flattenPayload)) {
    flattenPayloadWithObjectIds[key] = isObjectIdOrHexString(value) ? new ObjectId(`${value}`) : value;
  }
  return flattenPayloadWithObjectIds;
};
exports.formatIdsArray = ids => (Array.isArray(ids) ? ids : [ids]);

exports.areObjectIdsEquals = (id1, id2) => !!id1 && !!id2 &&
  new ObjectId(`${id1}`).toHexString() === new ObjectId(`${id2}`).toHexString();

exports.doesArrayIncludeId = (array, id) => !!array && array.some(item => exports.areObjectIdsEquals(item, id));

exports.isStringedObjectId = value => typeof value === 'string' && !!value.match(/^[0-9a-fA-F]{24}$/);

exports.formatPhone = contact => (contact.phone
  ? `${contact.countryCode} ${contact.phone.substring(1)
    .replace(/^(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5')}`
  : '');

exports.computeHoursWithDiff = (pay, key) => {
  const hours = pay[key] || 0;
  const diff = pay.diff && pay.diff[key] ? pay.diff[key] : 0;

  return hours + diff;
};

// Returns a string
exports.getExclTaxes = (inclTaxes, vat) => {
  if (!vat) return NumbersHelper.toString(inclTaxes);

  const decimalVat = NumbersHelper.add(1, NumbersHelper.divide(vat, 100));

  return NumbersHelper.divide(inclTaxes, decimalVat);
};

exports.sumReduce = (array, key) => array.reduce((sum, b) => NumbersHelper.add(sum, (b[key] || 0)), 0);

exports.computeExclTaxesWithDiscount = (inclTaxes, discount, vat) => {
  if (!discount) return exports.getExclTaxes(inclTaxes, vat);

  const inclTaxesWithDiscount = NumbersHelper.subtract(inclTaxes, discount);

  return exports.getExclTaxes(inclTaxesWithDiscount, vat);
};

exports.getTotalDuration = (timePeriods, isResFormatted = true) => {
  const totalDuration = timePeriods.reduce(
    (acc, tp) => acc.add(CompaniDate(tp.endDate).diff(tp.startDate, 'minutes')),
    CompaniDuration()
  );

  return isResFormatted ? totalDuration.format(SHORT_DURATION_H_MM) : totalDuration;
};

exports.getTotalDurationForExport = (timePeriods) => {
  const totalDuration = timePeriods.reduce(
    (acc, tp) => acc.add(CompaniDate(tp.endDate).diff(tp.startDate, 'minutes')),
    CompaniDuration()
  );

  return exports.formatFloatForExport(totalDuration.asHours());
};

exports.getISOTotalDuration = timePeriods => timePeriods
  .reduce((acc, tp) => acc.add(CompaniDate(tp.endDate).diff(tp.startDate, SECOND)), CompaniDuration())
  .toISO();

exports.getDuration = (startDate, endDate) =>
  CompaniDuration(CompaniDate(endDate).diff(startDate, 'minutes')).format(SHORT_DURATION_H_MM);

exports.getDurationForExport = (startDate, endDate) =>
  exports.formatFloatForExport(CompaniDuration(CompaniDate(endDate).diff(startDate, 'minutes')).asHours());

exports.getKeysOf2DepthObject = object => Object.entries(object).reduce((acc, [key, value]) => {
  const isPlainNestedObject = typeof value === 'object' && !isObjectIdOrHexString(value) && Object.keys(value).length &&
    !Array.isArray(value);
  if (isPlainNestedObject) return [...acc, ...Object.keys(value).map(k => `${key}.${k}`)];

  return [...acc, key];
}, []);

exports.formatIntervalHourly = slot => `${CompaniDate(slot.startDate).format(HHhMM)} - `
  + `${CompaniDate(slot.endDate).format(HHhMM)}`;

exports.sortStrings = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

exports.formatSiret = siret => (
  siret
    ? `${siret.slice(0, 3)} ${siret.slice(3, 6)} ${siret.slice(6, 9)} ${siret.slice(9, 14)}`
    : ''
);

exports.formatQuantity = (label, quantity, pluralMark = 's', displayQuantity = true) => {
  let itemLabel = label;
  if (quantity > 1) itemLabel = label.split(' ').map(word => `${word}${pluralMark}`).join(' ');

  return displayQuantity ? `${quantity} ${itemLabel}` : itemLabel;
};

exports.hasUserAccessToCompany = (credentials, company) => {
  const credentialsCompany = get(credentials, 'company._id');
  if (credentialsCompany && exports.areObjectIdsEquals(credentialsCompany, company)) return true;

  const holdingCompanies = get(credentials, 'holding.companies') || [];

  return exports.doesArrayIncludeId(holdingCompanies, company);
};

exports.formatName = list => list.map(item => item.name).join(', ');
